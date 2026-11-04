import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatOpenAI } from '@langchain/openai';
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from '@langchain/core/prompts';
import { HumanMessage, AIMessage, BaseMessage } from '@langchain/core/messages';
import { Agent, AgentAsset, ChatHistoryEntry, OutboundFile } from '../common/types/agent.types';
import { buildBusinessInfo } from './prompt.builder';
import { TokenCounterCallback } from './token.callback';
import { createCustomerInfoTool } from './customer-info.tool';
import { resolveDataFields } from './data-fields';
import { extractLeakedArgs, hasLeakedToolText, stripLeakedToolText } from './output-sanitizer';
import { GoogleSheetsService } from '../integrations/google-sheets.service';
import { NotificationsService } from '../notifications/notifications.service';
import { createSendFileTool } from './agent-assets.tool';
import { resolveModelName, resolveTemperature } from './model.config';
import { createMetaTrackingTool, TrackedEventConfig, MetaEventName } from './meta-tracking.tool';
import { DatabaseService } from '../database/database.service';
import { createAgent } from 'langchain';

export interface AgentResponse {
  content: string;
  tokensUsed: number;
  /** Archivos que el agente decidió enviar; el canal los manda después del texto. */
  files: OutboundFile[];
}

@Injectable()
export class LangchainService {
  constructor(
    private configService: ConfigService,
    private databaseService: DatabaseService,
    @Optional() private googleSheets?: GoogleSheetsService,
    @Optional() private notifications?: NotificationsService,
  ) {}

  async executeAgent(
    agent: Agent,
    chatHistory: ChatHistoryEntry[],
    userMessage: string,
    userId: string, // WhatsApp phone number
  ): Promise<AgentResponse> {
    console.log(`🤖 Ejecutando agente para: ${agent.business_name}`);
    console.log(`📚 Historial: ${chatHistory.length} mensajes`);

    // 1. Cargar config de Meta Ads primero (para incluir en prompt)
    const metaConfig = await this.getMetaAdsConfig(agent.agent_id);
    console.log(`🔍 Meta Ads config loaded:`, metaConfig ? `enabled=${metaConfig.is_enabled}` : 'null');

    // 1.5. Cargar archivos enviables del agente (imágenes / PDFs)
    const { assets, sentKeys } = await this.getAgentAssets(agent.agent_id, userId, agent.products);
    const outbox: OutboundFile[] = [];

    // 2. Construir businessInfo (con info de Meta Ads y archivos si están habilitados)
    const leadData = await this.getLeadData(agent.agent_id, userId);

    const businessInfo = buildBusinessInfo(agent, {
      hasMetaAds: metaConfig?.is_enabled || false,
      assets,
      sentAssetKeys: [...sentKeys],
      leadData,
      contactId: userId,
    });
    // El prompt completo incluye datos de la persona (nombres, etc.) y pesa ~35 KB por mensaje:
    // solo se imprime si se activa LOG_SYSTEM_PROMPT=true (útil para depurar).
    if (this.configService.get<string>('LOG_SYSTEM_PROMPT') === 'true') {
      console.log(`businessInfo: ${businessInfo}`);
    } else {
      console.log(`📝 Prompt armado (${businessInfo.length} caracteres). LOG_SYSTEM_PROMPT=true para verlo completo.`);
    }

    // 3. Convertir historial a formato LangChain
    const messages: BaseMessage[] = chatHistory.map((h) =>
      h.role === 'user'
        ? new HumanMessage(h.message)
        : new AIMessage(h.message),
    );

    console.log(`💬 Mensajes convertidos: ${messages.length}`);

    // 4. Configurar modelo base (sin tools aún)
    const baseModelConfig = {
      modelName: resolveModelName(agent.model, this.configService.get<string>('OPENAI_MODEL')),
      temperature: resolveTemperature(agent.temperature, this.configService.get<string>('OPENAI_TEMPERATURE')),
      maxTokens: agent.max_tokens ?? 500,
      openAIApiKey: this.configService.get<string>('OPENAI_API_KEY'),
    };

    // 5. Token tracking
    const tokenCounter = new TokenCounterCallback();

    // 6. Preparar tools (customer info + meta ads)
    const tools: any[] = [];

    // 6.1. Customer Info Tool
    let customerInfoTool: ReturnType<typeof createCustomerInfoTool> | null = null;
    const dataFields = resolveDataFields(agent);
    if (dataFields.length > 0) {
      console.log(
        `🔧 Tool habilitada: save_customer_info (campos: ${dataFields.map((f) => f.key).join(', ')})`,
      );

      customerInfoTool = createCustomerInfoTool(
        this.databaseService,
        agent.agent_id,
        userId,
        dataFields,
        () => {
          void this.googleSheets?.syncLead(agent.agent_id, userId);
          void this.notifications?.notifyIfComplete(agent.agent_id, userId);
        },
      );

      tools.push(customerInfoTool);
    }

    // 6.2. Meta Ads Tracking Tool
    if (metaConfig?.is_enabled) {
      console.log(`🎯 Tool habilitada: track_meta_ads_event`);

      const metaTool = createMetaTrackingTool(
        metaConfig.tracked_events,
        async (eventName: MetaEventName, context?: string) => {
          // Solo insertar en BD, NO enviar a Meta aun (se hace en chat.service.ts)
          await this.markMetaEventForProcessing(
            agent.agent_id,
            userId,
            eventName,
            context,
          );
        }
      );

      if (metaTool) {
        tools.push(metaTool);
      }
    }

    // 6.3. Send File Tool (solo si el agente tiene archivos activos)
    if (assets.length > 0) {
      console.log(`📎 Tool habilitada: send_file (${assets.length} archivos)`);
      tools.push(
        createSendFileTool(this.databaseService, agent.agent_id, userId, assets, sentKeys, outbox),
      );
    }

    // 6. Si hay tools, usar AgentExecutor
    if (tools.length > 0) {
      // Configurar modelo con parallel_tool_calls solo cuando hay tools
      const model = new ChatOpenAI({
        ...baseModelConfig,
        // Habilitar llamadas paralelas a tools (reduce iteraciones)
        // Soportado por: gpt-4-turbo, gpt-4o, gpt-3.5-turbo (Nov 2023+)
        modelKwargs: {
          parallel_tool_calls: true, // El modelo puede llamar múltiples tools a la vez
        },
      });

      // Crear react agent con createAgent de langchain
      const customAgent = createAgent({
        model,
        tools,
        systemPrompt: businessInfo, // System prompt
      });

      console.log(`🚀 Ejecutando agent con tools (parallel_tool_calls: enabled)...`);

      const result = await customAgent.invoke(
        {
          messages: [...messages, new HumanMessage(userMessage)],
        },
        {
          callbacks: [tokenCounter],
        },
      );

      // El resultado viene en result.messages, el último es la respuesta del agente
      const lastMessage = result.messages[result.messages.length - 1];
      const rawText = lastMessage.content as string;
      if (hasLeakedToolText(rawText)) {
        console.warn('⚠️ El modelo escribió una llamada a herramienta como texto; se filtra antes de enviar');
        // Además de ocultarlo, se guarda de verdad lo que quiso guardar (solo claves del agente)
        const leaked = extractLeakedArgs(rawText, dataFields.map((f) => f.key));
        if (customerInfoTool && Object.keys(leaked).length > 0) {
          try {
            await customerInfoTool.invoke(leaked);
            console.log(`💾 Datos recuperados del texto filtrado: ${Object.keys(leaked).join(', ')}`);
          } catch (e) {
            console.error('No se pudieron guardar los datos del texto filtrado:', (e as Error).message);
          }
        }
      }
      const responseText = stripLeakedToolText(rawText);

      // Contar cuántas iteraciones y tool calls se hicieron
      const toolCallMessages = result.messages.filter(
        (msg: any) => msg.tool_calls && msg.tool_calls.length > 0
      );
      const totalToolCalls = toolCallMessages.reduce(
        (sum: number, msg: any) => sum + (msg.tool_calls?.length || 0),
        0
      );

      // Log detallado de cada mensaje en el resultado
      console.log(`📋 Desglose de iteraciones (${result.messages.length} mensajes):`);
      result.messages.forEach((msg: any, idx: number) => {
        const msgType = msg._getType ? msg._getType() : msg.constructor.name;
        const hasToolCalls = msg.tool_calls && msg.tool_calls.length > 0;
        const content = typeof msg.content === 'string'
          ? msg.content.substring(0, 80)
          : JSON.stringify(msg.content).substring(0, 80);

        console.log(`  ${idx + 1}. [${msgType}] ${hasToolCalls ? `🔧 Tool calls: ${msg.tool_calls.length}` : content}`);
      });

      console.log(`✅ Respuesta generada: ${responseText.substring(0, 50)}...`);
      console.log(`📊 Tokens totales: ${tokenCounter.totalTokens}`);
      console.log(`🔧 Tool calls ejecutadas: ${totalToolCalls} en ${Math.ceil(result.messages.length / 2)} iteraciones`);

      return {
        content: responseText,
        tokensUsed: tokenCounter.totalTokens,
        files: outbox,
      };
    }

    // 7. Sin tools, usar chain simple (sin parallel_tool_calls)
    const model = new ChatOpenAI(baseModelConfig);

    const prompt = ChatPromptTemplate.fromMessages([
      ['system', businessInfo],
      new MessagesPlaceholder('chat_history'),
      ['human', '{input}'],
    ]);

    const chain = prompt.pipe(model);

    console.log('🚀 Ejecutando chain simple...');

    const response = await chain.invoke(
      {
        chat_history: messages,
        input: userMessage,
      },
      {
        callbacks: [tokenCounter],
      },
    );

    const rawText = response.content as string;
    if (hasLeakedToolText(rawText)) console.warn('⚠️ El modelo escribió una llamada a herramienta como texto; se filtra antes de enviar');
    const responseText = stripLeakedToolText(rawText);

    console.log(`✅ Respuesta generada: ${responseText.substring(0, 50)}...`);
    console.log(`📊 Tokens totales: ${tokenCounter.totalTokens}`);

    return {
      content: responseText,
      tokensUsed: tokenCounter.totalTokens,
      files: outbox,
    };
  }

  /**
   * Datos del cliente ya guardados por save_customer_info (leads.additional_fields).
   * Si falla, devuelve null: el agente sigue funcionando sin ese estado.
   * @private
   */
  private async getLeadData(agentId: string, userId: string): Promise<Record<string, unknown> | null> {
    try {
      const { data, error } = await this.databaseService
        .getAdminClient()
        .from('leads')
        .select('additional_fields')
        .eq('agent_id', agentId)
        .eq('customer_id', userId)
        .maybeSingle();
      if (error) {
        console.error('❌ Error cargando datos del lead:', error.message);
        return null;
      }
      return (data?.additional_fields as Record<string, unknown>) ?? null;
    } catch (err) {
      console.error('❌ Error inesperado cargando datos del lead:', err);
      return null;
    }
  }

  /**
   * Carga los archivos activos del agente y los que ya se le enviaron a este usuario.
   * Si las tablas no existen o fallan, devuelve vacío: el agente sigue funcionando sin archivos.
   * @private
   */
  private async getAgentAssets(
    agentId: string,
    userId: string,
    products: Agent['products'],
  ): Promise<{ assets: AgentAsset[]; sentKeys: Set<string> }> {
    try {
      const supabase = this.databaseService.getAdminClient();

      const { data: assets, error } = await supabase
        .from('agent_assets')
        .select('asset_key, kind, title, caption, send_when, product_id, public_url, file_name, mime_type')
        .eq('agent_id', agentId)
        .eq('active', true)
        .order('sort_order', { ascending: true });

      if (error || !assets || assets.length === 0) {
        if (error) console.error('❌ Error cargando agent_assets:', error.message);
        return { assets: [], sentKeys: new Set() };
      }

      const { data: sent } = await supabase
        .from('agent_asset_sends')
        .select('asset_key')
        .eq('agent_id', agentId)
        .eq('user_id', userId);

      // Ignorar fotos cuyo producto ya no existe en el agente
      const productIds = new Set((products ?? []).map((p) => p.id));
      const usable = (assets as AgentAsset[]).filter((a) => !a.product_id || productIds.has(a.product_id));

      return {
        assets: usable,
        sentKeys: new Set((sent || []).map((r: { asset_key: string }) => r.asset_key)),
      };
    } catch (err) {
      console.error('❌ Error inesperado cargando archivos del agente:', err);
      return { assets: [], sentKeys: new Set() };
    }
  }

  /**
   * Obtiene la configuracion de Meta Ads para un agente
   * @private
   */
  private async getMetaAdsConfig(agentId: string): Promise<{
    is_enabled: boolean;
    tracked_events: TrackedEventConfig[];
  } | null> {
    try {
      // Use admin client to bypass RLS (internal backend query)
      const supabase = this.databaseService.getAdminClient();
      console.log(`🔍 Querying meta_ads_config for agent: ${agentId}`);

      const { data, error } = await supabase
        .from('meta_ads_config')
        .select('is_enabled, tracked_events')
        .eq('agent_id', agentId)
        .maybeSingle();

      if (error) {
        console.error('❌ Error fetching meta_ads_config:', error);
        return null;
      }

      if (!data) {
        console.log('ℹ️  No meta_ads_config found for this agent');
        return null;
      }

      if (!data.is_enabled) {
        console.log('ℹ️  Meta Ads is disabled for this agent');
        return null;
      }

      console.log(`✅ Meta Ads config found: ${data.tracked_events.length} events`);
      return data as { is_enabled: boolean; tracked_events: TrackedEventConfig[] };
    } catch (error) {
      console.error('❌ Unexpected error in getMetaAdsConfig:', error.message);
      return null;
    }
  }

  /**
   * Marca un evento de Meta Ads para ser procesado despues
   * (solo inserta en BD, NO envia a Meta API)
   * @private
   */
  private async markMetaEventForProcessing(
    agentId: string,
    userId: string,
    eventName: MetaEventName,
    context?: string,
  ): Promise<void> {
    try {
      // Use admin client to bypass RLS
      const supabase = this.databaseService.getAdminClient();

      await supabase.from('meta_ads_events').insert({
        agent_id: agentId,
        user_id: userId,
        event_name: eventName,
        sent_successfully: false, // Pendiente de envio
        event_payload: { context }, // Solo guardamos el contexto por ahora
      });

      console.log(`✅ Meta event marked for processing: ${eventName}`);
    } catch (error) {
      console.error('Error marking meta event:', error);
      // No lanzar error, solo log (no afectar conversacion)
    }
  }
}
