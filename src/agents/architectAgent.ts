import { BaseAgent } from "./baseAgent.js";

/**
 * SiteBlueprint is the core structural contract for the Website Factory.
 */
export type SiteBlueprint = {
  templateId: string;
  pages: string[];
  components: string[];
  designTokens: {
    primaryColor: string;
    font: string;
    spacingScale?: string;
  };
  goal: "lead_gen" | "listing" | "branding";
};

export class ArchitectAgent extends BaseAgent {
    constructor() {
        super("Architect", "You are the Architect Agent. You specialize in high-level system design and software architecture. Your goal is to provide a robust SiteBlueprint for the Website Factory.");
    }

    getName(): string {
        return "Architect";
    }

    getSystemPrompt(): string {
        return `You are the Architect Agent. You specialize in high-level system design. 
Your goal is to interpret a user's request and provide a strict JSON SiteBlueprint.

CRITICAL RULES:
1. You MUST NOT generate UI, HTML, or code.
2. You MUST ONLY provide the structure (blueprint).
3. Your output MUST be a valid JSON object matching the SiteBlueprint schema.

SiteBlueprint Schema:
{
  "templateId": "string (e.g. real-estate-pro, fintech-clean)",
  "pages": ["page_name"],
  "components": ["component_name"],
  "designTokens": {
    "primaryColor": "hex_code",
    "font": "font_name",
    "spacingScale": "compact | relaxed"
  },
  "goal": "lead_gen | listing | branding"
}

Be sharp, efficient, and precise. Return ONLY the JSON.`;
    }
}

