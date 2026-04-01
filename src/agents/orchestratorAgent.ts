import { BaseAgent } from "./baseAgent.js";
import { log } from "../core/config.js";

// ─── Intent Types ────────────────────────────────────────────────────────────

type Intent = "trading" | "real_estate" | "general";

interface RouteResult {
  intent: Intent;
  confidence: "high" | "low";
  response: string;
}

// ─── Keyword Maps ─────────────────────────────────────────────────────────────

const TRADING_KEYWORDS = [
  "trade", "trading", "btc", "bitcoin", "gbp", "forex",
  "p&l", "performance", "position", "signal", "profit",
  "loss", "long", "short", "entry", "exit", "stop loss",
  "take profit", "buy", "sell", "market", "chart", "candle",
  "iq buy", "iq sell", "mastertrader", "webhook"
];

const REAL_ESTATE_KEYWORDS = [
  "deal", "property", "seller", "mao", "arv", "repair",
  "wholesale", "lead", "scrape", "outreach", "motivated",
  "house", "home", "listing", "offer", "contract", "flip",
  "equity", "distressed", "zillow", "realtor", "crm",
  "south jersey", "brooklyn", "philadelphia", "philly"
];

// ─── OrchestratorAgent ────────────────────────────────────────────────────────

export class OrchestratorAgent extends BaseAgent {
  private masterTraderAgent: BaseAgent | null = null;
  private realEstateAgent: BaseAgent | null = null;

  constructor() {
    super(
      "OrchestratorAgent",
      `You are HapdaBot — an autonomous AI business operator for Hap. 
You manage two specialized agents:
- MasterTraderAgent: handles all crypto/forex trading (BTC/USD, GBP/USD)
- RealEstateAgent: handles wholesaling leads, deal analysis, and seller outreach

Your job is to understand what Hap wants and route it to the right agent.
For general conversation, help directly. Be sharp, fast, and results-oriented.
Never ask for unnecessary clarification — take action and report back.`
    );
  }

  getName(): string {
    return "OrchestratorAgent";
  }

  getSystemPrompt(): string {
    return this.systemPrompt;
  }

  // Register sub-agents
  registerTraderAgent(agent: BaseAgent) {
    this.masterTraderAgent = agent;
    log("[orchestrator] MasterTraderAgent registered");
  }

  registerRealEstateAgent(agent: BaseAgent) {
    this.realEstateAgent = agent;
    log("[orchestrator] RealEstateAgent registered");
  }

  // ─── Intent Detection ───────────────────────────────────────────────────────

  private detectIntent(message: string): { intent: Intent; confidence: "high" | "low" } {
    const lower = message.toLowerCase();

    const tradingScore = TRADING_KEYWORDS.filter(k => lower.includes(k)).length;
    const realEstateScore = REAL_ESTATE_KEYWORDS.filter(k => lower.includes(k)).length;

    if (tradingScore === 0 && realEstateScore === 0) {
      return { intent: "general", confidence: "low" };
    }

    if (tradingScore > realEstateScore) {
      return { intent: "trading", confidence: tradingScore >= 2 ? "high" : "low" };
    }

    if (realEstateScore > tradingScore) {
      return { intent: "real_estate", confidence: realEstateScore >= 2 ? "high" : "low" };
    }

    // Tie — default to general, let AI decide
    return { intent: "general", confidence: "low" };
  }

  // ─── Main Router ────────────────────────────────────────────────────────────

  async route(userMessage: string): Promise<RouteResult> {
    const { intent, confidence } = this.detectIntent(userMessage);

    log(`[orchestrator] Intent: ${intent} (${confidence}) — "${userMessage.slice(0, 60)}"`);

    try {
      switch (intent) {
        case "trading": {
          if (this.masterTraderAgent) {
            const response = await this.masterTraderAgent.chat(userMessage);
            return { intent, confidence, response };
          }
          return {
            intent,
            confidence,
            response: "⚠️ MasterTraderAgent not connected yet."
          };
        }

        case "real_estate": {
          if (this.realEstateAgent) {
            const response = await this.realEstateAgent.chat(userMessage);
            return { intent, confidence, response };
          }
          return {
            intent,
            confidence,
            response: "⚠️ RealEstateAgent not connected yet."
          };
        }

        default: {
          // Handle directly as orchestrator
          const response = await this.chat(userMessage);
          return { intent, confidence, response };
        }
      }
    } catch (e: any) {
      log(`[orchestrator] Routing error: ${e.message}`, "error");
      return {
        intent,
        confidence,
        response: `❌ Agent error: ${e.message}`
      };
    }
  }

  // ─── Status Report ──────────────────────────────────────────────────────────

  getStatus(): string {
    const trader = this.masterTraderAgent ? "✅ Connected" : "❌ Not connected";
    const realEstate = this.realEstateAgent ? "✅ Connected" : "❌ Not connected";
    return \`🤖 HapdaBot Orchestrator Status\\n\\n📈 MasterTraderAgent: \${trader}\\n🏠 RealEstateAgent: \${realEstate}\`;
  }
}

// Singleton export
export const orchestrator = new OrchestratorAgent();
