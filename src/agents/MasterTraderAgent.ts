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

class MasterTraderAgent {
  private client: Anthropic;
  private state: MasterTraderState;
  private conversationHistory: Array<{ role: string; content: string }> = [];
  private tradovate: TradovateClient;

  constructor() {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });
    // Safely default to DEMO unless explicitly set to true
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

  /**
   * System prompt for the MasterTrader AI
   */
  private getSystemPrompt(): string {
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

  /**
   * Analyze price action and generate trading signals
   */
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
        const response = await this.client.messages.create({
          model: 'claude-3-opus-20240229',
          max_tokens: 500,
          system: this.getSystemPrompt(),
          messages: this.conversationHistory as any,
        });

        const assistantMessage =
          response.content[0].type === 'text' ? response.content[0].text : '';

        this.conversationHistory.push({
          role: 'assistant',
          content: assistantMessage,
        });

        this.state.lastSignal = assistantMessage;

        // Telemetry: Log Trade Signal
        const confidenceMatch = assistantMessage.match(/confidence:?\s*(\d+)%/i);
        const confidence = confidenceMatch ? parseInt(confidenceMatch[1]) / 100 : 0.85; // Default to 0.85 if not explicit
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
        }).catch(() => {});

        return assistantMessage;
    } catch (e: any) {
        console.error("Failed Anthropic Request:", e)
        return "Failed to analyze signal";
    }
  }

  /**
   * Handle generic conversational queries from the Orchestrator
   */
  async ask(userMessage: string): Promise<{ content: string; }> {
    this.conversationHistory.push({
      role: 'user',
      content: userMessage,
    });

    try {
        const response = await this.client.messages.create({
          model: 'claude-3-opus-20240229',
          max_tokens: 500,
          system: this.getSystemPrompt() + '\n\nThe user is chatting with you directly. Respond helpfully.',
          messages: this.conversationHistory as any,
        });

        const assistantMessage =
          response.content[0].type === 'text' ? response.content[0].text : '';

        this.conversationHistory.push({
          role: 'assistant',
          content: assistantMessage,
        });

        return { content: assistantMessage };
    } catch (e: any) {
        console.error("Failed Anthropic Request:", e)
        return { content: "I am having trouble connecting to my trading models right now." };
    }
  }

  /**
   * Execute a trade based on signal
   */
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
      // ðŸš¨ LIVE EXECUTION HOOK ðŸš¨
      const action = signal === 'IQ_BUY' ? 'Buy' : 'Sell';
      
      // Attempt to place the actual live order via Tradovate REST API
      await this.tradovate.placeMarketOrder(symbol, action, trade.size);
      
      this.state.openTrades.push(trade);
    } catch (error: any) {
      console.error(`ðŸš¨ TRADOVATE EXECUTION FAILED:`, error.message);
      trade.status = 'FAILED' as any;
      // We still return the trade so the dashboard/webhook sees the failure
    }

    // Log trade
    console.log(`âœ… Trade Opened:
      Symbol: ${symbol}
      Signal: ${signal}
      Entry: $${entryPrice}
      Size: ${trade.size}
      Stop: $${support}
      Target: $${resistance}`);

    return trade;
  }

  /**
   * Close a trade and record P&L
   */
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

    // Update stats
    this.updateTradeStats(trade);

    console.log(`âŒ Trade Closed:
      Symbol: ${trade.symbol}
      Exit: $${exitPrice}
      P&L: $${pnl.toFixed(2)} (${pnlPercent.toFixed(2)}%)
      Reason: ${exitReason}`);

    return trade;
  }

  /**
   * Calculate position size based on risk
   */
  private calculatePositionSize(entryPrice: number, stopPrice: number): number {
    const riskAmount = 0.02; // 2% account risk
    const accountSize = 10000; // Base account size
    const riskDistance = Math.abs(entryPrice - stopPrice);

    if (riskDistance === 0) return 1;

    const positionSize = (accountSize * riskAmount) / riskDistance;
    return Math.round(positionSize * 100) / 100;
  }

  /**
   * Update trading statistics
   */
  private updateTradeStats(closedTrade: Trade): void {
    const pnl = closedTrade.profitLoss || 0;
    this.state.totalPnL += pnl;

    // Update win rate
    const winners = this.state.closedTrades.filter(t => (t.profitLoss || 0) > 0).length;
    this.state.winRate = winners / this.state.closedTrades.length;

    // Update consecutive wins
    if ((closedTrade.profitLoss || 0) > 0) {
      this.state.consecutiveWins++;
    } else {
      this.state.consecutiveWins = 0;
    }
  }

  /**
   * Get performance summary
   */
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
ðŸŽ¯ MASTER TRADER PERFORMANCE
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
Total Trades: ${totalTrades}
Winners: ${winners} (${((winners / totalTrades) * 100).toFixed(1)}%)
Losers: ${losers} (${((losers / totalTrades) * 100).toFixed(1)}%)
Consecutive Wins: ${this.state.consecutiveWins}

ðŸ’° P&L METRICS
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
Total P&L: $${this.state.totalPnL.toFixed(2)}
Average Win: $${avgWin.toFixed(2)}
Average Loss: -$${avgLoss.toFixed(2)}
Win/Loss Ratio: ${(avgWin / avgLoss || 0).toFixed(2)}
Win Rate: ${(this.state.winRate * 100).toFixed(1)}%

ðŸ“Š OPEN POSITIONS
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
Count: ${this.state.openTrades.length}
${
  this.state.openTrades.length > 0
    ? this.state.openTrades
        .map(
          t =>
            `  ${t.symbol} - ${t.signal} @ $${t.entryPrice} (${t.size} units)`
        )
        .join('\n')
    : '  No open positions'
}
    `;
  }

  /**
   * Identify trading sessions
   */
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

  /**
   * Get current state
   */
  getState(): MasterTraderState {
    return this.state;
  }

  /**
   * Reset conversation history for fresh analysis
   */
  resetConversation(): void {
    this.conversationHistory = [];
  }
  /**
   * Get local state + optionally enrich with live Tradovate data
   */
  async getLiveAccountState(): Promise<{ state: MasterTraderState; liveBalance: any | null }> {
    let liveBalance = null;
    try {
      // Authenticate only if we have credentials
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

export { MasterTraderAgent, PriceLevel, Trade, MasterTraderState };

