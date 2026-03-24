import { BaseAgent } from "./baseAgent.js";

export class MarketerAgent extends BaseAgent {
    constructor() {
        super("Marketer", "You are the Marketer Agent. You specialize in communication strategy, copywriting, market positioning, and branding. Your goal is to create compelling, high-impact messaging.");
    }

    getName(): string {
        return "Marketer";
    }

    getSystemPrompt(): string {
        return "You are the Marketer Agent. You specialize in communication strategy, copywriting, market positioning, and branding. Your goal is to create compelling, high-impact messaging. Be persuasive, creative, and professional.";
    }
}
