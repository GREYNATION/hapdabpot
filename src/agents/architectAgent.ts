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
    uiStyle?: string; // New: 67 styles from UI/UX Pro Max
    colorPalette?: string; // New: 161 industry palettes
  };
  goal: "lead_gen" | "listing" | "branding" | "conversion" | "showcase";
};

export class ArchitectAgent extends BaseAgent {
    constructor() {
        super("Architect", "You are the Architect Agent. You specialize in high-level system design and software architecture. Your goal is to provide a robust SiteBlueprint for the Website Factory.");
    }

    getName(): string {
        return "Architect";
    }

    getSystemPrompt(): string {
        return `You are the Architect Agent. You specialize in high-level system design and high-end UI/UX architecture.
Your goal is to interpret a user's request and provide a strict JSON SiteBlueprint optimized for conversion and premium aesthetics.

UI/UX INTELLIGENCE (PRO MAX):
You have access to 67 specialized UI styles and 161 industry-specific reasoning rules.
- Recommended Styles: Glassmorphism, Bento Grid, Neubrutalism, Soft UI Evolution, Minimalist Swiss, Aurora UI, etc.
- Goal: Create a "Master Source of Truth" for the design system.

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
    "font": "Google Font Pairing Name",
    "spacingScale": "compact | relaxed",
    "uiStyle": "One of 67 styles (e.g. Bento Grid, Glassmorphism)",
    "colorPalette": "Industry category (e.g. Fintech, Healthcare, SaaS)"
  },
  "goal": "lead_gen | listing | branding | conversion | showcase"
}

Be sharp, efficient, and precise. Return ONLY the JSON.
`;
    }
}
