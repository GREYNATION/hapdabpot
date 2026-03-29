import { BaseAgent } from "./baseAgent.js";
import { saveMemory, getRelevantMemory } from "../memory/memoryService.js";

export class RealEstateAgent extends BaseAgent {
  constructor() {
    super("RealEstateAgent", "You are the Real Estate Agent. You specialize in property analysis, market valuation, deal evaluation, and real estate investment strategies. You help identify opportunities, analyze comparables, and make informed decisions about real estate investments. Be thorough, analytical, and market-aware.");
  }

  getName(): string {
    return "RealEstateAgent";
  }

  getSystemPrompt(): string {
    return "You are the Real Estate Agent. You specialize in property analysis, market valuation, deal evaluation, and real estate investment strategies. You help identify opportunities, analyze comparables, and make informed decisions about real estate investments. Be thorough, analytical, and market-aware.";
  }

  async execute(task: string, userId: string) {
    const memories = await getRelevantMemory(userId, task);

    const context = memories.map((m: any) => m.content).join("\n");

    const result = `ðŸ  Real Estate Analysis:
Task: ${task}

Relevant Memory:
${context}`;

    await saveMemory(userId, this.getName(), result, {
      type: "real_estate_analysis"
    });

    return result;
  }
}
