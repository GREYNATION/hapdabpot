import { config, log, logToOpsConsole } from "../core/config.js";
import { sanitizeHTML } from '../core/telegramUtils.js';
import { askAI } from "../core/ai.js";
import { HiveMind } from "../core/hiveMind.js";
import { SearchOrchestrator, getDb } from "../core/memory.js";
import { callMCPTool } from "../core/mcp.js";
import { unpackContent } from "../core/unpack.js";
import { CrmManager } from "../core/crm.js";
import { WikiManager } from "../core/wikiManager.js";
import * as fs from "fs";


export interface AgentResponse {
    content: string;
    tool_calls?: any[];
}

export abstract class BaseAgent {
    protected model: string;
    protected systemPrompt: string;
    protected _agentProvider?: "groq" | "openrouter" | "anthropic";

    constructor(name: string, systemPrompt: string) {
        if (config.aiProvider === "groq") {
            this.model = config.groqModel;
        } else if (config.aiProvider === "openrouter") {
            if (config.freeTierOnly) {
                // Force Groq for free tier to avoid XML tool-call issues on OpenRouter
                this.model = config.groqModel || "llama-3.3-70b-versatile";
                this._agentProvider = "groq";
                log(`[agent] ${name} forced to Groq due to Free Tier restrictions.`);
            } else {
                this.model = "meta-llama/llama-3.3-70b-instruct:free";
            }
        } else {
            this.model = config.openaiModel;
        }
        
        // Inject Superpower Rules globally
        const superpowerRules = `
# Superpower Skills Rules
1. **Brainstorming (Design Gate)**: ALWAYS brainstorm before starting new features. Ask ONE question at a time.
2. **Systematic Debugging**: Gather evidence, trace data, and test hypotheses. Never guess.
3. **Test-Driven Development**: Create reproduction scripts before fixes.
4. **Claude Agentic Skills (Chief of Staff)**: You have access to specialized meta-skills:
   - **AgentHub**: Use \`/agenthub search <intent>\` to find the best expert/tool for a task.
   - **Evaluation**: Use \`/evaluate <options>\` or \`/tradeoffs <path>\` for strategic decisions.
   - **Orchestration**: Use \`/orchestrate <mission>\` to break down massive tasks into multi-agent workflows.
`;
        this.systemPrompt = `${systemPrompt}\n\n${superpowerRules}`;
    }

    public async execute(task: string, context?: any): Promise<string> {
        log(`[agent] ${this.getName()} executing orchestrated task: ${task}`);
        await this.logStatus(`Activating logic for: ${task.substring(0, 50)}...`, "EXECUTION", 10, "status");
        
        // Dynamic Tool Selection: Load tools for the specific skill if provided
        let activeTools: any[] = [];
        if (context?.skillId) {
            const { skills } = await import("../orchestration/skillRegistry.js");
            const skill = skills.find(s => s.id === context.skillId);
            if (skill && skill.tools) {
                log(`[agent] Loading tools for skill ${context.skillId}: ${skill.tools.join(", ")}`);
                activeTools = this.mapToolsByName(skill.tools);
            }
        }

        // Enhance system prompt with collaboration context if available
        let systemOverride = this.getSystemPrompt();
        if (context) {
            systemOverride += `\n\n--- ORCHESTRATION CONTEXT ---
Original Query: ${context.originalQuery}
Plan ID: ${context.planId}
Active Skill: ${context.skillId || "N/A"}
Current Task: ${task}
--- PREVIOUS STEP RESULTS ---
${JSON.stringify(context.results, null, 2)}
------------------------------`;
        }

        await this.logStatus(this.getMissionFlavor(), "COGNITION", 40, "think");
        const response = await this.ask(task, [], systemOverride, activeTools);
        
        await this.logStatus(`Mission task complete.`, "FINALIZE", 100, "status");
        return unpackContent(response);
    }

    protected getMissionFlavor(): string {
        return "Processing mission objectives...";
    }

    abstract getName(): string;
    
    public getSystemPrompt(): string {
        return this.systemPrompt;
    }

    public getSkills(): any[] {
        return [];
    }

    protected async logStatus(message: string, stage?: string, progress?: number, type: "think" | "tool" | "status" = "status") {
        log(`[${this.getName()}] ${message}`);
        await logToOpsConsole(this.getName(), message, type, stage, progress);
    }

    public async executeTool(name: string, args: any): Promise<string> {

        log(`[tool] ${this.getName()} executing ${name}...`);
        await logToOpsConsole(this.getName(), `Executing tool: ${name}`, "tool");
        try {
            // --- LEGACY TOOLS (Now routed via MCP Bridge) ---
            // list_shared_files, read_shared_file, add_memory, update_hive_mind, 
            // pin_fact, pin_agent, unpin_agent, get_memory

            // --- LOCAL SPECIALIZED TOOLS ---
            if (name === "real-estate/send_sms") {
                const { sendSms } = await import("../services/outreachService.js");
                await sendSms(args.phone, args.message, args.dealId);
                return "SMS sent successfully.";
            }
            if (name === "real-estate/trigger_call") {
                const { triggerAICall } = await import("../services/outreachService.js");
                const deal = CrmManager.getDeal(args.dealId);
                if (!deal) return "Deal not found.";
                await triggerAICall(deal);
                return "AI Outreach call triggered successfully.";
            }
            if (name === "real-estate/generate_contract") {
                const { generateContract } = await import("../services/outreachService.js");
                const deal = CrmManager.getDeal(args.dealId);
                if (!deal) return "Deal not found.";
                const contract = generateContract(deal);
                return `Contract generated:\n\n${contract}`;
            }
            if (name === "real-estate/skip_trace") {
                const { skipTrace } = await import("../services/outreachService.js");
                const result = await skipTrace(args.name, args.city || "");
                return JSON.stringify(result);
            }
            if (name === "intelligence/analyze_deal") {
                const { IntelligenceService } = await import("../services/intelligenceService.js");
                const result = await IntelligenceService.analyzeDeal(args.dealId);
                return JSON.stringify(result);
            }
            if (name === "system/memory/add") {
                const client = (await import("../core/supabase.js")).getSupabase();
                if (client) {
                    await client.from("hapda_observations").insert({
                        domain: args.domain || "global",
                        content: args.content,
                        importance: args.importance || 1,
                        metadata: { agent: this.getName() }
                    });
                    return "Memory saved to global brain.";
                }
                return "Supabase client not available.";
            }
            if (name === "system/memory/get") {
                const context = await SearchOrchestrator.search(args.query, args.domain || "global");
                return context;
            }
            if (name === "system/hive/update") {
                const hive = HiveMind.getInstance();
                if (args.active_mission) hive.setActiveMission(args.active_mission);
                if (args.objectives) hive.setObjectives(args.objectives);
                return "Hive Mind state updated.";
            }
            if (name === "knowledge/library_save" || name === "wiki/save_page") {
                const wikiRoot = fs.existsSync("../llm-wiki") ? "../llm-wiki" : "./wiki";
                const wiki = new WikiManager(wikiRoot);
                const result = await wiki.savePage({
                    title: args.title,
                    category: args.category || "pages",
                    content: args.content,
                    summary: args.summary
                });
                return JSON.stringify(result);
            }

            // --- MCP BRIDGE (V3) ---
            // This fallback intercepts any tool calls not handled locally and routes them
            // to the new Master MCP Server Tool Registry.
            log(`[mcp] Routing '${name}' through MCP bridge...`);
            try {
                const mcpResult = await callMCPTool(name, args);
                return typeof mcpResult === 'string' ? mcpResult : JSON.stringify(mcpResult);
            } catch (mcpError: any) {
                log(`[mcp] MCP routing failed for '${name}': ${mcpError.message}`, "warn");
                return `Unknown or failed tool: ${name}`;
            }
        } catch (e: any) {
            return `Error executing tool: ${e.message}`;
        }
    }

    protected mapToolsByName(toolNames: string[]): any[] {
        const allAvailable = this.getTools(true);
        return allAvailable.filter(t => toolNames.includes(t.function.name));
    }

    protected getTools(ignoreAgentFilter: boolean = false): any[] {
        const allTools = [
            {
                type: "function",
                function: {
                    name: "research/web_search",
                    description: "Search the internet for information.",
                    parameters: {
                        type: "object",
                        properties: { query: { type: "string" } },
                        required: ["query"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "research/read_url",
                    description: "Read website content.",
                    parameters: {
                        type: "object",
                        properties: { url: { type: "string" } },
                        required: ["url"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "research/firecrawl_scrape",
                    description: "Scrape high-fidelity markdown from a URL using Firecrawl.",
                    parameters: {
                        type: "object",
                        properties: { url: { type: "string" } },
                        required: ["url"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "research/firecrawl_search",
                    description: "Search the web and return high-quality scraped results using Firecrawl.",
                    parameters: {
                        type: "object",
                        properties: { query: { type: "string" } },
                        required: ["query"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "research/firecrawl_interact",
                    description: "Perform browser actions (clicks, forms) on a live page using Firecrawl.",
                    parameters: {
                        type: "object",
                        properties: { 
                            url: { type: "string" },
                            prompt: { type: "string", description: "What to do on the page (e.g. 'click the login button')" }
                        },
                        required: ["url", "prompt"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "social/tiktok_scrape",
                    description: "Scrape and analyze a TikTok video for metadata and content using Apify.",
                    parameters: {
                        type: "object",
                        properties: {
                            url: { type: "string", description: "The TikTok video URL to analyze" }
                        },
                        required: ["url"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "real-estate/skip_trace",
                    description: "Find a property owner's phone number using skip tracing.",
                    parameters: {
                        type: "object",
                        properties: {
                            name: { type: "string", description: "Full name of the owner" },
                            city: { type: "string", description: "City or State for lookup context" }
                        },
                        required: ["name"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "real-estate/send_sms",
                    description: "Send a direct SMS message to a property owner.",
                    parameters: {
                        type: "object",
                        properties: {
                            phone: { type: "string", description: "Target phone number" },
                            message: { type: "string", description: "SMS content" },
                            dealId: { type: "number", description: "Optional deal ID for logging" }
                        },
                        required: ["phone", "message"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "real-estate/trigger_call",
                    description: "Trigger an autonomous AI voice outreach call to a property owner.",
                    parameters: {
                        type: "object",
                        properties: {
                            dealId: { type: "number", description: "The ID of the deal to call about" }
                        },
                        required: ["dealId"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "real-estate/generate_contract",
                    description: "Generate a legal assignment agreement for a deal.",
                    parameters: {
                        type: "object",
                        properties: {
                            dealId: { type: "number", description: "The ID of the deal" }
                        },
                        required: ["dealId"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "intelligence/analyze_deal",
                    description: "Run deep AI analysis on a lead to generate risk scores and investment strategies.",
                    parameters: {
                        type: "object",
                        properties: {
                            dealId: { type: "number", description: "The ID of the deal to analyze" }
                        },
                        required: ["dealId"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "real-estate/find_deals",
                    description: "Find motivated seller leads in a specific city or state using the high-performance local scraper.",
                    parameters: {
                        type: "object",
                        properties: {
                            state: { type: "string", description: "Target state (e.g. NJ, PA, NY)" },
                            city: { type: "string", description: "Optional target city" }
                        },
                        required: ["state"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "media/generate_video",
                    description: "Generate a cinematic preview video for a specific topic or deal.",
                    parameters: {
                        type: "object",
                        properties: {
                            topic: { type: "string", description: "The subject of the video (e.g. 'real estate wholesale tips')" }
                        },
                        required: ["topic"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "media/post_to_social",
                    description: "Generate and AUTOMATICALLY post a video to TikTok and Instagram.",
                    parameters: {
                        type: "object",
                        properties: {
                            topic: { type: "string", description: "The content topic to produce and publish" }
                        },
                        required: ["topic"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "system/hive/update",
                    description: "Update the shared mission state (active_mission, objectives, agent_handoffs).",
                    parameters: {
                        type: "object",
                        properties: {
                            active_mission: { type: "string" },
                            objectives: { type: "array", items: { type: "string" } },
                            agent_handoffs: { type: "array", items: { type: "string" }, description: "List of tasks or handoff instructions for other agents." }
                        }
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "system/facts/pin",
                    description: "Pin a permanent fact to the global knowledge base (pinned_facts).",
                    parameters: {
                        type: "object",
                        properties: {
                            key: { type: "string" },
                            value: { type: "string" }
                        },
                        required: ["key", "value"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "system/agent/pin",
                    description: "Pin the current user session to a specific agent (e.g. 'researcher', 'marketer').",
                    parameters: {
                        type: "object",
                        properties: {
                            agent_id: { type: "string" }
                        },
                        required: ["agent_id"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "system/agent/unpin",
                    description: "Clear the current agent pin and return to the Dispatcher/Triage routing.",
                    parameters: { type: "object", properties: {} }
                }
            },
            {
                type: "function",
                function: {
                    name: "system/memory/add",
                    description: "Save an important observation or fact to long-term episodic memory.",
                    parameters: {
                        type: "object",
                        properties: {
                            content: { type: "string", description: "The core memory to save" },
                            domain: { type: "string", description: "Domain of memory (trading, real_estate, global)" },
                            importance: { type: "number", description: "1-5 scale of importance" }
                        },
                        required: ["content"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "system/memory/get",
                    description: "Retrieve relevant past memories based on a query.",
                    parameters: {
                        type: "object",
                        properties: {
                            query: { type: "string", description: "Search query" },
                            domain: { type: "string", description: "Domain to search" }
                        },
                        required: ["query"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "system/files/list",
                    description: "List all files in the shared data directory.",
                    parameters: {
                        type: "object",
                        properties: {
                            directory: { type: "string", description: "Optional subdirectory in shared data" }
                        }
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "system/files/read",
                    description: "Read the content of a shared file.",
                    parameters: {
                        type: "object",
                        properties: {
                            fileName: { type: "string", description: "Name of the file to read" }
                        },
                        required: ["fileName"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "knowledge/library_save",
                    description: "Save a structured markdown note to the Obsidian vault library.",
                    parameters: {
                        type: "object",
                        properties: {
                            title: { type: "string" },
                            summary: { type: "string" },
                            concepts: { type: "array", items: { type: "string" }, description: "Concepts for [[linking]]" },
                            content: { type: "string", description: "The deep analysis content" },
                            sourceUrl: { type: "string" },
                            tags: { type: "array", items: { type: "string" } }
                        },
                        required: ["title", "summary", "content"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "knowledge/wiki_search",
                    description: "Search the local Obsidian library for relevant notes.",
                    parameters: {
                        type: "object",
                        properties: { query: { type: "string" } },
                        required: ["query"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "knowledge/wiki_read",
                    description: "Read the full content of a specific note from the library.",
                    parameters: {
                        type: "object",
                        properties: { query: { type: "string", description: "Search query or file name" } },
                        required: ["query"]
                    }
                }
            }
        ];

        const name = this.getName();

        
        if (ignoreAgentFilter) return allTools;

        // --- MISSION-SPECIFIC TOOL ROUTING ---
        // Hermes: The Scout (Search & Scraping)
        if (name === "hermes") {
            return allTools.filter(t => t.function.name.startsWith("research/") || t.function.name.startsWith("real-estate/find_deals") || t.function.name.startsWith("social/"));
        }
        
        // Athena: The Strategist (Analysis & Scoring)
        if (name === "athena") {
            return allTools.filter(t => t.function.name.startsWith("intelligence/") || t.function.name.startsWith("knowledge/") || t.function.name.startsWith("system/memory/"));
        }
        
        // Ares: The Enforcer (Outreach & Execution)
        if (name === "ares") {
            return allTools.filter(t => t.function.name.startsWith("real-estate/") || t.function.name.startsWith("media/"));
        }
        
        // Atlas: The Custodian (Knowledge & Facts)
        if (name === "atlas") {
            return allTools.filter(t => t.function.name.startsWith("knowledge/") || t.function.name.startsWith("system/facts/") || t.function.name.startsWith("system/memory/"));
        }
        
        // Hephaestus: The Architect (Infrastructure & Files)
        if (name === "hephaestus") {
            return allTools.filter(t => t.function.name.startsWith("system/hive/") || t.function.name.startsWith("system/files/"));
        }

        // Fallback: Default Triage set
        return allTools.slice(0, 15);
    }

    async chat(userText: string): Promise<string> {
        const res = await this.ask(userText);
        return unpackContent(res);
    }

    async ask(userText: any, history: any[] = [], systemOverride?: string, customTools?: any[]): Promise<any> {
        const name = this.getName();
        let systemPrompt = systemOverride || this.getSystemPrompt();
        // Inject Hive Mind and Council Protocol
        const hive = HiveMind.getInstance();
        systemPrompt += hive.getContextString();

        // ─── Episodic Memory Injection ──────────────────────────────────────
        const memoryContext = await SearchOrchestrator.search(userText, "global");
        systemPrompt += `\n\n--- EPISODIC MEMORY (PAST CONTEXT) ---\n${memoryContext}\n-------------------------------------`;

        systemPrompt += `\n\n--- COUNCIL OPERATIONAL PROTOCOL ---
1. You are PART OF A COUNCIL. Focus on your specific role within the larger mission.
2. Updates to the mission state or objectives MUST be done using 'update_hive_mind'.
3. TOOL PROTOCOL: Use the provided tools for real-world actions. Always analyze results before responding.
4. MEMORY: Use 'add_memory' to persist important discoveries for future sessions.
-------------------------------------`;

        const tools = customTools || this.getTools();
        let messages = [...history, { role: "user", content: userText }] as any;

        try {
            let toolIteration = 0;
            while (toolIteration < 10) {
                if (toolIteration === 0) {
                    await logToOpsConsole(name, `Processing: ${userText}`, "think");
                }
                const aiResponse = await askAI("", systemPrompt, {
                    messages, tools, model: this.model,
                    provider: this._agentProvider,
                    freeTierOnly: config.freeTierOnly
                });

                if (!aiResponse.tool_calls) {
                    await logToOpsConsole(name, "Response delivered.", "chat");
                    return aiResponse;
                }

                log(`[agent] ${name} calling ${aiResponse.tool_calls.length} tools...`);
                await logToOpsConsole(name, `Calling tools: ${aiResponse.tool_calls.map(tc => tc.function.name).join(", ")}`, "tool");
                messages.push({ role: "assistant", content: aiResponse.content, tool_calls: aiResponse.tool_calls });

                for (const tc of aiResponse.tool_calls) {
                    const result = await this.executeTool(tc.function.name, JSON.parse(tc.function.arguments));
                    messages.push({ role: "tool", tool_call_id: tc.id, content: result });
                }
                toolIteration++;
            }
            await logToOpsConsole(name, "Response delivered.", "chat");
            return { content: "Max tool iterations reached." };
        } catch (error: any) {
            log(`[error] Agent ${name} failed: ${error.message}`, "error");
            await logToOpsConsole(name, `CRITICAL ERROR: ${error.message}`, "error");
            throw error;
        }
    }
}
