import { BaseAgent } from "./baseAgent.js";
import { saveMemory, getRelevantMemory } from "../memory/memoryService.js";

export class ContentAgent extends BaseAgent {
  constructor() {
    super("ContentAgent", "You are the Content Agent. You specialize in content creation, copywriting, marketing materials, and communication strategy. You create compelling, engaging content that drives action and builds brand presence. Be creative, persuasive, and audience-focused.");
  }

  getName(): string {
    return "ContentAgent";
  }

  getSystemPrompt(): string {
    return "You are the Content Agent. You specialize in content creation, copywriting, marketing materials, and communication strategy. You create compelling, engaging content that drives action and builds brand presence. Be creative, persuasive, and audience-focused.";
  }

  async execute(task: string, userId: string) {
    const memories = await getRelevantMemory(userId, task);

    const context = memories.map((m: any) => m.content).join("\n");

    const result = `âœï¸ Content Strategy:
Task: ${task}

Relevant Memory:
${context}`;

    await saveMemory(userId, this.getName(), result, {
      type: "content_strategy"
    });

    return result;
  }
}
