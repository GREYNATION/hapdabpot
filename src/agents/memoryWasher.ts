import { BaseAgent } from "./baseAgent.js";
import { getRecentMessages } from "../core/memory.js";
import { HiveMind } from "../core/hiveMind.js";
import { log } from "../core/config.js";

export class MemoryWasherAgent extends BaseAgent {
    constructor() {
        super("MemoryWasher", `
            You are the Memory Washer. Your job is to analyze recent conversation logs and extract persistent intelligence for the 'Hive Mind'.
            
            Focus on these three hierarchies:
            1. Pinned Facts (memory/pinned/): Permanent ground truths (e.g., 'User lives in Houston', 'Preferred model is Llama-3').
            2. Long-term Historical (memory/long_term/): Lessons learned (e.g., 'We tried scraping Zillow and it blocked us').
            3. Active Intent (hive/state.json): What is happening right now and what are the next steps?
            
            Rules:
            - Be concise. Use the Hive Mind tools: 'update_hive_mind' for Active Intent, and 'pin_fact' for Pinned Facts.
        `);
    }

    getName(): string { return "MemoryWasher"; }
    getSystemPrompt(): string { return this.systemPrompt; }

    /**
     * Washes the recent history and updates the Hive Mind state.
     */
    async wash(chatId: number) {
        log(`[memory-washer] Washing session for chat ${chatId}...`);
        
        const history = getRecentMessages(chatId, 30);
        if (history.length === 0) return;

        const historyStr = history.map(h => `${h.role.toUpperCase()}: ${h.content}`).join("\n");
        
        const prompt = `Analyze this conversation history and update the Hive Mind with any new pinned facts or objective updates:\n\n${historyStr}`;
        
        try {
            await this.ask(prompt);
            log(`[memory-washer] Session washed and Hive Mind synchronized.`);
        } catch (e: any) {
            log(`[memory-washer] Washing failed: ${e.message}`, "error");
        }
    }
}
