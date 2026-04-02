import { BaseAgent } from "./baseAgent.js";
import { log } from "../core/config.js";
import { findMotivatedSellers, formatLeads, TARGET_MARKETS, Lead } from "../services/universalLeadScraper.js";
import { calculateDeal } from "../services/leadFilter.js";

interface DealAnalysis {
  arv: number;
  repairs: number;
  mao: number;
  maxOffer: number;
  verdict: string;
}

const STATE_ALIASES: Record<string, string> = {
  "texas": "TX", "tx": "TX",
  "ohio": "OH", "oh": "OH",
  "virginia": "VA", "va": "VA",
  "brooklyn": "NY", "ny": "NY",
  "new york": "NY",
  "new jersey": "NJ", "nj": "NJ",
  "pennsylvania": "PA", "pa": "PA",
  "philly": "PA", "philadelphia": "PA"
};

const CITY_ALIASES: Record<string, string> = {
  "brooklyn": "Brooklyn",
  "philly": "Philadelphia",
  "philadelphia": "Philadelphia",
  "houston": "Houston",
  "dallas": "Dallas",
  "columbus": "Columbus",
  "cleveland": "Cleveland",
  "richmond": "Richmond",
  "norfolk": "Norfolk"
};

export class RealEstateAgent extends BaseAgent {
  private lastDeals: Lead[] = [];
  private offset: number = 0;

  constructor() {
    super(
      "RealEstateAgent",
      "You are HapdaBot's Real Estate Deal Engine. " +
      "Instead of just scraping, you are a high-precision Filter + Scorer + Profit Estimator. " +
      "You use a 0-100 Deal Quality Score (DQS) to rank every property. " +
      "Thresholds: 80+ is a REAL DEAL (actionable), 60-79 is WATCHLIST. " +
      "You identify strong distress signals (Probate, Tax, Absentee) and estimate ARV/Repairs " +
      "to determine the 'Profit Spread'. Your goal is to surface only the top 3-8 deals worth acting on."
    );
  }

  getName(): string {
    return "RealEstateAgent";
  }

  getSystemPrompt(): string {
    return this.systemPrompt;
  }

  calculateMAO(arv: number, repairs: number): DealAnalysis {
    const mao = arv * 0.7 - repairs;
    const maxOffer = Math.max(0, mao);
    const spread = arv - repairs - maxOffer;

    let verdict: string;
    if (spread >= arv * 0.25) verdict = "Strong Deal";
    else if (spread >= arv * 0.1) verdict = "Marginal";
    else verdict = "Pass";

    return { arv, repairs, mao, maxOffer, verdict };
  }

  formatSimulatorResult(deal: Lead): string {
    const profit = deal.profit || 0;
    const roi = deal.roi || 0;
    const verdict = deal.verdict || "UNKNOWN";
    
    const emoji = verdict === "GOOD_DEAL" ? "🔥" : verdict === "MARGINAL" ? "👀" : "❌";

    return (
      `${emoji} **VERDICT: ${verdict}**\n\n` +
      `**Profit Simulator Result**\n` +
      `🏠 ARV: $${(deal.arv || 0).toLocaleString()}\n` +
      `💰 Purchase: $${(deal.estimated_offer || 0).toLocaleString()}\n` +
      `🔧 Repairs: $${(deal.repair_estimate || 0).toLocaleString()}\n` +
      `🏗️ Total Cost: $${((deal.estimated_offer || 0) + (deal.repair_estimate || 0) + (deal.closing_costs || 0) + (deal.assignment_fee || 0)).toLocaleString()}\n` +
      `-----------------\n` +
      `💸 **NET PROFIT:** $${profit.toLocaleString()}\n` +
      `📈 **ROI:** ${roi.toFixed(1)}%\n\n` +
      `_Formula: ARV - (Purchase + Repairs + Fees + Assignment)_`
    );
  }

  formatMAOResult(analysis: DealAnalysis): string {
    return (
      analysis.verdict + "\n\n" +
      "Deal Analysis\n" +
      "ARV:      $" + analysis.arv.toLocaleString() + "\n" +
      "Repairs:  $" + analysis.repairs.toLocaleString() + "\n" +
      "-----------------\n" +
      "MAO:      $" + analysis.maxOffer.toLocaleString() + "\n\n" +
      "Formula: $" + analysis.arv.toLocaleString() + " x 70% - $" +
      analysis.repairs.toLocaleString() + " = $" + analysis.maxOffer.toLocaleString()
    );
  }

  private parseLocation(message: string): { state?: string; city?: string } {
    const lower = message.toLowerCase();
    let state: string | undefined;
    let city: string | undefined;

    for (const [alias, code] of Object.entries(STATE_ALIASES)) {
      if (lower.includes(alias)) { state = code; break; }
    }

    for (const [alias, name] of Object.entries(CITY_ALIASES)) {
      if (lower.includes(alias)) { city = name; break; }
    }

    return { state, city };
  }

  async draftOutreach(lead: Partial<Lead>, channel: "sms" | "email" = "sms"): Promise<string> {
    const addressStr = lead.address || "their property";
    const prompt = channel === "sms"
      ? "Draft a short conversational SMS under 160 chars to a motivated seller at " + addressStr + ". Goal: get them on the phone. Friendly, not salesy. Sign off as Hap."
      : "Draft a brief email subject and body to a motivated seller at " + addressStr + ". Under 100 words. Empathetic, professional. Sign as Hap / HapdaInvestments.";
    return await this.chat(prompt);
  }

  async handle(userMessage: string): Promise<string> {
    const lower = userMessage.toLowerCase();

    // MAO calculation
    const numbers = userMessage.match(/\d[\d,]*/g)?.map(n => parseInt(n.replace(/,/g, ""))) ?? [];
    if (
      (lower.includes("calculate") || lower.includes("simulate") || lower.includes("profit")) &&
      numbers.length >= 3
    ) {
      const [arv, purchase, repairs] = numbers;
      const simulatedDeal = calculateDeal({
        address: "Simulated Property",
        city: "Unknown",
        state: "Unknown",
        source: "Manual",
        type: "Simulation",
        distressSignals: [],
        arv,
        estimated_offer: purchase,
        repair_estimate: repairs
      });
      return this.formatSimulatorResult(simulatedDeal);
    }

    if (
      (lower.includes("mao") || lower.includes("arv") ||
       (lower.includes("calculate") && lower.includes("deal"))) &&
      numbers.length === 2
    ) {
      const [arv, repairs] = numbers;
      return this.formatMAOResult(this.calculateMAO(arv, repairs));
    }

    // Pagination for leads
    if (lower.includes("more leads") || (lower.includes("more") && lower.includes("lead"))) {
      if (this.lastDeals.length === 0) {
        return "No recent search memory. Ask me to find motivated sellers first.";
      }
      this.offset += 5;
      if (this.offset >= this.lastDeals.length) {
        return "That's all the leads from the last search! Try searching a different market.";
      }
      const nextBatch = this.lastDeals.slice(this.offset, this.offset + 5);
      return formatLeads(nextBatch, 5);
    }

    // Lead finding — use universal scraper
    if (
      lower.includes("find") || lower.includes("search") ||
      lower.includes("motivated") || lower.includes("seller") ||
      lower.includes("lead") || lower.includes("scrape") ||
      lower.includes("pull") || lower.includes("list") ||
      lower.includes("deal")
    ) {
      const { state, city } = this.parseLocation(lower);
      const location = city || state
        ? `${city || ""}${city && state ? ", " : ""}${state || ""}`
        : "all markets";

      log(`[realEstate] Scraping leads for: ${location}`);

      try {
        const leads = await findMotivatedSellers(state, city);
        if (leads.length > 0) {
          this.lastDeals = leads;
          this.offset = 0;
          return formatLeads(this.lastDeals.slice(0, 5), 5);
        }
        return "No live leads found right now. Markets searched: " + location + ". Try again in a few minutes.";
      } catch (e: any) {
        log(`[realEstate] Scraper error: ${e.message}`, "error");
        return "Lead scraper hit an error: " + e.message;
      }
    }

    // Outreach drafting
    if (lower.includes("outreach") || lower.includes("draft") ||
        lower.includes("sms") || lower.includes("message") && lower.includes("seller")) {
      return await this.draftOutreach(
        { address: userMessage },
        lower.includes("email") ? "email" : "sms"
      );
    }

    // Markets info
    if (lower.includes("market") || lower.includes("where") || lower.includes("what state")) {
      const marketList = Object.entries(TARGET_MARKETS)
        .map(([region, cities]) => `${region.toUpperCase()}: ${cities.map(c => c.city).join(", ")}`)
        .join("\n");
      return "Active markets:\n\n" + marketList;
    }

    log(`[realEstate] General chat: "${userMessage.slice(0, 60)}"`);
    return await this.chat(userMessage);
  }
}

export const realEstateAgent = new RealEstateAgent();
