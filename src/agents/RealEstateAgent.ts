import { BaseAgent } from "./baseAgent.js";
import { log } from "../core/config.js";

// --- Types ---

interface DealAnalysis {
  arv: number;
  repairs: number;
  mao: number;
  maxOffer: number;
  verdict: "🟢 Strong Deal" | "🟡 Marginal" | "🔴 Pass";
}

interface Lead {
  address: string;
  price?: number;
  source?: string;
  notes?: string;
}

// --- RealEstateAgent ---

export class RealEstateAgent extends BaseAgent {
  private targetMarkets = ["South Jersey", "Brooklyn", "Philadelphia", "Philly"];

  constructor() {
    super("RealEstateAgent", ""); // BaseAgent constructor asks for it, but we override it
  }

  getName(): string {
    return "RealEstateAgent";
  }

  getSystemPrompt(): string {
    return `You are HapdaBot's Real Estate Wholesaling Agent — a specialist in finding 
and closing off-market deals. Your markets are South Jersey, Brooklyn, and Philadelphia.

Core responsibilities:
- Find motivated sellers and distressed properties
- Analyze deals using the MAO formula: ARV × 70% − Repairs
- Draft seller outreach (SMS/email) that converts
- Manage the wholesaling pipeline from lead to contract
- Research comps, ARV estimates, and market trends

Key rules:
- Never overpay — MAO is the ceiling, not the target
- Always ask about repairs before making an offer
- A deal below $5k spread is not worth pursuing
- Strong deals have 20%+ equity after MAO

Be direct, fast, and results-oriented. Hap moves fast — match his energy.`;
  }

  // --- MAO Calculator ---

  calculateMAO(arv: number, repairs: number): DealAnalysis {
    const mao = arv * 0.7 - repairs;
    const maxOffer = Math.max(0, mao);

    let verdict: DealAnalysis["verdict"];
    const spread = arv - repairs - maxOffer;

    if (spread >= arv * 0.25) {
      verdict = "🟢 Strong Deal";
    } else if (spread >= arv * 0.1) {
      verdict = "🟡 Marginal";
    } else {
      verdict = "🔴 Pass";
    }

    return { arv, repairs, mao, maxOffer, verdict };
  }

  formatMAOResult(analysis: DealAnalysis): string {
    return [
      `${analysis.verdict}`,
      ``,
      `📊 Deal Analysis`,
      `ARV:      $${analysis.arv.toLocaleString()}`,
      `Repairs:  $${analysis.repairs.toLocaleString()}`,
      `─────────────────`,
      `MAO:      $${analysis.maxOffer.toLocaleString()}`,
      ``,
      `Formula: $${analysis.arv.toLocaleString()} × 70% − $${analysis.repairs.toLocaleString()} = $${analysis.maxOffer.toLocaleString()}`
    ].join("\n");
  }

  // --- Outreach Draft ---

  async draftOutreach(lead: Lead, channel: "sms" | "email" = "sms"): Promise<string> {
    const prompt = channel === "sms"
      ? `Draft a short, conversational SMS (under 160 chars) to a motivated seller at ${lead.address}${lead.price ? ` asking ${lead.price}` : ""}. 
         Goal: get them on the phone. Be friendly, not salesy. Sign off as "Hap".`
      : `Draft a brief email subject + body to a motivated seller at ${lead.address}. 
         Keep it under 100 words. Empathetic, professional. Sign as "Hap / HapdaInvestments".`;

    const res = await this.ask(prompt);
    return res.content;
  }

  // --- Main Handler ---

  async ask(userMessage: string): Promise<{content: string}> {
      return super.ask(userMessage);
  }

  async execute(task: string, userId?: string): Promise<string> {
      return this.handle(task);
  }

  async handle(userMessage: string): Promise<string> {
    const lower = userMessage.toLowerCase();

    // MAO quick calc — detect pattern like "arv 200k repairs 30k" or "200000 30000"
    const maoMatch = lower.match(/arv[\s:$]*(\d[\d,k]*)\s+repair[s]?[\s:$]*(\d[\d,k]*)/i) ||
                     lower.match(/(\d[\d,k]+)\s+arv.*?(\d[\d,k]+)\s+repair/i);

    if (maoMatch || lower.includes("mao") || lower.includes("calculate") && lower.includes("deal")) {
      // Try to extract numbers
      const numbers = userMessage.match(/\d[\d,]*/g)?.map(n =>
        parseInt(n.replace(/,/g, "")) * (n.toLowerCase().endsWith("k") ? 1000 : 1)
      ) ?? [];

      if (numbers.length >= 2) {
        const [arv, repairs] = numbers;
        const analysis = this.calculateMAO(arv, repairs);
        return this.formatMAOResult(analysis);
      }
    }

    // Outreach request
    if (lower.includes("outreach") || lower.includes("sms") || lower.includes("email") || lower.includes("draft")) {
      return await this.draftOutreach({ address: userMessage }, lower.includes("email") ? "email" : "sms");
    }

    // Everything else — let the AI handle with real estate context
    log(`[realEstate] Routing to AI chat: "${userMessage.slice(0, 60)}"`);
    const res = await this.ask(userMessage);
    return res.content;
  }
}

export const realEstateAgent = new RealEstateAgent();
