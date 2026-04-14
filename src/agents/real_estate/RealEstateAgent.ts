import { BaseAgent } from "../baseAgent.js";
import { log } from "../../core/config.js";
import { findMotivatedSellers, formatLeads, Lead } from "../../services/universalLeadScraper.js";
import { runAutomatedSurplusScan } from "../../services/surplusPipeline.js";

export class RealEstateAgent extends BaseAgent {
  private lastDeals: Lead[] = [];
  
  calculateMAO(arv: number, repairs: number) {
    const mao = arv * 0.7 - repairs;
    const maxOffer = Math.max(0, mao);
    const spread = arv - repairs - maxOffer;

    let verdict: string;
    if (spread >= arv * 0.25) verdict = "🔥 Strong Deal";
    else if (spread >= arv * 0.1) verdict = "👀 Marginal";
    else verdict = "❌ Pass";

    return { arv, repairs, mao, maxOffer, verdict };
  }

  formatMAOResult(analysis: any): string {
    return (
      `${analysis.verdict}\n\n` +
      `**MAO Deal Analysis**\n` +
      `🏠 ARV:      $${analysis.arv.toLocaleString()}\n` +
      `🔧 Repairs:  $${analysis.repairs.toLocaleString()}\n` +
      `-----------------\n` +
      `💰 **MAO:**      $${analysis.maxOffer.toLocaleString()}\n\n` +
      `_Formula: ARV × 70% − Repairs_`
    );
  }

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

    // 2. MAO Calculation
    const numbers = userMessage.match(/\d[\d,]*/g)?.map(n => parseInt(n.replace(/,/g, ""))) ?? [];
    if (lower.includes("mao") || lower.includes("arv")) {
      if (numbers.length >= 2) {
        const [arv, repairs] = numbers;
        return this.formatMAOResult(this.calculateMAO(arv, repairs));
      }
      if (lower.trim() === "mao" || lower.trim() === "/mao") {
         return "📊 **Usage:** `/mao <ARV> <Repairs>`\nExample: `/mao 250000 40000`";
      }
    }

    // 3. Find Leads
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
