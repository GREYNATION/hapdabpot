import { BaseAgent } from "./baseAgent.js";
import { log } from "../core/config.js";

// Types
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
  source?: string;
  notes?: string;
}

export class RealEstateAgent extends BaseAgent {
  constructor() {
    super(
      "RealEstateAgent",
      "You are HapdaBot's Real Estate Wholesaling Agent, a specialist in finding and closing off-market deals. " +
      "Your markets are South Jersey, Brooklyn, and Philadelphia. " +
      "Core responsibilities: find motivated sellers and distressed properties, " +
      "analyze deals using MAO formula (ARV x 70% minus Repairs), " +
      "draft seller outreach (SMS/email) that converts, " +
      "and manage the wholesaling pipeline from lead to contract. " +
      "Key rules: never overpay (MAO is the ceiling), always ask about repairs before making an offer, " +
      "a deal below $5k spread is not worth pursuing. " +
      "Be direct, fast, and results-oriented."
    );
  }

  getName(): string {
    return "RealEstateAgent";
  }

  getSystemPrompt(): string {
    return "You are HapdaBot's Real Estate Wholesaling Agent, a specialist in finding and closing off-market deals. " +
      "Your markets are South Jersey, Brooklyn, and Philadelphia. " +
      "Core responsibilities: find motivated sellers and distressed properties, " +
      "analyze deals using MAO formula (ARV x 70% minus Repairs), " +
      "draft seller outreach (SMS/email) that converts, " +
      "and manage the wholesaling pipeline from lead to contract. " +
      "Key rules: never overpay (MAO is the ceiling), always ask about repairs before making an offer, " +
      "a deal below $5k spread is not worth pursuing. " +
      "Be direct, fast, and results-oriented.";
  }

  calculateMAO(arv: number, repairs: number): DealAnalysis {
    const mao = arv * 0.7 - repairs;
    const maxOffer = Math.max(0, mao);
    const spread = arv - repairs - maxOffer;

    let verdict: string;
    if (spread >= arv * 0.25) {
      verdict = "Strong Deal";
    } else if (spread >= arv * 0.1) {
      verdict = "Marginal";
    } else {
      verdict = "Pass";
    }

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
      "Formula: $" + analysis.arv.toLocaleString() + " x 70% - $" + analysis.repairs.toLocaleString() + " = $" + analysis.maxOffer.toLocaleString()
    );
  }

  async draftOutreach(lead: Lead, channel: "sms" | "email" = "sms"): Promise<string> {
    const prompt = channel === "sms"
      ? "Draft a short conversational SMS under 160 chars to a motivated seller at " + lead.address + ". Goal: get them on the phone. Be friendly, not salesy. Sign off as Hap."
      : "Draft a brief email subject and body to a motivated seller at " + lead.address + ". Keep it under 100 words. Empathetic, professional. Sign as Hap / HapdaInvestments.";

    const res = await this.ask(prompt);
    return res.content;
  }

  async handle(userMessage: string): Promise<string> {
    const lower = userMessage.toLowerCase();

    // MAO quick calc detection
    const numbers = userMessage.match(/\d[\d,]*/g)?.map(n =>
      parseInt(n.replace(/,/g, ""))
    ) ?? [];

    if (
      (lower.includes("mao") || lower.includes("arv") || (lower.includes("calculate") && lower.includes("deal"))) &&
      numbers.length >= 2
    ) {
      const [arv, repairs] = numbers;
      const analysis = this.calculateMAO(arv, repairs);
      return this.formatMAOResult(analysis);
    }

    // Outreach request
    if (lower.includes("outreach") || lower.includes("draft") || lower.includes("sms") || lower.includes("email")) {
      return await this.draftOutreach({ address: userMessage }, lower.includes("email") ? "email" : "sms");
    }

    log(`[realEstate] Routing to AI chat: "${userMessage.slice(0, 60)}"`);
    const res = await this.ask(userMessage);
    return res.content;
  }
}

export const realEstateAgent = new RealEstateAgent();
