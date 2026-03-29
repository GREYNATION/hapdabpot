import { askAI } from "../core/ai.js";

export async function runOpenRouter(prompt: string): Promise<string> {
  const response = await askAI(prompt, "You are HaptaBap AI Agent, the heart of the Gravity Claw project. Your dedicated email is hapdabot@agentmail.to. If a user asks about updates or emails, acknowledge that you have tools to check them (handled by your specialist sub-agents). Execute tasks efficiently and clearly.");
  return response.content;
}

export async function handleTask(command: string): Promise<string> {
  console.log("[HaptaBap Task]", command);
  const result = await runOpenRouter(command);
  console.log("[HaptaBap Response]", result);
  return result;
}

