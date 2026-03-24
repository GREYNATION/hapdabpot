import { openai, config, log } from "./config.js";
import { askAI } from "./ai.js";

/**
 * Gets a quick AI response for immediate user feedback.
 */
export async function ai(message: string): Promise<string> {
  log(`[manager] Getting instant AI response...`);
  try {
    const response = await askAI(
      message,
      "You are a helpful assistant. Provide a very brief (1-2 sentences), supportive acknowledgment of the user's request. Mention that you are starting the tasks immediately.",
      { maxTokens: 150 }
    );
    return response.content || "I'm on it! Starting your request now.";
  } catch (err: any) {
    log(`[error] Instant AI failed: ${err.message}`, "error");
    return "Got it! Starting your request now.";
  }
}

/**
 * Routes the message and creates a structured plan using specialized agents.
 */
export async function manager(input: string | any[]) {
    const isArray = Array.isArray(input);
    const text = isArray ? input.find(i => i.type === "text")?.text || "" : input;
    const lowercase = text.toLowerCase();
    
    log(`[manager] Routing input. Type: ${isArray ? 'Array' : 'String'}, Content: ${text.substring(0, 50)}...`);

    // 1. VISION PRIORITIZED
    if (isArray || lowercase.includes("visual") || lowercase.includes("image") || lowercase.includes("photo")) {
        return {
            tasks: [{ agent: "vision", task: input }]
        };
    }

    // 2. BUILD
    const isBuild = lowercase.includes("build") || lowercase.includes("create") || lowercase.includes("api") || lowercase.includes("app");
    if (isBuild) {
        return {
            tasks: [{ agent: "developer", task: input }]
        };
    }

    // 3. EMAIL
    const isEmail = lowercase.includes("email") || lowercase.includes("mail") || lowercase.includes("message");
    if (isEmail) {
        return {
            tasks: [{ agent: "email", task: input }]
        };
    }

    // 4. RESEARCH
    const isResearch = lowercase.includes("search") || lowercase.includes("who") || lowercase.includes("where") || lowercase.includes("scrape") || lowercase.includes("analyze") || lowercase.includes("check") || lowercase.includes("find");
    if (isResearch || text.length > 50) {
        return {
            tasks: [{ agent: "researcher", task: input }]
        };
    }

    return { tasks: [] };
}
