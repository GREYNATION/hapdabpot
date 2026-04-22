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
        const { tasks, goal, skillId } = routeResult;

        log(`[council] Goal identified: ${goal}. Triggering ${tasks.length} tasks.`);

        // 2. Load context (Memory & Skills)
        const { SKILLS } = await import("../skills.js");
        const { getRecentMessages } = await import("../memory.js");
        
        const history = getRecentMessages(chatId, 6);
        const skill = skillId ? SKILLS.find(s => s.id === skillId) : undefined;
        const skillContext = skill ? `\n\n--- SPECIALIZED SKILL ACTIVATED: ${skill.name} ---\n${skill.systemPrompt}\n-----------------------------------\n` : "";

        // 3. Execute tasks sequentially
        const responses: string[] = [];
        for (const task of tasks) {
            let success = false;
            let retries = 2;
            let lastError = "";

            while (!success && retries >= 0) {
                try {
                    const agent = this.instantiateAgent(task.agent);
                    log(`[council] Executing ${task.agent} (Retries left: ${retries})...`);
                    
                    // Inject Skill and Memory
                    const result = await agent.ask(task.task, history, skillContext ? skillContext : undefined);
                    
                    const agentName = agent.getName ? agent.getName() : task.agent;
                    responses.push(`**[${agentName}]**: ${result.content || result}`);
                    success = true;
                    
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

        // 4. Autonomous Background Wash
        this.washer.wash(chatId).catch(e => 
            log(`[council] Post-chat wash failed: ${e.message}`, "warn")
        );

        return finalOutput;
    }

    async chatWithVoice(userInput: string, chatId: number): Promise<{ text: string, voiceBuffer: Buffer | null }> {
        const textResponse = await this.chat(userInput, chatId);
        
        // Remove markdown and limit length for cleaner TTS
        const cleanText = textResponse
            .replace(/\*\*/g, "")
            .replace(/\[.*?\]/g, "")
            .substring(0, 10000); // TTS service handles larger chunks now
        
        const voiceBuffer = await generateVoice(cleanText);
        return { text: textResponse, voiceBuffer };
    }

    private instantiateAgent(type: string): any {
        const normalized = type.toLowerCase().trim();
        switch (normalized) {
            case "researcher": return new ResearcherAgent();
            case "marketer": return new MarketerAgent();
            case "developer":
            case "automation_script": return new DeveloperAgent();
            case "architect": return new ArchitectAgent();
            case "github": return new GitHubAgent();
            case "finance": return new MasterTraderAgent();
            case "content":
            case "media": return new ContentAgent();
            default: return new ResearcherAgent();
        }
    }
}
