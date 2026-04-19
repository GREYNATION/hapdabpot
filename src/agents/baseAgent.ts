import fs from "fs";
import path from "path";
import { config, log, logToOpsConsole } from "../core/config.js";
import { askAI } from "../core/ai.js";
import axios from "axios";
import { agentMail } from "../services/agentmail.js";
import { HiveMind } from "../core/hiveMind.js";
import { ApifyService } from "../services/apifyService.js";

export interface AgentResponse {
    content: string;
    tool_calls?: any[];
}

export abstract class BaseAgent {
    protected model: string;
    protected systemPrompt: string;

    constructor(name: string, systemPrompt: string) {
        this.model = config.aiProvider === "groq" ? config.groqModel : config.openaiModel;
        
        // Inject Superpower Rules globally
        const superpowerRules = `
# Superpower Skills Rules
1. **Brainstorming (Design Gate)**: ALWAYS brainstorm before starting new features. Ask ONE question at a time.
2. **Systematic Debugging**: Gather evidence, trace data, and test hypotheses. Never guess.
3. **Test-Driven Development**: Create reproduction scripts before fixes.
4. **Autonomous Skills**: You have access to specialized skills in brainstorming, systematic-debugging, writing-plans, and test-driven-development.
`;
        this.systemPrompt = `${systemPrompt}\n\n${superpowerRules}`;
    }

    abstract getName(): string;
    abstract getSystemPrompt(): string;

    public async executeTool(name: string, args: any): Promise<string> {
        log(`[tool] ${this.getName()} executing ${name}...`);
        await logToOpsConsole(this.getName(), `Executing tool: ${name}`, "tool");
        try {
            if (name === "list_shared_files") {
                const dir = path.join(process.cwd(), "data", "shared");
                if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                const files = fs.readdirSync(dir);
                return files.length > 0 ? `Files in shared data: ${files.join(", ")}` : "The shared data folder is empty.";
            }
            if (name === "read_shared_file") {
                const fileName = path.basename(args.fileName);
                const filePath = path.join(process.cwd(), "data", "shared", fileName);
                if (!fs.existsSync(filePath)) return `Error: File '${fileName}' not found in shared data.`;
                const content = fs.readFileSync(filePath, "utf-8");
                return `Content of ${fileName}:\n\n${content.substring(0, 10000)}`;
            }
            if (name === "web_search") {
                const query = args.query;
                if (!config.braveApiKey) return "Error: Brave API Key missing.";
                
                const response = await axios.get("https://api.search.brave.com/res/v1/web/search", {
                    params: { q: query, count: 5 },
                    headers: { "Accept": "application/json", "X-Subscription-Token": config.braveApiKey }
                });
                const webResults = (response.data.web?.results || []).slice(0, 5);
                return webResults.map((r: any) => `### [${r.title}](${r.url})\n${r.description}`).join("\n\n");
            }
            if (name === "read_url") {
                const response = await axios.get(args.url, { timeout: 8000 });
                const text = response.data.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
                return text.substring(0, 8000);
            }
            if (name === "send_email") {
                const { to, subject, body } = args;
                await agentMail.sendEmail(to, subject, body);
                return `Email sent to ${to}.`;
            }
            if (name === "update_hive_mind") {
                const hive = HiveMind.getInstance();
                hive.updateState(args);
                return "Hive Mind updated.";
            }
            if (name === "pin_fact") {
                const hive = HiveMind.getInstance();
                hive.pinFact(args.key, args.value);
                return `Fact pinned: ${args.key}`;
            }
            if (name === "pin_agent") {
                const hive = HiveMind.getInstance();
                hive.pinAgent(args.agent_id);
                return `Session pinned to ${args.agent_id}.`;
            }
            if (name === "unpin_agent") {
                const hive = HiveMind.getInstance();
                hive.pinAgent(null);
                return "Session unpinned.";
            }
            if (name === "firecrawl_scrape") {
                const { url } = args;
                if (!config.firecrawlApiKey) return "Error: Firecrawl API Key missing.";
                const res = await axios.post("https://api.firecrawl.dev/v2/scrape", { 
                    url, 
                    formats: ["markdown"] 
                }, {
                    headers: { "Authorization": `Bearer ${config.firecrawlApiKey}` }
                });
                return res.data.data.markdown || "No content extracted.";
            }
            if (name === "firecrawl_search") {
                const { query } = args;
                if (!config.firecrawlApiKey) return "Error: Firecrawl API Key missing.";
                const res = await axios.post("https://api.firecrawl.dev/v2/search", { 
                    query, 
                    limit: 3,
                    scrapeOptions: { formats: ["markdown"] }
                }, {
                    headers: { "Authorization": `Bearer ${config.firecrawlApiKey}` }
                });
                return res.data.data.map((r: any) => `### [${r.metadata.title}](${r.metadata.sourceURL})\n${r.markdown || r.metadata.description}`).join("\n\n");
            }
            if (name === "firecrawl_interact") {
                const { url, prompt } = args;
                if (!config.firecrawlApiKey) return "Error: Firecrawl API Key missing.";
                const res = await axios.post("https://api.firecrawl.dev/v2/interact", { 
                    url, 
                    prompt 
                }, {
                    headers: { "Authorization": `Bearer ${config.firecrawlApiKey}` }
                });
                // Note: interact might be async, but V2 usually returns a result or status.
                // For simplicity, we assume immediate result for now.
                return JSON.stringify(res.data.data || res.data);
            }
            if (name === "tiktok_scrape") {
                return await ApifyService.scrapeTikTok(args.url);
            }
            if (name === "generate_video") {
                const { ContentAgent } = await import("./ContentAgent.js");
                const agent = new ContentAgent();
                return await agent.createVideo(args.topic, true); // true = preview/dryRun
            }
            if (name === "post_to_social") {
                const { ContentAgent } = await import("./ContentAgent.js");
                const agent = new ContentAgent();
                return await agent.createVideo(args.topic, false); // false = actual post
            }
            return "Unknown tool";
        } catch (e: any) {
            return `Error executing tool: ${e.message}`;
        }
    }

    protected getTools(): any[] {
        return [
            {
                type: "function",
                function: {
                    name: "web_search",
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
                    name: "read_url",
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
                    name: "firecrawl_scrape",
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
                    name: "firecrawl_search",
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
                    name: "firecrawl_interact",
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
                    name: "tiktok_scrape",
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
                    name: "generate_video",
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
                    name: "post_to_social",
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
                    name: "update_hive_mind",
                    description: "Update the shared mission state (active_mission, objectives, agent_handoffs).",
                    parameters: {
                        type: "object",
                        properties: {
                            active_mission: { type: "string" },
                            objectives: { type: "array", items: { type: "string" } },
                            agent_handoffs: { type: "object" }
                        }
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "pin_fact",
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
                    name: "pin_agent",
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
                    name: "unpin_agent",
                    description: "Clear the current agent pin and return to the Dispatcher/Triage routing.",
                    parameters: { type: "object", properties: {} }
                }
            }
        ];
    }

    async chat(userText: string): Promise<string> {
        const res = await this.ask(userText);
        return res.content;
    }

    async ask(userText: any, history: any[] = [], systemOverride?: string): Promise<any> {
        const name = this.getName();
        let systemPrompt = systemOverride || this.getSystemPrompt();
        // Inject Hive Mind and Council Protocol
        const hive = HiveMind.getInstance();
        systemPrompt += hive.getContextString();
        systemPrompt += `\n\n--- COUNCIL OPERATIONAL PROTOCOL ---
1. You are PART OF A COUNCIL. Focus on your specific role within the larger mission.
2. Updates to the mission state or objectives MUST be done using 'update_hive_mind'.
3. STRICT TOOL CALLING: You MUST use the provide tool-calling schema. 
   - DO NOT use XML tags like <function> or <tool_call>.
   - DO NOT wrap arguments in anything other than the standard JSON structure.
   - Failure to follow the JSON schema will cause a system disconnect.
-------------------------------------`;

        const tools = this.getTools();
        let messages = [...history, { role: "user", content: userText }] as any;

        try {
            let toolIteration = 0;
            while (toolIteration < 5) {
                if (toolIteration === 0) {
                    await logToOpsConsole(name, `Processing: ${userText}`, "think");
                }
                const aiResponse = await askAI("", systemPrompt, {
                    messages, tools, model: this.model
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
