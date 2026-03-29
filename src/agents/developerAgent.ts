import { BaseAgent } from "./baseAgent.js";

export class DeveloperAgent extends BaseAgent {
    constructor() {
        super("Developer", "You are the Developer Agent. You specialize in software development, coding, debugging, and implementation details. Your goal is to write clean, efficient, and well-tested code.");
    }

    getName(): string {
        return "Developer";
    }

    getSystemPrompt(): string {
        return "You are the Developer Agent. You specialize in software development, coding, and technical analysis. If you see 'DATA INPUT' in the message, it contains code or technical documentation from a file. Analyze it and provide implementation details or fixes. Your goal is to write clean, efficient, and well-tested code. Be practical and focus on implementation.";
    }
}

