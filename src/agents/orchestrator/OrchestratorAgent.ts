import { BaseAgent } from "../baseAgent.js";
import { log } from "../../core/config.js";
import { SupabaseCrm } from "../../core/supabaseCrm.js";
import { CrmManager } from "../../core/crm.js";

// Intent Types
type Intent = "trading" | "real_estate" | "drama" | "general";

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

const DRAMA_KEYWORDS = [
  "script", "tiktok", "drama", "episode", "scene", "hook",
  "bible", "character", "dialogue", "storyboard", "3d",
  "visual prompt", "series", "video", "production", "ghost"
];

export class OrchestratorAgent extends BaseAgent {
  private masterTraderAgent: any | null = null;
  private realEstateAgent: any | null = null;
  private dramaAgent: any | null = null;

  constructor() {
    super("OrchestratorAgent", "");
  }

  getName(): string {
    return "OrchestratorAgent";
  }

  getSystemPrompt(): string {
    return "You are HapdaBot, an autonomous AI business operator for Hap. " +
      "You manage three specialized agents: " +
      "MasterTraderAgent for crypto/forex trading (BTC/USD, GBP/USD), " +
      "RealEstateAgent for wholesaling leads, deal analysis, and seller outreach, " +
      "and DramaAgent for TikTok 3D mini-drama production and scriptwriting. " +
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

  registerDramaAgent(agent: any) {
    this.dramaAgent = agent;
    log("[orchestrator] DramaAgent registered");
  }

  private detectIntent(message: string): { intent: Intent; confidence: "high" | "low" } {
    const lower = message.toLowerCase();

    const tradingScore = TRADING_KEYWORDS.filter(k => lower.includes(k)).length;
    const realEstateScore = REAL_ESTATE_KEYWORDS.filter(k => lower.includes(k)).length;
    const dramaScore = DRAMA_KEYWORDS.filter(k => lower.includes(k)).length;

    if (tradingScore === 0 && realEstateScore === 0 && dramaScore === 0) {
      return { intent: "general", confidence: "low" };
    }

    const scores = [
      { intent: "trading" as Intent, score: tradingScore },
      { intent: "real_estate" as Intent, score: realEstateScore },
      { intent: "drama" as Intent, score: dramaScore }
    ];

    const best = scores.reduce((prev, current) => (current.score > prev.score) ? current : prev);

    if (best.score === 0) return { intent: "general", confidence: "low" };

    return { 
      intent: best.intent, 
      confidence: best.score >= 2 ? "high" : "low" 
    };
  }

  async route(userMessage: string, attachments: any[] = []): Promise<RouteResult> {
    const { intent, confidence } = this.detectIntent(userMessage);

    log(`[orchestrator] Intent: ${intent} (${confidence}) — "${userMessage.slice(0, 60)}"`);

    const multimodalPayload = attachments.length > 0 ? [
      { type: "text", text: userMessage },
      ...attachments
    ] : userMessage;

    try {
      switch (intent) {
        case "trading": {
          if (this.masterTraderAgent) {
            const res = await this.masterTraderAgent.ask(multimodalPayload);
            return { intent, confidence, response: res.content };
          }
          return { intent, confidence, response: "MasterTraderAgent not connected yet." };
        }

        case "real_estate": {
          if (this.realEstateAgent) {
            const response = await this.realEstateAgent.handle(multimodalPayload);
            return { intent, confidence, response };
          }
          return { intent, confidence, response: "RealEstateAgent not connected yet." };
        }

        case "drama": {
          if (this.dramaAgent) {
            const response = await this.dramaAgent.handle(multimodalPayload, "user");
            return { intent, confidence, response };
          }
          return { intent, confidence, response: "DramaAgent not connected yet." };
        }

        default: {
          const res = await this.ask(multimodalPayload);
          return { intent, confidence, response: res.content };
        }
      }
    } catch (e: any) {
      log(`[orchestrator] Routing error: ${e.message}`, "error");
      return { intent, confidence, response: `Agent error: ${e.message}` };
    }
  }
}

export const orchestrator = new OrchestratorAgent();

/**
 * Telegraf Helper: orchestrate
 */
export async function orchestrate(message: string, userId: number): Promise<string> {
    const result = await orchestrator.route(message);
    return result.response;
}

/**
 * Telegraf Helper: generateMorningBriefing
 */
export async function generateMorningBriefing(): Promise<string> {
    const stats = await SupabaseCrm.getSystemStatus();
    const hotDeal = CrmManager.getHottestDeal();
    const revenue = await CrmManager.getTotalRevenue();

    return [
        "🌅 *GOOD MORNING HAP*",
        `System Status: ONLINE`,
        "",
        "🏠 *REAL ESTATE*",
        `Deals Found Today: ${stats.dealsFoundToday}`,
        `Hot Deal: ${hotDeal ? hotDeal.address : "None"} ($${hotDeal?.profit ? hotDeal.profit.toLocaleString() : 0} potential)`,
        `Monthly Revenue: $${revenue.month.toLocaleString()}`,
        "",
        "📈 *TRADING*",
        "BTC/USD: Monitoring",
        "Last Signal: See /signals",
        "",
        "🎬 *DRAMA*",
        "TikTok Production: ACTIVE",
        "",
        `_Hapdabot Brain v1.0.0 Online_`
    ].join("\n");
}
