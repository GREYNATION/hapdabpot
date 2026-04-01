import { BaseAgent } from "./baseAgent.js";
import { log } from "../core/config.js";
import { findMotivatedSellers, formatLeads, TARGET_MARKETS } from "../services/universalLeadScraper.js";

interface DealAnalysis {
  arv: number;
  repairs: number;
  mao: number;
  maxOffer: number;
  verdict: string;
}

interface Lead {
  address: string;
  price?: number;
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
  constructor() {
    super(
      "RealEstateAgent",
      "You are HapdaBot's Real Estate Wholesaling Agent. " +
      "You find motivated sellers and off-market deals across Texas, Ohio, Virginia, and New York. " +
      "You analyze deals using MAO formula (ARV x 70% minus Repairs), " +
      "draft outreach messages, and manage the wholesaling pipeline. " +
      "Key rules: MAO is the ceiling, never overpay, deals below $5k spread are not worth pursuing. " +
      "Be direct and results-oriented."
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

  async draftOutreach(lead: Lead, channel: "sms" | "email" = "sms"): Promise<string> {
    const prompt = channel === "sms"
      ? "Draft a short conversational SMS under 160 chars to a motivated seller at " + lead.address + ". Goal: get them on the phone. Friendly, not salesy. Sign off as Hap."
      : "Draft a brief email subject and body to a motivated seller at " + lead.address + ". Under 100 words. Empathetic, professional. Sign as Hap / HapdaInvestments.";
    return await this.chat(prompt);
  }

  async handle(userMessage: string): Promise<string> {
    const lower = userMessage.toLowerCase();

    // MAO calculation
    const numbers = userMessage.match(/\d[\d,]*/g)?.map(n => parseInt(n.replace(/,/g, ""))) ?? [];
    if (
      (lower.includes("mao") || lower.includes("arv") ||
       (lower.includes("calculate") && lower.includes("deal"))) &&
      numbers.length >= 2
    ) {
      const [arv, repairs] = numbers;
      return this.formatMAOResult(this.calculateMAO(arv, repairs));
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
          return formatLeads(leads, 5);
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
