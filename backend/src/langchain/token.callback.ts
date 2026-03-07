import { BaseCallbackHandler } from '@langchain/core/callbacks/base';

export class TokenCounterCallback extends BaseCallbackHandler {
  name = 'token_counter';
  totalTokens = 0;
  promptTokens = 0;
  completionTokens = 0;

  async handleLLMEnd(output: any) {
    // OpenAI devuelve token usage en llmOutput
    if (output.llmOutput?.tokenUsage) {
      const usage = output.llmOutput.tokenUsage;
      this.totalTokens += usage.totalTokens || 0;
      this.promptTokens += usage.promptTokens || 0;
      this.completionTokens += usage.completionTokens || 0;

      console.log('📊 Tokens:', {
        total: this.totalTokens,
        prompt: this.promptTokens,
        completion: this.completionTokens,
      });
    }
  }

  reset() {
    this.totalTokens = 0;
    this.promptTokens = 0;
    this.completionTokens = 0;
  }
}
