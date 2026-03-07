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

@Injectable()
export class ChatService {
  constructor(
    private databaseService: DatabaseService,
    private langchainService: LangchainService,
    private configService: ConfigService,
  ) {}

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
      .order('created_at', { ascending: true })
      .limit(20); // Últimos 20 mensajes

    if (historyError) {
      console.error('❌ Error cargando historial:', historyError);
    }

    const chatHistory = (history || []) as ChatHistoryEntry[];

    console.log(`📚 Historial cargado: ${chatHistory.length} mensajes`);

    // 4️⃣ Ejecutar agente de LangChain
    const { content, tokensUsed } = await this.langchainService.executeAgent(
      agent,
      chatHistory,
      messageText,
    );

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
    };
  }
}
