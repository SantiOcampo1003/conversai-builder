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

    // 5. Si hay tools, usar AgentExecutor
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

      // Crear react agent con createAgent de langchain
      const customAgent = createAgent({
        model,
        tools: [customerInfoTool],
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

    // 6. Sin tools, usar chain simple
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
}
