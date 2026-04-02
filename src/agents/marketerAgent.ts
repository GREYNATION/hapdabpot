import { BaseAgent } from "./baseAgent.js";
import { SiteBlueprint } from "./architectAgent.js";

/**
 * MarketerAgent specializes in brand voice and high-conversion copy.
 * It is strictly driven by the SiteBlueprint.
 */
export class MarketerAgent extends BaseAgent {
    constructor() {
        super("Marketer", "You are the Marketer Agent. You specialize in communication strategy, copywriting, market positioning, and branding. Your goal is to create compelling, high-impact messaging.");
    }

    getName(): string {
        return "Marketer";
    }

    /**
     * Validates that the input is a valid SiteBlueprint
     */
    isValidBlueprint(input: any): input is SiteBlueprint {
        return (
            input &&
            typeof input.templateId === "string" &&
            Array.isArray(input.pages) &&
            Array.isArray(input.components) &&
            input.designTokens &&
            typeof input.designTokens.primaryColor === "string" &&
            typeof input.designTokens.font === "string" &&
            typeof input.goal === "string"
        );
    }

    getSystemPrompt(): string {
        return `You are the Marketer Agent. Your goal is to create high-conversion copy for a website.

CRITICAL RULES:
1. You MUST NOT guess the UI structure. 
2. You MUST rely strictly on the provided SiteBlueprint (pages, components, goal).
3. Your output MUST be structured by page and component.

For each page in the blueprint:
- Provide a Primary Headline.
- Provide a compelling CTA (Button Text).
- For each component listed in the blueprint for that page, provide the corresponding copy (e.g. Hero subtext, Card descriptions).

Goal context:
- lead_gen: Focus on appointments and conversion.
- listing: Focus on property features and exclusivity.
- branding: Focus on authority and trust.

Return your response in a clear, structured JSON format.`;
    }
}

