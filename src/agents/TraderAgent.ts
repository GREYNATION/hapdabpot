import { BaseAgent } from "./baseAgent.js";
import { saveMemory, getRelevantMemory } from "../memory/memoryService.js";

export class TraderAgent extends BaseAgent {
  constructor() {
    super("TraderAgent", "You are the Trader Agent. You specialize in market analysis, trading strategies, and financial decision-making. You analyze market trends, identify opportunities, and provide actionable trading insights. Be analytical, data-driven, and risk-aware.");
  }

  getName(): string {
    return "TraderAgent";
  }

  getSystemPrompt(): string {
    return "You are the Trader Agent. You specialize in market analysis, trading strategies, and financial decision-making. You analyze market trends, identify opportunities, and provide actionable trading insights. Be analytical, data-driven, and risk-aware.";
  }

  async execute(task: string, userId: string) {
    const memories = await getRelevantMemory(userId, task);

    const context = memories.map((m: any) => m.content).join("\n");

    const result = `📈 Trade Analysis:
Task: ${task}

Relevant Memory:
${context}`;

    await saveMemory(userId, this.getName(), result, {
      type: "trade_analysis"
    });

    return result;
  }
}