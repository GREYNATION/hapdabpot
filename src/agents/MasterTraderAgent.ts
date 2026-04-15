import { Anthropic } from '@anthropic-ai/sdk';
import { TradovateClient } from '../integrations/TradovateClient.js';
import { logEvent } from '../core/telemetry.js';

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
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });
    const useLive = process.env.TRADOVATE_USE_LIVE === 'true';
    this.tradovate = new TradovateClient(useLive);
    this.state = {
      openTrades: [],
      closedTrades: [],
      totalPnL: 0,
      winRate: 0,
      consecutiveWins: 0,
    };
  }

  getSystemPrompt(): string {
    return `You are MasterTrader, an advanced AI trading agent specializing in:

1. **IQ Buy & Sell Signals**: You understand and act on institutional order flow signals
   - IQ Buy: Entry signal at support levels, lower range boundaries
   - IQ Sell: Entry signal at resistance levels, upper range boundaries

2. **Market Structure Analysis**:
   - Support/Resistance levels
   - Daily range identification (upper/lower bounds)
   - Breakout potential
   - Smart money institutional flow

3. **Session-Based Trading**:
   - London Session (00:00-09:00 GMT)
   - Tokyo Session (23:00-08:00 GMT)
   - Sydney Session (21:00-06:00 GMT)
   - New York Session (13:00-22:00 GMT)
   - Session overlaps create liquidity zones

4. **Profit-Taking Strategy**:
   - Take profits at resistance levels
   - Set stops at support breaks
   - Risk/reward ratio: 1:2 minimum
   - Scale out of winning trades
   - Move stop to breakeven after 1:1 reward

5. **Trade Management**:
   - Size: Based on account risk (max 2% per trade)
   - Stop Loss: Below structure support
   - Take Profit: At resistance/daily range boundaries
   - Time-based exits: 4-hour max hold on scalps

Current Market State:
${JSON.stringify(this.state, null, 2)}

When analyzing price data, provide:
- Signal confidence (0-100%)
- Risk/reward ratio
- Suggested entry/exit levels
- Position size recommendation
- Time until expiry
- Session context

Always prioritize capital preservation over aggressive trading.`;
  }

  private async chat(userMessage: string, systemPrompt?: string): Promise<string> {
    try {
      const response = await this.client.messages.create({
        model: 'claude-opus-4-5',
        max_tokens: 500,
        system: systemPrompt || this.getSystemPrompt(),
        messages: this.conversationHistory as any,
      });

      const assistantMessage =
        response.content[0].type === 'text' ? response.content[0].text : '';

      this.conversationHistory.push({
        role: 'assistant',
        content: assistantMessage,
      });

      return assistantMessage;
    } catch (e: any) {
      console.error("Failed Anthropic Request:", e);
      throw e;
    }
  }

  async analyzePriceAction(priceData: PriceLevel): Promise<string> {
    const userMessage = `
Analyze this price action for trading signal:

Symbol: ${priceData.symbol}
Current Price: $${priceData.price}
Signal: ${priceData.signal || 'NONE'}
Support Level: $${priceData.support}
Resistance Level: $${priceData.resistance}
Trading Session: ${priceData.session}
Timestamp: ${priceData.timestamp}

Current open trades: ${this.state.openTrades.length}
Win rate: ${(this.state.winRate * 100).toFixed(1)}%
Total P&L: $${this.state.totalPnL.toFixed(2)}

Provide:
1. Signal confidence
2. Risk/reward ratio
3. Entry/exit levels
4. Position size
5. Action recommendation (BUY/SELL/WAIT/CLOSE)`;

    this.conversationHistory.push({
      role: 'user',
      content: userMessage,
    });

    try {
      const assistantMessage = await this.chat(userMessage);
      this.state.lastSignal = assistantMessage;

      const confidenceMatch = assistantMessage.match(/confidence:?\s*(\d+)%/i);
      const confidence = confidenceMatch ? parseInt(confidenceMatch[1]) / 100 : 0.85;
      const direction = priceData.signal === 'IQ_BUY' ? 'long' : priceData.signal === 'IQ_SELL' ? 'short' : 'neutral';

      await logEvent({
        type: "trade_signal",
        source: "trading_agent",
        message: `${priceData.symbol} signal: ${priceData.signal || 'NONE'} at $${priceData.price}`,
        data: {
          direction,
          confidence,
          symbol: priceData.symbol,
          price: priceData.price,
          session: priceData.session
        }
      }).catch(() => { });

      return assistantMessage;
    } catch (e: any) {
      console.error("Failed Anthropic Request:", e);
      return "Failed to analyze signal";
    }
  }

  async ask(userMessage: string): Promise<{ content: string; }> {
    this.conversationHistory.push({
      role: 'user',
      content: userMessage,
    });

    try {
      const response = await this.chat(
        userMessage,
        this.getSystemPrompt() + '\n\nThe user is chatting with you directly. Respond helpfully.'
      );
      return { content: response };
    } catch (e: any) {
      return { content: "I am having trouble connecting to my trading models right now." };
    }
  }

  async executeTrade(
    symbol: string,
    signal: 'IQ_BUY' | 'IQ_SELL',
    entryPrice: number,
    support: number,
    resistance: number
  ): Promise<Trade> {
    const trade: Trade = {
      id: `trade_${Date.now()}`,
      symbol,
      entryPrice,
      entryTime: new Date().toISOString(),
      signal,
      size: this.calculatePositionSize(entryPrice, support),
      status: 'OPEN',
    };

    try {
      const action = signal === 'IQ_BUY' ? 'Buy' : 'Sell';
      await this.tradovate.placeMarketOrder(symbol, action, trade.size);
      this.state.openTrades.push(trade);
    } catch (error: any) {
      console.error(`TRADOVATE EXECUTION FAILED:`, error.message);
      trade.status = 'FAILED' as any;
    }

    console.log(`✅ Trade Opened:
      Symbol: ${symbol}
      Signal: ${signal}
      Entry: $${entryPrice}
      Size: ${trade.size}
      Stop: $${support}
      Target: $${resistance}`);

    return trade;
  }

  closeTrade(tradeId: string, exitPrice: number, exitReason: string): Trade | null {
    const tradeIndex = this.state.openTrades.findIndex(t => t.id === tradeId);
    if (tradeIndex === -1) return null;

    const trade = this.state.openTrades[tradeIndex];
    const pnl = (exitPrice - trade.entryPrice) * trade.size;
    const pnlPercent = ((exitPrice - trade.entryPrice) / trade.entryPrice) * 100;

    trade.exitPrice = exitPrice;
    trade.exitTime = new Date().toISOString();
    trade.profitLoss = pnl;
    trade.profitLossPercent = pnlPercent;
    trade.status = 'CLOSED';

    this.state.openTrades.splice(tradeIndex, 1);
    this.state.closedTrades.push(trade);
    this.updateTradeStats(trade);

    console.log(`❌ Trade Closed:
      Symbol: ${trade.symbol}
      Exit: $${exitPrice}
      P&L: $${pnl.toFixed(2)} (${pnlPercent.toFixed(2)}%)
      Reason: ${exitReason}`);

    return trade;
  }

  private calculatePositionSize(entryPrice: number, stopPrice: number): number {
    const riskAmount = 0.02;
    const accountSize = 10000;
    const riskDistance = Math.abs(entryPrice - stopPrice);
    if (riskDistance === 0) return 1;
    const positionSize = (accountSize * riskAmount) / riskDistance;
    return Math.round(positionSize * 100) / 100;
  }

  private updateTradeStats(closedTrade: Trade): void {
    const pnl = closedTrade.profitLoss || 0;
    this.state.totalPnL += pnl;
    const winners = this.state.closedTrades.filter(t => (t.profitLoss || 0) > 0).length;
    this.state.winRate = winners / this.state.closedTrades.length;
    if ((closedTrade.profitLoss || 0) > 0) {
      this.state.consecutiveWins++;
    } else {
      this.state.consecutiveWins = 0;
    }
  }

  getPerformanceSummary(): string {
    const totalTrades = this.state.closedTrades.length;
    const winners = this.state.closedTrades.filter(t => (t.profitLoss || 0) > 0).length;
    const losers = totalTrades - winners;
    const avgWin =
      winners > 0
        ? this.state.closedTrades
          .filter(t => (t.profitLoss || 0) > 0)
          .reduce((sum, t) => sum + (t.profitLoss || 0), 0) / winners
        : 0;
    const avgLoss =
      losers > 0
        ? Math.abs(
          this.state.closedTrades
            .filter(t => (t.profitLoss || 0) <= 0)
            .reduce((sum, t) => sum + (t.profitLoss || 0), 0) / losers
        )
        : 0;

    return `
🎯 MASTER TRADER PERFORMANCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Trades: ${totalTrades}
Winners: ${winners} (${((winners / totalTrades) * 100).toFixed(1)}%)
Losers: ${losers} (${((losers / totalTrades) * 100).toFixed(1)}%)
Consecutive Wins: ${this.state.consecutiveWins}

💰 P&L METRICS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total P&L: $${this.state.totalPnL.toFixed(2)}
Average Win: $${avgWin.toFixed(2)}
Average Loss: -$${avgLoss.toFixed(2)}
Win/Loss Ratio: ${(avgWin / avgLoss || 0).toFixed(2)}
Win Rate: ${(this.state.winRate * 100).toFixed(1)}%

📊 OPEN POSITIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Count: ${this.state.openTrades.length}
${this.state.openTrades.length > 0
        ? this.state.openTrades
          .map(t => `  ${t.symbol} - ${t.signal} @ $${t.entryPrice} (${t.size} units)`)
          .join('\n')
        : '  No open positions'
      }
    `;
  }

  identifySession(): string {
    const now = new Date();
    const hours = now.getUTCHours();
    if (hours >= 0 && hours < 9) return 'London Overlap/Tokyo';
    if (hours >= 8 && hours < 13) return 'London/Tokyo Overlap';
    if (hours >= 13 && hours < 17) return 'New York Open/London Close';
    if (hours >= 17 && hours < 21) return 'New York Prime Time';
    if (hours >= 21 && hours < 24) return 'Sydney/Tokyo Overlap';
    return 'Off-market hours';
  }

  getState(): MasterTraderState {
    return this.state;
  }

  resetConversation(): void {
    this.conversationHistory = [];
  }

  async getLiveAccountState(): Promise<{ state: MasterTraderState; liveBalance: any | null }> {
    let liveBalance = null;
    try {
      if (process.env.TRADOVATE_USERNAME && process.env.TRADOVATE_CID) {
        const authed = await this.tradovate.authenticate();
        if (authed) {
          const risk = await this.tradovate.getAccountRisk();
          if (risk && risk.length > 0) {
            liveBalance = risk[0];
          }
        }
      }
    } catch (e: any) {
      console.warn('[MasterTrader] Could not fetch live Tradovate balance:', e.message);
    }
    return { state: this.state, liveBalance };
  }
}

export { PriceLevel, Trade, MasterTraderState };