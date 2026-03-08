import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatOpenAI } from '@langchain/openai';
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from '@langchain/core/prompts';
import { HumanMessage, AIMessage, BaseMessage } from '@langchain/core/messages';
import { Agent, ChatHistoryEntry } from '../common/types/agent.types';
import { buildBusinessInfo } from './prompt.builder';
import { TokenCounterCallback } from './token.callback';
import { createCustomerInfoTool } from './customer-info.tool';
import { createMetaTrackingTool, TrackedEventConfig, MetaEventName } from './meta-tracking.tool';
import { DatabaseService } from '../database/database.service';
import { createAgent } from 'langchain';

export interface AgentResponse {
  content: string;
  tokensUsed: number;
}

@Injectable()
export class LangchainService {
  constructor(
    private configService: ConfigService,
    private databaseService: DatabaseService,
  ) {}

  async executeAgent(
    agent: Agent,
    chatHistory: ChatHistoryEntry[],
    userMessage: string,
    userId: string, // WhatsApp phone number
  ): Promise<AgentResponse> {
    console.log(`🤖 Ejecutando agente para: ${agent.business_name}`);
    console.log(`📚 Historial: ${chatHistory.length} mensajes`);

    // 1. Construir businessInfo (sin historial embebido)
    const businessInfo = buildBusinessInfo(agent);
    console.log(`businessInfo: ${businessInfo}`);

    // 2. Convertir historial a formato LangChain
    const messages: BaseMessage[] = chatHistory.map((h) =>
      h.role === 'user'
        ? new HumanMessage(h.message)
        : new AIMessage(h.message),
    );

    console.log(`💬 Mensajes convertidos: ${messages.length}`);

    // 3. Configurar modelo
    const model = new ChatOpenAI({
      modelName: agent.model || 'gpt-4-turbo',
      temperature: agent.temperature ?? 0.7,
      maxTokens: agent.max_tokens ?? 500,
      openAIApiKey: this.configService.get<string>('OPENAI_API_KEY'),
      // Habilitar llamadas paralelas a tools (reduce iteraciones)
      // Soportado por: gpt-4-turbo, gpt-4o, gpt-3.5-turbo (Nov 2023+)
      modelKwargs: {
        parallel_tool_calls: true, // El modelo puede llamar múltiples tools a la vez
      },
    });

    // 4. Token tracking
    const tokenCounter = new TokenCounterCallback();

    // 5. Preparar tools (customer info + meta ads)
    const tools: any[] = [];

    // 5.1. Customer Info Tool
    if (agent.required_info && agent.required_info.length > 0) {
      console.log(
        `🔧 Tool habilitada: save_customer_info (campos: ${agent.required_info.join(', ')})`,
      );

      const customerInfoTool = createCustomerInfoTool(
        this.databaseService,
        agent.agent_id,
        userId,
        agent.required_info,
      );

      tools.push(customerInfoTool);
    }

    // 5.2. Meta Ads Tracking Tool
    const metaConfig = await this.getMetaAdsConfig(agent.agent_id);
    console.log(`🔍 Meta Ads config loaded:`, metaConfig ? `enabled=${metaConfig.is_enabled}` : 'null');
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

    // 6. Si hay tools, usar AgentExecutor
    if (tools.length > 0) {
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
      const responseText = lastMessage.content as string;

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
      };
    }

    // 7. Sin tools, usar chain simple
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

    const responseText = response.content as string;

    console.log(`✅ Respuesta generada: ${responseText.substring(0, 50)}...`);
    console.log(`📊 Tokens totales: ${tokenCounter.totalTokens}`);

    return {
      content: responseText,
      tokensUsed: tokenCounter.totalTokens,
    };
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
