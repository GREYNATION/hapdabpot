import fs from "fs";
import path from "path";
import { config, log } from "../core/config.js";
import { askAI } from "../core/ai.js";
import axios from "axios";
import { agentMail } from "../services/agentmail.js";

export interface AgentResponse {
    content: string;
    tool_calls?: any[];
}

export abstract class BaseAgent {
    protected model: string;
    protected systemPrompt: string;

    constructor(name: string, systemPrompt: string) {
        this.model = config.openaiModel;
        this.systemPrompt = systemPrompt;
    }

    abstract getName(): string;
    abstract getSystemPrompt(): string;

    public async executeTool(name: string, args: any): Promise<string> {
        log(`[tool] ${this.getName()} executing ${name}...`);
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
            }
        ];
    }

    async chat(userText: string): Promise<string> {
        const res = await this.ask(userText);
        return res.content;
    }

    async ask(userText: any, history: any[] = [], systemOverride?: string): Promise<any> {
        const name = this.getName();
        const systemPrompt = systemOverride || this.getSystemPrompt();
        const tools = this.getTools();
        let messages = [...history, { role: "user", content: userText }] as any;

        try {
            let toolIteration = 0;
            while (toolIteration < 5) {
                const aiResponse = await askAI("", systemPrompt, {
                    messages, tools, model: this.model
                });

                if (!aiResponse.tool_calls) return aiResponse;

                log(`[agent] ${name} calling ${aiResponse.tool_calls.length} tools...`);
                messages.push({ role: "assistant", content: aiResponse.content, tool_calls: aiResponse.tool_calls });

                for (const tc of aiResponse.tool_calls) {
                    const result = await this.executeTool(tc.function.name, JSON.parse(tc.function.arguments));
                    messages.push({ role: "tool", tool_call_id: tc.id, content: result });
                }
                toolIteration++;
            }
            return { content: "Max tool iterations reached." };
        } catch (error: any) {
            log(`[error] Agent ${name} failed: ${error.message}`, "error");
            throw error;
        }
    }
}
