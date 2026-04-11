import { BaseAgent } from "../baseAgent.js";
import { log } from "../../core/config.js";
import { findMotivatedSellers, formatLeads, Lead } from "../../services/universalLeadScraper.js";
import { runAutomatedSurplusScan } from "../../services/surplusPipeline.js";

export class RealEstateAgent extends BaseAgent {
  private lastDeals: Lead[] = [];

  constructor() {
    super(
      "RealEstateAgent",
      ""
    );
  }

  getName(): string { return "RealEstateAgent"; }

  getSystemPrompt(): string {
    return `You are hapda_bot's Real Estate Wholesaling Agent for Hap Hustlehard.
Markets: South Jersey, Brooklyn, Philadelphia.
MAO Formula: ARV × 70% − Repairs = Maximum Allowable Offer.
Prioritize: distressed properties, pre-foreclosure, probate, tax liens.`;
  }

  async handle(userMessage: string): Promise<string> {
    const lower = userMessage.toLowerCase();

    // 1. Surplus Automation
    if (lower.includes("auto scan") && (lower.includes("surplus") || lower.includes("county"))) {
      runAutomatedSurplusScan().catch(err => log(`[realEstate] ❌ Surplus Scan Error: ${err.message}`, "error"));
      return `🚀 **Surplus Overage Scan Initiated**\nAnalyzing county records for tax overages. I will alert you as soon as a high-margin deal hits the CRM.`;
    }

    // 2. Find Leads
    if (lower.includes("find") || lower.includes("search") || lower.includes("motivated") || lower.includes("scrape")) {
      try {
        const leads = await findMotivatedSellers();
        if (leads.length > 0) {
          this.lastDeals = leads;
          return formatLeads(this.lastDeals.slice(0, 5), 5);
        }
        return "No fresh leads found in target markets right now.";
      } catch (err: any) {
        return `⚠️ Lead discovery failed: ${err.message}`;
      }
    }

    // Default: Chat
    const res = await this.ask(userMessage);
    return res.content;
  }
}

export const realEstateAgent = new RealEstateAgent();
