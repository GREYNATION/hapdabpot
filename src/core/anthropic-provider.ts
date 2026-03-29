import Anthropic from "@anthropic-ai/sdk";
import { config, log } from './config.js';

export interface AnthropicMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export class AnthropicProvider {
  private anthropic: Anthropic | null = null;

  constructor() {
    if (config.anthropicApiKey) {
      this.anthropic = new Anthropic({
        apiKey: config.anthropicApiKey,
      });
    }
  }

  async chat(messages: AnthropicMessage[]): Promise<string> {
    if (!this.anthropic) {
      log("[Anthropic] SDK failure: ANTHROPIC_API_KEY is missing", "error");
      throw new Error("ANTHROPIC_API_KEY is not configured. Please add it to your .env file.");
    }

    try {
      const systemMessage = messages.find(m => m.role === 'system')?.content;
      const conversationMessages = messages
        .filter(m => m.role !== 'system')
        .map(m => ({
          role: m.role === 'user' ? 'user' as const : 'assistant' as const,
          content: m.content,
        }));

      log(`[Anthropic] Calling Anthropic SDK...`, 'info');
      
      const response = await this.anthropic.messages.create({
        model: "claude-3-5-sonnet-latest",
        max_tokens: 4096,
        system: systemMessage,
        messages: conversationMessages,
      });

      const textContent = response.content.find(c => c.type === 'text');
      return textContent && 'text' in textContent ? textContent.text.trim() : "";

    } catch (error: any) {
      log(`[Anthropic] SDK Error: ${error.message}`, 'error');
      throw new Error(`Anthropic SDK failed: ${error.message}`);
    }
  }
}

