import { CommandRouter } from "../router.js";
import { ResearcherAgent } from "../../agents/researcherAgent.js";
import { MarketerAgent } from "../../agents/marketerAgent.js";
import { DeveloperAgent } from "../../agents/developerAgent.js";
import { ArchitectAgent } from "../../agents/architectAgent.js";
import { GitHubAgent } from "../../agents/githubAgent.js";
import { MasterTraderAgent } from "../../agents/MasterTraderAgent.js";
import { MemoryWasherAgent } from "../../agents/memoryWasher.js";
import { ContentAgent } from "../../agents/ContentAgent.js";
import { generateVoice } from "../../services/voiceService.js";
import { log } from "../config.js";
import { RequestQueue } from "../queue.js";

export class CouncilOrchestrator {
    private router = new CommandRouter();
    private washer = new MemoryWasherAgent();
    private queue = RequestQueue.getInstance();

    async chat(userInput: string, chatId: number): Promise<string> {
        return new Promise((resolve, reject) => {
            this.queue.enqueue(chatId, async () => {
                try {
                    const result = await this.executeChatTurn(userInput, chatId);
                    resolve(result);
                } catch (e) {
                    reject(e);
                }
            });
        });
    }

    private async executeChatTurn(userInput: string, chatId: number): Promise<string> {
        log(`[council] Processing chat turn: ${userInput.substring(0, 50)}...`);

        // 1. Route the intent
        const routeResult = await this.router.route(userInput);
        const { tasks, goal } = routeResult;

        log(`[council] Goal identified: ${goal}. Triggering ${tasks.length} tasks.`);

        // 2. Execute tasks sequentially (to avoid 429 rate limits)
        const responses: string[] = [];
        for (const task of tasks) {
            let success = false;
            let retries = 2;
            let lastError = "";

            while (!success && retries >= 0) {
                try {
                    const agent = this.instantiateAgent(task.agent);
                    log(`[council] Executing ${task.agent} (Retries left: ${retries})...`);
                    const result = await agent.ask(task.task);
                    const agentName = agent.getName ? agent.getName() : task.agent;
                    responses.push(`**[${agentName}]**: ${result.content || result}`);
                    success = true;
                    
                    // Increased delay between tasks to stay under provider rate limits
                    await new Promise(r => setTimeout(r, 2000));
                } catch (err: any) {
                    lastError = err.message;
                    retries--;
                    if (retries >= 0) {
                        const delay = (2 - retries) * 5000;
                        log(`[council] Task ${task.agent} failed: ${err.message}. Retrying in ${delay}ms...`, "warn");
                        await new Promise(r => setTimeout(r, delay));
                    }
                }
            }

            if (!success) {
                responses.push(`**[${task.agent}]** Error: ${lastError}`);
            }
        }

        const finalOutput = responses.join("\n\n") || "I processed your request but didn't generate a specific response. How else can I help?";

        // 3. Autonomous Background Wash
        this.washer.wash(chatId).catch(e => 
            log(`[council] Post-chat wash failed: ${e.message}`, "warn")
        );

        return finalOutput;
    }

    async chatWithVoice(userInput: string, chatId: number): Promise<{ text: string, voiceBuffer: Buffer }> {
        const textResponse = await this.chat(userInput, chatId);
        
        // Use a cleaned version for TTS if needed, but for now we'll use the whole response
        // Remove markdown artifacts for cleaner speech
        const cleanText = textResponse.replace(/\*\*/g, "").replace(/\[.*?\]/g, "");
        
        const voiceBuffer = await generateVoice(cleanText);
        return { text: textResponse, voiceBuffer };
    }

    private instantiateAgent(type: string): any {
        switch (type.toLowerCase()) {
            case "researcher": return new ResearcherAgent();
            case "marketer": return new MarketerAgent();
            case "developer": return new DeveloperAgent();
            case "architect": return new ArchitectAgent();
            case "github": return new GitHubAgent();
            case "finance": return new MasterTraderAgent();
            case "content":
            case "media": return new ContentAgent();
            default: return new ResearcherAgent(); // Fallback to Ops Intelligence
        }
    }
}
