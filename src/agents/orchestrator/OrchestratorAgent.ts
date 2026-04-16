import { BaseAgent } from "../baseAgent.js";
import { log } from "../../core/config.js";
import { SupabaseCrm } from "../../core/supabaseCrm.js";
import { CrmManager } from "../../core/crm.js";
import { AdsAgent } from "../ads/AdsAgent.js";

// Intent Types
type Intent = "trading" | "real_estate" | "drama" | "ads" | "general";

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
  "script", "drama", "episode", "scene",
  "bible", "character", "dialogue", "storyboard", "3d",
  "visual prompt", "series", "production", "ghost"
];

const ADS_KEYWORDS = [
  "ad copy", "facebook ad", "tiktok ad", "google ad", "youtube ad",
  "ad strategy", "ad budget", "ad funnel", "ad hook", "ad audience",
  "advertising", "campaign", "media buy", "landing page", "a/b test",
  "keyword research", "creative brief", "ad audit", "ad report",
  "scroll-stopping", "conversion funnel", "ad readiness"
];

export class OrchestratorAgent extends BaseAgent {
  private masterTraderAgent: any | null = null;
  private realEstateAgent: any | null = null;
  private dramaAgent: any | null = null;
  private adsAgentUserId: number = 0;

  constructor() {
    super("OrchestratorAgent", "");
  }

  getName(): string {
    return "OrchestratorAgent";
  }

  getSystemPrompt(): string {
    return "You are the Council Orchestrator of the HapdaBot Command Center. " +
      "You manage the elite Council of Spirits: " +
      "Ops Intelligence (Strategic Operations & Scale), " +
      "Communications Lead (Marketing & Global Outreach), " +
      "and Strategic Finance (Deal Analysis & ROI). " +
      "Route requests to the appropriate council specialist or lead a coordinated broadcast. " +
      "NEVER show function calls, tool syntax, or XML tags. Execute tools silently and present polished results from the Council.";
  }

  registerOpsAgent(agent: any) {
    this.realEstateAgent = agent;
    log("[orchestrator] Ops Intelligence registered");
  }

  registerCommsAgent(agent: any) {
    this.dramaAgent = agent;
    log("[orchestrator] Communications Lead registered");
  }

  registerFinanceAgent(agent: any) {
    this.masterTraderAgent = agent;
    log("[orchestrator] Strategic Finance registered");
  }

  registerAdsAgent(_agent: any) {
    log("[orchestrator] AdsAgent registered");
  }

  private detectIntent(message: string): { intent: Intent; confidence: "high" | "low" } {
    const lower = message.toLowerCase();

    const tradingScore = TRADING_KEYWORDS.filter(k => lower.includes(k)).length;
    const realEstateScore = REAL_ESTATE_KEYWORDS.filter(k => lower.includes(k)).length;
    const dramaScore = DRAMA_KEYWORDS.filter(k => lower.includes(k)).length;
    const adsScore = ADS_KEYWORDS.filter(k => lower.includes(k)).length;

    if (tradingScore === 0 && realEstateScore === 0 && dramaScore === 0 && adsScore === 0) {
      return { intent: "general", confidence: "low" };
    }

    const scores = [
      { intent: "trading" as Intent, score: tradingScore },
      { intent: "real_estate" as Intent, score: realEstateScore },
      { intent: "drama" as Intent, score: dramaScore },
      { intent: "ads" as Intent, score: adsScore }
    ];

    const best = scores.reduce((prev, current) => (current.score > prev.score) ? current : prev);

    return { 
      intent: best.intent, 
      confidence: best.score >= 2 ? "high" : "low" 
    };
  }

  async route(userMessage: string, attachments: any[] = []): Promise<RouteResult> {
    const { intent, confidence } = this.detectIntent(userMessage);

    log(`[orchestrator] Intent: ${intent} (${confidence}) — "${userMessage.slice(0, 60)}"`);

    try {
      switch (intent) {
        case "trading": {
          if (this.masterTraderAgent) {
            const res = await this.masterTraderAgent.ask(userMessage);
            return { intent, confidence, response: res.content };
          }
          return { intent, confidence, response: "MasterTraderAgent not connected." };
        }
        case "real_estate": {
          if (this.realEstateAgent) {
            const response = await this.realEstateAgent.handle(userMessage);
            return { intent, confidence, response };
          }
          return { intent, confidence, response: "RealEstateAgent not connected." };
        }
        case "drama": {
          if (this.dramaAgent) {
            const response = await this.dramaAgent.handle(userMessage, "user");
            return { intent, confidence, response };
          }
          return { intent, confidence, response: "DramaAgent not connected." };
        }
        case "ads": {
          const response = await AdsAgent.handle(userMessage, this.adsAgentUserId);
          return { intent, confidence, response };
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
}

export const orchestrator = new OrchestratorAgent();

export async function generateMorningBriefing(): Promise<string> {
    const stats = await SupabaseCrm.getSystemStatus();
    const hotDeal = CrmManager.getHottestDeal();
    const revenue = await CrmManager.getTotalRevenue();

    return [
        "🏛️ *COUNCIL OF SPIRITS — MORNING BRIEFING*",
        `System Status: OPTIMIZED`,
        "",
        "⛓️ *OPERATIONS (Ops)*",
        `New Market Prospects: ${stats.dealsFoundToday}`,
        `Current Focus: ${hotDeal ? hotDeal.address : "Expanding Lead Coverage"}`,
        "",
        "💰 *STRATEGIC FINANCE (Finance)*",
        `Monthly Captured ROI: $${revenue.month.toLocaleString()}`,
        `Market Volatility: Monitored`,
        "",
        "📢 *COMMUNICATIONS (Comms)*",
        "Engagement Pipeline: ACTIVE",
        "",
        `_The Hive Mind is Unified_`
    ].join("\n");
}
