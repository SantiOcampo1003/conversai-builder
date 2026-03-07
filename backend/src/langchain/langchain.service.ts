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

    // 3. Crear prompt template
    const prompt = ChatPromptTemplate.fromMessages([
      ['system', businessInfo], // ← Sin historial
      new MessagesPlaceholder('chat_history'), // ← Historial estructurado
      ['human', '{input}'], // ← Mensaje actual
    ]);

    // 4. Configurar modelo con o sin tools
    let model = new ChatOpenAI({
      modelName: agent.model || 'gpt-4-turbo',
      temperature: agent.temperature ?? 0.7,
      maxTokens: agent.max_tokens ?? 500,
      openAIApiKey: this.configService.get<string>('OPENAI_API_KEY'),
    });

    // 5. Crear tools dinámicas y vincularlas al modelo
    if (agent.required_info && agent.required_info.length > 0) {
      const customerInfoTool = createCustomerInfoTool(
        this.databaseService,
        agent.agent_id,
        userId,
        agent.required_info,
      );

      // Bind tool al modelo (OpenAI Function Calling)
      model = model.bind({
        tools: [customerInfoTool],
      }) as ChatOpenAI;

      console.log(
        `🔧 Tool habilitada: save_customer_info (campos: ${agent.required_info.join(', ')})`,
      );
    }

    // 6. Crear chain
    const chain = prompt.pipe(model);

    // 7. Token tracking
    const tokenCounter = new TokenCounterCallback();

    // 8. Ejecutar
    console.log('🚀 Ejecutando chain...');

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
