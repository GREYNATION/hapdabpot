import { BaseAgent } from "./baseAgent.js";

export class ArchitectAgent extends BaseAgent {
    constructor() {
        super("Architect", "You are the Architect Agent. You specialize in high-level system design, infrastructure planning, and software architecture. Your goal is to provide robust, scalable, and efficient architectural recommendations.");
    }

    getName(): string {
        return "Architect";
    }

    getSystemPrompt(): string {
        return "You are the Architect Agent. You specialize in high-level system design, infrastructure planning, and software architecture. Your goal is to provide robust, scalable, and efficient architectural recommendations. Be sharp, efficient, and technical.";
    }
}

