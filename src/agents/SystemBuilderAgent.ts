import { log, config } from "../core/config.js";
import { BaseAgent } from "./baseAgent.js";
import { generateSystemConfig, saveClientSystem, formatTelegramSummary } from "../services/systemBuilder.service.js";
import { anthropic } from "../core/config.js";

export interface SystemBuildRequest {
  rawInput: string;        // e.g. "roofing company, Dallas TX, 3 agents"
  telegramUserId: number;
  chatId: number;
}

export interface ParsedClientIntake {
  businessName: string;
  industry: string;
  location: string;
  tier: "STARTER" | "PRO" | "HADES";
  agents: AgentType[];
  leadSources: string[];
  monthlyPrice: number;
  setupFee: number;
}

export type AgentType = "CSR" | "ASSISTANT" | "OFFICE_MGR" | "SALES_REP";

const TIER_PRICING = {
  STARTER: { monthly: 497, setup: 997, agents: ["CSR", "ASSISTANT"] as AgentType[] },
  PRO:     { monthly: 997, setup: 1997, agents: ["CSR", "ASSISTANT", "OFFICE_MGR", "SALES_REP"] as AgentType[] },
  HADES:   { monthly: 1997, setup: 3997, agents: ["CSR", "ASSISTANT", "OFFICE_MGR", "SALES_REP"] as AgentType[] },
};

const SYSTEM_PROMPT = `You are SystemBuilderAgent, an AI that designs and configures autonomous AI agent systems for small businesses.

Given a business description, extract and return ONLY valid JSON (no markdown, no explanation) in this exact format:
{
  "businessName": "string (infer or use 'Client' if unknown)",
  "industry": "string (e.g. Roofing, HVAC, Real Estate, Dental, etc.)",
  "location": "string (city, state or 'Not specified')",
  "tier": "STARTER | PRO | HADES",
  "agents": ["CSR", "ASSISTANT", "OFFICE_MGR", "SALES_REP"] (include only what fits the business),
  "leadSources": ["array of relevant lead sources for this industry"],
  "csr_script_opening": "string (first 2 sentences the CSR bot says when answering a call)",
  "sales_rep_script_opening": "string (first 2 sentences the Sales Rep bot says when calling a lead)",
  "recommended_tools": ["list of free/open source tools that fit this business"],
  "roi_pitch": "string (2-3 sentence ROI pitch for this specific business)"
}

Tier logic:
- STARTER: 1-5 employees, mainly needs inbound call + chat coverage
- PRO: 5-20 employees, needs inbound + outbound calling to follow up leads
- HADES: 20+ employees or high lead volume, needs full funnel automation

Always include CSR and ASSISTANT. Add OFFICE_MGR and SALES_REP for PRO and HADES tiers.`;

export class SystemBuilderAgent extends BaseAgent {
  constructor() {
    super("SystemBuilder", SYSTEM_PROMPT);
  }

  getName(): string {
    return "SystemBuilder";
  }

  async handle(input: string, userId: number = 0, chatId: number = 0): Promise<string> {
    return this.run({
      rawInput: input,
      telegramUserId: userId,
      chatId: chatId
    });
  }

  async run(request: SystemBuildRequest): Promise<string> {
    try {
      log(`[SystemBuilderAgent] Starting build for: ${request.rawInput}`);
      
      // Step 1: Parse the client intake with Claude
      const intake = await this.parseIntake(request.rawInput);

      // Step 2: Generate full system config
      const systemConfig = generateSystemConfig(intake);

      // Step 3: Save to Supabase
      const clientId = await saveClientSystem({
        intake,
        systemConfig,
        createdBy: request.telegramUserId,
      });

      // Step 4: Format Telegram response
      const summary = formatTelegramSummary(intake, systemConfig, clientId);

      return summary;
    } catch (error: any) {
      log(`[SystemBuilderAgent] Error: ${error.message}`, "error");
      return `❌ **SystemBuilderAgent Error**: ${error.message}`;
    }
  }

  private async parseIntake(rawInput: string): Promise<ParsedClientIntake & {
    csr_script_opening: string;
    sales_rep_script_opening: string;
    recommended_tools: string[];
    roi_pitch: string;
  }> {
    if (!anthropic) throw new Error("Anthropic client not initialized. Check your API key.");

    const response = await anthropic.messages.create({
      model: config.anthropicModel, // Use the configured model
      max_tokens: 1000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: rawInput }],
    });

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("");

    const parsed = JSON.parse(text.trim());

    // Enrich with pricing
    const pricing = TIER_PRICING[parsed.tier as keyof typeof TIER_PRICING] || TIER_PRICING.PRO;

    return {
      ...parsed,
      agents: parsed.agents || pricing.agents,
      monthlyPrice: pricing.monthly,
      setupFee: pricing.setup,
    };
  }
}

export const systemBuilderAgent = new SystemBuilderAgent();
