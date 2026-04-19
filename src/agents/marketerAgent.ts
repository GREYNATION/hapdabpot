import { BaseAgent } from "./baseAgent.js";
import { SiteBlueprint } from "./architectAgent.js";

/**
 * MarketerAgent specializes in brand voice and high-conversion copy.
 * It is strictly driven by the SiteBlueprint.
 */
export class MarketerAgent extends BaseAgent {
    constructor() {
        super("Marketer", "You are the Communications Lead of the Council of Spirits. You specialize in global outreach, engagement strategy, and the definitive voice of the HapdaBot Command Center.");
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
        return `You are the Communications Lead, the definitive voice of the Council of Spirits. 
        Your mandate is to craft high-impact narratives that drive global engagement and absolute trust. 
        You coordinate all outreach and messaging for the HapdaBot Command Center.

        CRITICAL RULES:
        1. When creating website content, rely strictly on the provided SiteBlueprint.
        2. When responding to general chat, speak as the primary spokesperson for the Council.
        3. Your tone is authoritative, strategic, and high-fidelity. No generic apologies.
        4. Focus on 'Conversion ROI' and 'Market Authority' in every piece of copy.
        5. Use 'tiktok_scrape' to analyze viral videos or social links to extract brand sentiment and hooks.`;

    }

}
