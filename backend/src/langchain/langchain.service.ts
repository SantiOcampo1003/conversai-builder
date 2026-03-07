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
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';

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

      // Crear prompt para agent
      const prompt = ChatPromptTemplate.fromMessages([
        ['system', businessInfo],
        new MessagesPlaceholder('chat_history'),
        ['human', '{input}'],
        new MessagesPlaceholder('agent_scratchpad'),
      ]);

      // Crear agent con tool calling
      const agentWithTools = await createToolCallingAgent({
        llm: model,
        tools: [customerInfoTool],
        prompt,
      });

      // Crear executor
      const executor = new AgentExecutor({
        agent: agentWithTools,
        tools: [customerInfoTool],
        verbose: false,
      });

      console.log('🚀 Ejecutando agent con tools...');

      const result = await executor.invoke(
        {
          chat_history: messages,
          input: userMessage,
        },
        {
          callbacks: [tokenCounter],
        },
      );

      const responseText = result.output;

      console.log(`✅ Respuesta generada: ${responseText.substring(0, 50)}...`);
      console.log(`📊 Tokens totales: ${tokenCounter.totalTokens}`);

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
