import { CommandRouter } from "../router.js";
import { ResearcherAgent } from "../../agents/researcherAgent.js";
import { MarketerAgent } from "../../agents/marketerAgent.js";
import { DeveloperAgent } from "../../agents/developerAgent.js";
import { ArchitectAgent } from "../../agents/architectAgent.js";
import { GitHubAgent } from "../../agents/githubAgent.js";
import { MasterTraderAgent } from "../../agents/MasterTraderAgent.js";
import { MemoryWasherAgent } from "../../agents/memoryWasher.js";
import { ContentAgent } from "../../agents/ContentAgent.js";
import { GameStudioAgent } from "../../agents/gameStudioAgent.js";
import { generateVoice } from "../../services/voiceService.js";
import { log } from "../config.js";
import { RequestQueue } from "../queue.js";
import { WikiService } from "../../services/wikiService.js";
import { askAI } from "../ai.js";
import { isDramaCommand, routeToDramaAgent } from "../../agents/drama/DramaAgent.js";
import { HermesAgent } from "../../agents/hermesAgent.js";
import { AthenaAgent } from "../../agents/athenaAgent.js";
import { AresAgent } from "../../agents/aresAgent.js";
import { AtlasAgent } from "../../agents/atlasAgent.js";
import { HephaestusAgent } from "../../agents/hephaestusAgent.js";
import { TaskPlan, TaskNode } from "../planner.js";
import { updateTaskInDB, updatePlanStatus } from "../taskMemory.js";

import { unpackContent } from "../unpack.js";

const COUNCIL_MASTER_PERSONA = `
You are the Hapdabot Council, the elite "Spirit Brain" orchestrating the wholesale real estate and content empire of Hap Hustlehard.
You operate with a high-end executive tone—precise, authoritative, yet slightly mystical.
You refer to your knowledge base as "The Spirit Memory" or "Spirit Wiki".
Your goal is to provide maximum leverage and intelligence.
Always use appropriate executive icons (🤖, 🌅, 📅, 📩, 🏗️, 🔔, ⚠️) to structure your thoughts.
`;

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

        // Fast-path: Direct routing for explicit command prefixes
        if (userInput.startsWith("[GAME STUDIO REQUEST]")) {
            const cleanInput = userInput.replace("[GAME STUDIO REQUEST]", "").trim();
            log(`[council] Fast-path: routing to GameStudioAgent`);
            const agent = new GameStudioAgent();
            const { getRecentMessages } = await import("../memory.js");
            const history = getRecentMessages(chatId, 6);
            const hotCache = WikiService.getHotCache();
            const masterContext = `\n--- RECENT SPIRIT MEMORY (HOT CACHE) ---\n${hotCache}\n---------------------------------------\n`;
            const result = await agent.ask(cleanInput, history, masterContext);
            return `**[Game Studio]**: ${unpackContent(result)}`;
        }

        if (userInput.startsWith("[LIBRARIAN ARCHIVE]")) {
            const cleanInput = userInput.replace("[LIBRARIAN ARCHIVE]", "").trim();
            log(`[council] Fast-path: routing to Researcher (Librarian)`);
            const agent = new ResearcherAgent();
            const { getRecentMessages } = await import("../memory.js");
            const history = getRecentMessages(chatId, 6);
            const hotCache = WikiService.getHotCache();
            const { getSkill } = await import("../skills.js");
            const skill = getSkill("knowledge-librarian");
            const masterContext = `\n--- RECENT SPIRIT MEMORY (HOT CACHE) ---\n${hotCache}\n---------------------------------------\n\n--- SPECIALIZED SKILL ACTIVATED: ${skill?.name} ---\n${skill?.systemPrompt}\n-----------------------------------\n`;
            const result = await agent.ask(`ARCHIVE THIS CONTENT: ${cleanInput}`, history, masterContext);
            return unpackContent(result);
        }

        if (userInput.startsWith("[LIBRARIAN SEARCH]")) {
            const cleanInput = userInput.replace("[LIBRARIAN SEARCH]", "").trim();
            log(`[council] Fast-path: routing to Researcher (Librarian Search)`);
            const agent = new ResearcherAgent();
            const { getRecentMessages } = await import("../memory.js");
            const history = getRecentMessages(chatId, 6);
            const hotCache = WikiService.getHotCache();
            const masterContext = `\n--- RECENT SPIRIT MEMORY (HOT CACHE) ---\n${hotCache}\n---------------------------------------\n\nYour task is to search the LOCAL library and the web to answer this query. Use 'wiki_search' and 'wiki_read' first.`;
            const result = await agent.ask(cleanInput, history, masterContext);
            return unpackContent(result);
        }

        // --- DRAMA FAST-PATH (GILDED CLAWS) ---
        if (isDramaCommand(userInput)) {
            log(`[council] Drama Intent detected. Routing to DramaAgent.`);
            try {
                return await routeToDramaAgent(userInput, String(chatId));
            } catch (err: any) {
                log(`[council] Drama Route failed: ${err.message}`, "error");
                // Fall back to normal routing if drama agent fails
            }
        }

        // --- SKILLS DISCOVERY ---
        if (userInput.startsWith("/skills") || userInput.startsWith("/capabilities")) {
            log(`[council] Skills discovery requested.`);
            const { SKILLS } = await import("../skills.js");
            const list = SKILLS
                .filter(s => !s.id.startsWith("claude-") && !s.id.startsWith("superpower-"))
                .map(s => `âœ¨ **${s.name}** (\`${s.id}\`)\n   _${s.description}_`)
                .join("\n\n");
            
            return `ðŸ”’ **Spirit Capabilities Registry**\n\n${list}\n\n_Tip: I automatically activate these based on your intent. You can also force one using its ID._`;
        }

        // --- RESUME COMMAND ---
        if (userInput.startsWith("/resume")) {
            const planId = userInput.replace("/resume", "").trim();
            if (!planId) return "âš ï¸  Please specify a Plan ID to resume. (e.g., /resume plan_123)";
            
            log(`[council] Resume intent detected for plan: ${planId}`);
            const { getPlan, getTasksForPlan } = await import("../taskMemory.js");
            const { getRecentMessages } = await import("../memory.js");
            const plan: any = getPlan(planId);
            if (!plan) return `❌ Plan ${planId} not found in Spirit Memory.`;
            
            const tasks = getTasksForPlan(planId);
            const taskPlan: TaskPlan = {
                id: plan.id,
                goal: plan.goal,
                nodes: tasks.map((t: any) => ({
                    id: t.id,
                    agent: t.agent,
                    task: t.task,
                    status: t.status,
                    result: t.result,
                    dependsOn: t.dependsOn
                })),
                createdAt: plan.created_at
            };

            const history = getRecentMessages(chatId, 6);
            const hotCache = WikiService.getHotCache();
            const masterContext = `
${COUNCIL_MASTER_PERSONA}

--- RECENT SPIRIT MEMORY (HOT CACHE) ---
${hotCache}
---------------------------------------
[RESUMING PLAN: ${planId}]
`;

            return await this.executePlan(taskPlan, history, masterContext);
        }

        // 1. Route the intent
        const routeResult = await this.router.route(userInput);
        const { tasks, goal, skillId } = routeResult;

        log(`[council] Goal identified: ${goal}.`);

        // 2. Load context (Memory & Skills)
        const { SKILLS } = await import("../skills.js");
        const { getRecentMessages } = await import("../memory.js");
        
        const history = getRecentMessages(chatId, 6);
        const hotCache = WikiService.getHotCache();
        
        const skill = skillId ? SKILLS.find(s => s.id === skillId) : undefined;
        const skillContext = skill ? `\n\n--- SPECIALIZED SKILL ACTIVATED: ${skill.name} ---\n${skill.systemPrompt}\n-----------------------------------\n` : "";
        
        const masterContext = `
${COUNCIL_MASTER_PERSONA}

--- RECENT SPIRIT MEMORY (HOT CACHE) ---
${hotCache}
---------------------------------------
${skillContext}
`;

        // 3. Execute plan (DAG or Sequential)
        let finalOutput = "";

        if (routeResult.plan) {
            finalOutput = await this.executePlan(routeResult.plan, history, masterContext);
        } else {
            // Fallback for linear tasks if no plan generated
            const responses: string[] = [];
            let executionContext = ""; 
            for (const task of tasks) {
                try {
                    const agent = this.instantiateAgent(task.agent);
                    const enrichedTask = executionContext 
                        ? `[CONTEXT FROM PREVIOUS AGENTS]\n${executionContext}\n\n[YOUR TASK]\n${task.task}`
                        : task.task;
                    const result = await agent.ask(enrichedTask, history, masterContext);
                    const content = unpackContent(result);
                    const agentName = agent.getName ? agent.getName() : task.agent;
                    responses.push(`**[${agentName}]**: ${content}`);
                    executionContext += `\n--- Output from ${agentName} ---\n${content}\n`;
                } catch (e: any) {
                    responses.push(`**[${task.agent}]** Error: ${e.message}`);
                }
            }
            finalOutput = responses.join("\n\n");
        }

        if (!finalOutput) {
            finalOutput = "I processed your request but didn't generate a specific response. How else can I help?";
        }

        // 4. Autonomous Background Wash
        this.washer.wash(chatId).catch(e => 
            log(`[council] Post-chat wash failed: ${e.message}`, "warn")
        );
        
        // 5. Update Spirit Brain (Wiki)
        if (finalOutput.length > 200) {
            this.updateWikiAsync(userInput, finalOutput, chatId).catch(e => 
                log(`[council] Wiki update failed: ${e.message}`, "warn")
            );
        }

        return finalOutput;
    }

    async chatWithVoice(userInput: string, chatId: number): Promise<{ text: string, voiceBuffer: Buffer | null }> {
        const textResponse = await this.chat(userInput, chatId);
        
        // Remove markdown and limit length for cleaner TTS
        const cleanText = textResponse
            .replace(/\*\*/g, "")
            .replace(/\[.*?\]/g, "")
            .replace(/#+ /g, "")
            .replace(/```[\s\S]*?```/g, "(code block omitted)")
            .substring(0, 2000); // Keep voice short and snappy
        
        const voiceBuffer = await generateVoice(cleanText);
        return { text: textResponse, voiceBuffer };
    }

    private instantiateAgent(type: string): any {
        const normalized = type.toLowerCase().trim();
        switch (normalized) {
            case "hermes": return new HermesAgent();
            case "athena": return new AthenaAgent();
            case "ares": return new AresAgent();
            case "atlas": return new AtlasAgent();
            case "hephaestus": return new HephaestusAgent();
            case "researcher": return new HermesAgent();
            case "marketer": return new AresAgent();
            case "developer":
            case "automation_script": return new HephaestusAgent();
            case "architect": return new AthenaAgent();
            case "github": return new GitHubAgent();
            case "finance": return new AthenaAgent();
            case "content":
            case "media": return new AresAgent();
            case "gamestudio":
            case "game_studio":
            case "game": return new GameStudioAgent();
            default: return new HermesAgent();
        }
    }

    private async executePlan(plan: TaskPlan, history: any[], masterContext: string): Promise<string> {
        log(`[orchestrator] Executing plan: ${plan.goal} with ${plan.nodes.length} nodes.`);
        
        const responses: string[] = [];
        const completedNodes = new Map<string, string>(); // id -> result
        const retryCounts = new Map<string, number>(); // id -> count
        const MAX_RETRIES = 2;

        // Initialize completedNodes from existing plan if resuming
        for (const node of plan.nodes) {
            if (node.status === 'completed' && node.result) {
                completedNodes.set(node.id, node.result);
                const agentName = node.agent; // Best guess if we don't have name
                responses.push(`**[${agentName}] (Restored)**: ${node.result.substring(0, 100)}...`);
            }
        }

        while (plan.nodes.some(n => n.status === 'pending' || n.status === 'running' || n.status === 'failed')) {
            const readyNodes = plan.nodes.filter(n => {
                const isReady = (n.status === 'pending' || n.status === 'failed') && 
                                (n.dependsOn || []).every(depId => completedNodes.has(depId));
                
                // If it's failed, only retry if we haven't exceeded MAX_RETRIES
                if (n.status === 'failed') {
                    const count = retryCounts.get(n.id) || 0;
                    return isReady && count < MAX_RETRIES;
                }
                return isReady;
            });

            if (readyNodes.length === 0) {
                if (plan.nodes.some(n => n.status === 'running')) {
                    await new Promise(r => setTimeout(r, 1000));
                    continue;
                } else {
                    // No nodes are ready and none are running. Check if all are completed or some are permanently failed.
                    const allDone = plan.nodes.every(n => n.status === 'completed');
                    if (allDone) break;
                    
                    log(`[orchestrator] Plan stalled or permanently failed.`, "error");
                    break;
                }
            }

            // Execute ready nodes in parallel
            await Promise.all(readyNodes.map(async (node) => {
                const currentStatus = node.status;
                node.status = 'running';
                updateTaskInDB(node.id, 'running');

                try {
                    const agent = this.instantiateAgent(node.agent);
                    const attempt = (retryCounts.get(node.id) || 0) + 1;
                    log(`[orchestrator] Executing node ${node.id} with ${node.agent} (Attempt ${attempt})...`);
                    
                    let dependencyContext = "";
                    if (node.dependsOn && node.dependsOn.length > 0) {
                        dependencyContext = "\n--- CONTEXT FROM PREVIOUS STEPS ---\n";
                        for (const depId of node.dependsOn) {
                            const result = completedNodes.get(depId);
                            if (result) {
                                dependencyContext += `[Output from ${depId}]:\n${result}\n`;
                            }
                        }
                        dependencyContext += "-----------------------------------\n";
                    }

                    const enrichedTask = dependencyContext 
                        ? `${dependencyContext}\n[YOUR TASK]\n${node.task}`
                        : node.task;

                    const result = await agent.ask(enrichedTask, history, masterContext);
                    const content = unpackContent(result);
                    
                    node.status = 'completed';
                    node.result = content;
                    completedNodes.set(node.id, content);
                    
                    // PERSIST: Update task result
                    updateTaskInDB(node.id, 'completed', content);
                    
                    const agentName = agent.getName ? agent.getName() : node.agent;
                    responses.push(`**[${agentName}]**: ${content}`);
                } catch (err: any) {
                    const count = (retryCounts.get(node.id) || 0) + 1;
                    retryCounts.set(node.id, count);
                    
                    log(`[orchestrator] Node ${node.id} failed (Attempt ${count}): ${err.message}`, "error");
                    
                    if (count < MAX_RETRIES) {
                        node.status = 'failed'; // Mark as failed to allow retry in next loop iteration
                        updateTaskInDB(node.id, 'failed', undefined, `Attempt ${count} failed: ${err.message}`);
                    } else {
                        node.status = 'failed'; // Permanent fail
                        updateTaskInDB(node.id, 'failed', undefined, `Final attempt ${count} failed: ${err.message}`);
                        responses.push(`**[${node.agent}]** Permanent Failure: ${err.message}`);
                    }
                }
            }));
        }

        // Final Plan Status Update
        const failed = plan.nodes.some(n => n.status === 'failed' && !completedNodes.has(n.id));
        updatePlanStatus(plan.id, failed ? 'failed' : 'completed');

        return responses.join("\n\n") || "Plan execution yielded no output.";
    }

    public async resumePlan(planId: string, history: any[], masterContext: string): Promise<string> {
        const { getPlan, getTasksForPlan } = await import("../taskMemory.js");
        const plan: any = getPlan(planId);
        if (!plan) throw new Error("Plan not found");
        
        const tasks = getTasksForPlan(planId);
        const taskPlan: TaskPlan = {
            id: plan.id,
            goal: plan.goal,
            nodes: tasks.map((t: any) => ({
                id: t.id,
                agent: t.agent,
                task: t.task,
                status: t.status,
                result: t.result,
                dependsOn: t.dependsOn
            })),
            createdAt: plan.created_at
        };

        return this.executePlan(taskPlan, history, masterContext);
    }

    private async updateWikiAsync(input: string, output: string, chatId: number) {
        const summaryPrompt = `Summarize this interaction for a "Hot Cache" (recent memory). Focus on key outcomes and data.
User: ${input}
Council: ${output.substring(0, 500)}...`;

        const summaryRes = await askAI(summaryPrompt, "You are a concise memory summary agent.", { model: "google/gemini-2.0-flash-001" });
        const summary = summaryRes.content || "Interaction processed.";

        await WikiService.updateHotCache(summary);

        if (output.length > 500) {
            const title = `Chat_${new Date().getTime()}`;
            await WikiService.saveNote(title, `## Interaction\n\n**User**: ${input}\n\n**Council**:\n${output}`, 'sources');
        }
    }
}
