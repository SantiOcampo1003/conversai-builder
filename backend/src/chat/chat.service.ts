import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../database/database.service';
import { LangchainService } from '../langchain/langchain.service';
import { ChatMessageDto } from './dto/chat-message.dto';
import { ChatResponseDto } from './dto/chat-response.dto';
import {
  AgentWithTokens,
  ChatHistoryEntry,
} from '../common/types/agent.types';
import { MetaAdsClient } from '../langchain/meta-ads.client';

@Injectable()
export class ChatService {
  constructor(
    private databaseService: DatabaseService,
    private langchainService: LangchainService,
    private configService: ConfigService,
  ) { }

  async handleMessage(dto: ChatMessageDto): Promise<ChatResponseDto> {
    const { agentId, userId, messageText } = dto;

    console.log(`\n${'='.repeat(60)}`);
    console.log(`📱 Nuevo mensaje de ${userId}`);
    console.log(`🤖 Agente: ${agentId}`);
    console.log(`💬 Mensaje: "${messageText}"`);
    console.log('='.repeat(60));

    const supabase = this.databaseService.getClient();

    // 1️⃣ Cargar datos del agente
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('*')
      .eq('agent_id', agentId)
      .single();

    if (agentError || !agent) {
      console.error('❌ Error cargando agente:', agentError);
      throw new NotFoundException('Agente no encontrado');
    }

    console.log(`✅ Agente cargado: ${agent.business_name}`);

    // 2️⃣ Cargar balance de tokens
    const { data: tokenBalance } = await supabase
      .from('token_balances')
      .select('available_tokens, is_active')
      .eq('client_id', agent.client_id)
      .single();

    // 2️⃣ Verificar tokens disponibles
    const availableTokens = tokenBalance?.available_tokens || 0;
    const isActive = tokenBalance?.is_active ?? true;

    console.log(`💰 Tokens disponibles: ${availableTokens}`);
    console.log(`📊 Estado: ${isActive ? 'Activo' : 'Inactivo'}`);

    if (availableTokens < 500 || !isActive) {
      console.log('⚠️  Tokens insuficientes');

      // Guardar mensaje del usuario en historial (para tener registro)
      const noTokensMessage =
        'Lo siento, este servicio está temporalmente sin disponibilidad. El equipo ya ha sido notificado y se pondrá en contacto contigo pronto. Por favor, intenta nuevamente más tarde. 🙏';

      await supabase.from('chat_history').insert([
        {
          agent_id: agentId,
          user_id: userId,
          role: 'user',
          message: messageText,
        },
        {
          agent_id: agentId,
          user_id: userId,
          role: 'assistant',
          message: noTokensMessage,
        },
      ]);

      // TODO: Enviar email al dueño del cliente notificando que alguien
      // está intentando usar el bot pero no hay tokens disponibles.
      // Incluir: agentId, userId, messageText, timestamp

      return {
        output: noTokensMessage,
      };
    }

    // 3️⃣ Cargar historial de conversación
    const { data: history, error: historyError } = await supabase
      .from('chat_history')
      .select('role, message, created_at')
      .eq('agent_id', agentId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (historyError) {
      console.error('❌ Error cargando historial:', historyError);
    }

    // Invertir para tener orden cronológico (más viejo → más nuevo)
    const chatHistory = ((history || []) as ChatHistoryEntry[]).reverse();

    console.log(`📚 Historial cargado: ${chatHistory.length} mensajes`);

    // 4️⃣ Ejecutar agente de LangChain (con tools si está configurado)
    const { content, tokensUsed, files } = await this.langchainService.executeAgent(
      agent,
      chatHistory,
      messageText,
      userId, // WhatsApp phone number para customer info tool
    );

    // 4.5️⃣ Procesar eventos de Meta Ads (NO bloquea la respuesta)
    this.processMetaAdsEvents({
      agentId,
      userId,
      userMessage: messageText,
      agentResponse: content,
      isFirstMessage: chatHistory.length === 0,
    }).catch(err => {
      console.error('❌ Error procesando Meta Ads:', err);
      // NO lanzar error, solo log (no afectar conversacion)
    });

    // Calcular tokens a cobrar (con markup configurable)
    const markupPercentage = this.configService.get<number>(
      'TOKEN_MARKUP_PERCENTAGE',
      100,
    ); // Default: 100%
    const tokensReal = tokensUsed;
    const tokensToCharge = Math.ceil(
      tokensReal * (1 + markupPercentage / 100),
    );

    console.log(`💬 Respuesta: ${content.substring(0, 100)}...`);
    console.log(`📊 Tokens reales (OpenAI): ${tokensReal}`);
    console.log(
      `💰 Tokens a cobrar (markup ${markupPercentage}%): ${tokensToCharge}`,
    );

    // 5️⃣ Guardar conversación en BD
    const { error: saveError } = await supabase.from('chat_history').insert([
      {
        agent_id: agentId,
        user_id: userId,
        role: 'user',
        message: messageText,
      },
      {
        agent_id: agentId,
        user_id: userId,
        role: 'assistant',
        message: content,
      },
    ]);

    if (saveError) {
      console.error('❌ Error guardando historial:', saveError);
    } else {
      console.log('✅ Conversación guardada');
    }

    // 6️⃣ Descontar tokens (con markup del 100%)
    // Primero obtener el valor actual
    const { data: currentBalance } = await supabase
      .from('token_balances')
      .select('used_tokens')
      .eq('client_id', agent.client_id)
      .single();

    // Actualizar con los tokens a cobrar (con markup)
    const newUsedTokens = (currentBalance?.used_tokens || 0) + tokensToCharge;

    const { error: tokenError } = await supabase
      .from('token_balances')
      .update({
        used_tokens: newUsedTokens,
        updated_at: new Date().toISOString(),
      })
      .eq('client_id', agent.client_id);

    if (tokenError) {
      console.error('❌ Error actualizando tokens:', tokenError);
    }

    // Insertar transacción con información detallada (columnas nuevas y viejas)
    await supabase.from('token_transactions').insert({
      client_id: agent.client_id,
      agent_id: agentId,
      type: 'consumption',
      tokens: -tokensToCharge, // Columna vieja (para compatibilidad)
      tokens_real: tokensReal, // Tokens reales de OpenAI
      tokens_charged: tokensToCharge, // Tokens cobrados al cliente
      markup_percentage: markupPercentage, // Porcentaje aplicado
      description: `Consumo agente ${agentId}`,
    });

    console.log(`✅ Tokens descontados del cliente: ${tokensToCharge}`);
    console.log(
      `💸 Ganancia: ${tokensToCharge - tokensReal} tokens (${markupPercentage}%)`,
    );
    console.log('='.repeat(60) + '\n');

    return {
      output: content,
      ...(files.length > 0 && { files }),
    };
  }

  /**
   * Procesa eventos de Meta Ads de forma asincrona
   * Detecta eventos automaticos y envia eventos pendientes a Meta API
   * @private
   */
  private async processMetaAdsEvents(params: {
    agentId: string;
    userId: string;
    userMessage: string;
    agentResponse: string;
    isFirstMessage: boolean;
  }): Promise<void> {
    // Use admin client for internal queries
    const supabase = this.databaseService.getAdminClient();

    // 1. Cargar configuracion de Meta Ads
    const { data: config } = await supabase
      .from('meta_ads_config')
      .select('*')
      .eq('agent_id', params.agentId)
      .maybeSingle();

    if (!config || !config.is_enabled) {
      return; // Meta Ads no habilitado para este agente
    }

    console.log(`🎯 Procesando Meta Ads events para agente ${params.agentId}`);

    const eventsToSend: string[] = [];

    // 2. Detectar Contact (primer mensaje) - AUTOMATICO
    if (params.isFirstMessage) {
      const canSend = await this.canSendMetaEvent(
        params.agentId,
        params.userId,
        'Contact',
        config,
      );

      if (canSend) {
        console.log(`   ✅ Contact event detected (first message)`);
        eventsToSend.push('Contact');
      }
    }

    // 3. Detectar HotmartLinkSent (regex en respuesta) - AUTOMATICO
    if (/hotmart\.com|pay\.hotmart\.com|eduzz\.com/i.test(params.agentResponse)) {
      const canSend = await this.canSendMetaEvent(
        params.agentId,
        params.userId,
        'HotmartLinkSent',
        config,
      );

      if (canSend) {
        console.log(`   ✅ HotmartLinkSent event detected (link in response)`);
        eventsToSend.push('HotmartLinkSent');
      }
    }

    // 4. Buscar eventos marcados por la tool (sent_successfully = false)
    const { data: pendingEvents } = await supabase
      .from('meta_ads_events')
      .select('id, event_name')
      .eq('agent_id', params.agentId)
      .eq('user_id', params.userId)
      .eq('sent_successfully', false)
      .gte('created_at', new Date(Date.now() - 60000).toISOString()); // Ultimos 60 seg

    if (pendingEvents && pendingEvents.length > 0) {
      for (const evt of pendingEvents) {
        const canSend = await this.canSendMetaEvent(
          params.agentId,
          params.userId,
          evt.event_name,
          config,
        );

        if (canSend) {
          console.log(`   ✅ ${evt.event_name} event detected (from tool)`);
          eventsToSend.push(evt.event_name);

          // Marcar como procesado
          await supabase
            .from('meta_ads_events')
            .delete()
            .eq('id', evt.id);
        }
      }
    }

    // 5. Enviar todos los eventos a Meta API
    for (const eventName of eventsToSend) {
      await this.sendEventToMeta(params.agentId, params.userId, eventName, config);
    }

    console.log(`🎯 Meta Ads processing complete: ${eventsToSend.length} events sent`);
  }

  /**
   * Verifica si se puede enviar un evento (respeta limites configurados)
   * @private
   */
  private async canSendMetaEvent(
    agentId: string,
    userId: string,
    eventName: string,
    config: any,
  ): Promise<boolean> {
    const eventConfig = config.tracked_events.find((e: any) => e.event === eventName);

    if (!eventConfig || !eventConfig.enabled) {
      return false;
    }

    const supabase = this.databaseService.getClient();

    const { count } = await supabase
      .from('meta_ads_events')
      .select('id', { count: 'exact', head: true })
      .eq('agent_id', agentId)
      .eq('user_id', userId)
      .eq('event_name', eventName)
      .eq('sent_successfully', true);

    return (count || 0) < eventConfig.max_per_user;
  }

  /**
   * Envia un evento a Meta Conversions API
   * @private
   */
  private async sendEventToMeta(
    agentId: string,
    userId: string,
    eventName: string,
    config: any,
  ): Promise<void> {
    const supabase = this.databaseService.getAdminClient();

    try {
      if (!config.access_token) {
        console.log('⚠️  Skipping Meta event send: access_token not configured');
        await supabase.from('meta_ads_events').insert({
          agent_id: agentId,
          user_id: userId,
          event_name: eventName,
          sent_successfully: false,
          error_message: 'Access token not configured',
          was_test_event: config.test_mode || false,
        });
        return;
      }

      const accessToken = this.decodeBase64(config.access_token);

      console.log(`🔑 Access token (decoded): ${accessToken.substring(0, 20)}...${accessToken.substring(accessToken.length - 10)}`);
      console.log(`📏 Token length: ${accessToken.length} characters`);

      const client = new MetaAdsClient(
        config.pixel_id,
        accessToken,
        config.test_mode || false,
        config.test_event_code,
      );

      const payload = client.buildEventPayload(eventName, userId, {
        agent_id: agentId,
      });

      console.log(`📤 Sending ${eventName} to Meta API...`);
      console.log(`📦 Payload:`, JSON.stringify(payload, null, 2));

      const result = await client.sendEvent(payload);

      console.log(`📥 Meta API Response:`, JSON.stringify(result, null, 2));

      const { data: insertData, error: insertError } = await supabase.from('meta_ads_events').insert({
        agent_id: agentId,
        user_id: userId,
        event_name: eventName,
        sent_successfully: result.success,
        meta_event_id: result.eventId || null,
        error_message: result.error || null,
        was_test_event: config.test_mode || false,
        event_payload: payload,
      });

      if (insertError) {
        console.error(`❌ Error saving to meta_ads_events:`, insertError);
      } else {
        console.log(`✅ Event saved to meta_ads_events table`);
      }

      if (result.success) {
        console.log(`✅ ${eventName} sent successfully to Meta (Event ID: ${result.eventId})`);

        await this.updateLeadMetaStatus(agentId, userId, eventName);
      } else {
        console.error(`❌ Failed to send ${eventName} to Meta:`, result.error);
      }
    } catch (error) {
      console.error(`❌ Error sending event to Meta:`, error);

      const { error: saveError } = await supabase.from('meta_ads_events').insert({
        agent_id: agentId,
        user_id: userId,
        event_name: eventName,
        sent_successfully: false,
        error_message: error.message,
        was_test_event: config.test_mode || false,
      });

      if (saveError) {
        console.error(`❌ Error saving failure to meta_ads_events:`, saveError);
      }
    }
  }

  /**
   * Actualiza el status de Meta Ads en la tabla leads
   * @private
   */
  private async updateLeadMetaStatus(
    agentId: string,
    userId: string,
    eventName: string,
  ): Promise<void> {
    const supabase = this.databaseService.getClient();

    const { data: lead } = await supabase
      .from('leads')
      .select('meta_ads_status')
      .eq('agent_id', agentId)
      .eq('customer_id', userId)
      .maybeSingle();

    if (lead) {
      const status = lead.meta_ads_status || {};
      status[`${eventName.toLowerCase()}_sent`] = true;
      status[`${eventName.toLowerCase()}_sent_at`] = new Date().toISOString();

      if (eventName === 'HotmartLinkSent') {
        status.hotmart_link_sent_count = (status.hotmart_link_sent_count || 0) + 1;
      }

      await supabase
        .from('leads')
        .update({ meta_ads_status: status })
        .eq('agent_id', agentId)
        .eq('customer_id', userId);
    }
  }

  /**
   * Decodifica un token desde Base64
   * @private
   */
  private decodeBase64(encoded: string): string {
    return Buffer.from(encoded, 'base64').toString('utf8');
  }

  /**
   * Codifica un token a Base64
   * @private
   */
  private encodeBase64(token: string): string {
    return Buffer.from(token, 'utf8').toString('base64');
  }
}
