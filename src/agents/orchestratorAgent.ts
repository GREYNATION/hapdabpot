import { BaseAgent } from "./baseAgent.js";
import { log } from "../core/config.js";
import { SupabaseCrm } from "../core/supabaseCrm.js";

// Intent Types
type Intent = "trading" | "real_estate" | "general";

interface RouteResult {
  intent: Intent;
  confidence: "high" | "low";
  response: string;
}

// Keyword Maps
const TRADING_KEYWORDS = [
  "trade", "trading", "btc", "bitcoin", "gbp", "forex",
  "p&l", "performance", "position", "signal", "profit",
  "loss", "long", "short", "entry", "exit", "stop loss",
  "take profit", "buy", "sell", "chart", "candle",
  "iq buy", "iq sell", "mastertrader", "webhook"
];

const REAL_ESTATE_KEYWORDS = [
  "deal", "property", "seller", "mao", "arv", "repair",
  "wholesale", "lead", "scrape", "outreach", "motivated",
  "house", "home", "listing", "offer", "contract", "flip",
  "equity", "distressed", "zillow", "realtor", "crm",
  "south jersey", "brooklyn", "philadelphia", "philly"
];

export class OrchestratorAgent extends BaseAgent {
  private masterTraderAgent: any | null = null;
  private realEstateAgent: any | null = null;

  constructor() {
    super("OrchestratorAgent", "");
  }

  getName(): string {
    return "OrchestratorAgent";
  }

  getSystemPrompt(): string {
    return "You are HapdaBot, an autonomous AI business operator for Hap. " +
      "You manage two specialized agents: " +
      "MasterTraderAgent for crypto/forex trading (BTC/USD, GBP/USD), " +
      "and RealEstateAgent for wholesaling leads, deal analysis, and seller outreach. " +
      "Route requests to the right agent. For general conversation, respond directly. " +
      "Be sharp, fast, and results-oriented. Never ask for unnecessary clarification.";
  }

  registerTraderAgent(agent: any) {
    this.masterTraderAgent = agent;
    log("[orchestrator] MasterTraderAgent registered");
  }

  registerRealEstateAgent(agent: any) {
    this.realEstateAgent = agent;
    log("[orchestrator] RealEstateAgent registered");
  }

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

    return { intent: "general", confidence: "low" };
  }

  async route(userMessage: string): Promise<RouteResult> {
    const { intent, confidence } = this.detectIntent(userMessage);

    log(`[orchestrator] Intent: ${intent} (${confidence}) — "${userMessage.slice(0, 60)}"`);

    try {
      switch (intent) {
        case "trading": {
          if (this.masterTraderAgent) {
            const res = await this.masterTraderAgent.ask(userMessage);
            return { intent, confidence, response: res.content };
          }
          return { intent, confidence, response: "MasterTraderAgent not connected yet." };
        }

        case "real_estate": {
          if (this.realEstateAgent) {
            const response = await this.realEstateAgent.handle(userMessage);
            return { intent, confidence, response };
          }
          return { intent, confidence, response: "RealEstateAgent not connected yet." };
        }

        default: {
          const res = await this.ask(userMessage);
          return { intent, confidence, response: res.content };
        }
      }
    } catch (e: any) {
      log(`[orchestrator] Routing error: ${e.message}`, "error");
      return { intent, confidence, response: `Agent error: ${e.message}` };
    }
  }

  async getSystemStatus(): Promise<string> {
    const stats = await SupabaseCrm.getSystemStatus();
    
    return [
      "🟢 HAPDA SYSTEM STATUS",
      "",
      `Real Estate Agent: ${stats.realEstateActive ? "ACTIVE" : "OFFLINE"}`,
      `Deals Found Today: ${stats.dealsFoundToday}`,
      `High Score Leads: ${stats.highScoreLeads}`,
      `Trading Agent: ${this.masterTraderAgent ? "MONITORING" : "OFFLINE"}`
    ].join("\n");
  }

  getStatus(): string {
    const trader = this.masterTraderAgent ? "Connected" : "Not connected";
    const realEstate = this.realEstateAgent ? "Connected" : "Not connected";
    return "HapdaBot Orchestrator Status\n\nMasterTraderAgent: " + trader + "\nRealEstateAgent: " + realEstate;
  }
}

export const orchestrator = new OrchestratorAgent();
