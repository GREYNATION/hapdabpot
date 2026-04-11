import { Anthropic } from '@anthropic-ai/sdk';
import { TradovateClient } from '../../integrations/TradovateClient.js';
import { logEvent } from '../../core/telemetry.js';

interface PriceLevel {
  symbol: string;
  price: number;
  timestamp: string;
  signal?: 'IQ_BUY' | 'IQ_SELL' | 'NONE';
  support?: number;
  resistance?: number;
  session?: string;
}

interface Trade {
  id: string;
  symbol: string;
  entryPrice: number;
  entryTime: string;
  signal: 'IQ_BUY' | 'IQ_SELL';
  size: number;
  status: 'OPEN' | 'CLOSED' | 'PENDING';
  exitPrice?: number;
  exitTime?: string;
  profitLoss?: number;
  profitLossPercent?: number;
}

interface MasterTraderState {
  openTrades: Trade[];
  closedTrades: Trade[];
  totalPnL: number;
  winRate: number;
  consecutiveWins: number;
  lastSignal?: string;
}

export class MasterTraderAgent {
  private client: Anthropic;
  private state: MasterTraderState;
  private conversationHistory: Array<{ role: string; content: string }> = [];
  private tradovate: TradovateClient;

  constructor() {
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const useLive = process.env.TRADOVATE_USE_LIVE === 'true';
    this.tradovate = new TradovateClient(useLive);
    this.state = { openTrades: [], closedTrades: [], totalPnL: 0, winRate: 0, consecutiveWins: 0 };
  }

  getSystemPrompt(): string {
    return `You are MasterTrader, an advanced AI trading agent. Active pairs: BTC/USD, GBP/USD. Always prioritize capital preservation over aggressive trading.`;
  }

  async ask(userMessage: string): Promise<{ content: string }> {
    try {
      const response = await this.client.messages.create({
        model: 'claude-3-opus-20240229',
        max_tokens: 500,
        system: this.getSystemPrompt(),
        messages: [{ role: 'user', content: userMessage }],
      });
      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      return { content: text };
    } catch (e: any) {
      return { content: "Trading models unavailable right now." };
    }
  }

  getState(): MasterTraderState { return this.state; }
  resetConversation(): void { this.conversationHistory = []; }
  identifySession(): string { return 'Active session'; }
}

export { PriceLevel, Trade, MasterTraderState };
