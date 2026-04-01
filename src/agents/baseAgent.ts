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

    constructor(name: string, systemPrompt: string) {
        this.model = config.openaiModel;
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
                log(`[tool] Searching Brave for: ${query}`);
                
                if (!config.braveApiKey) {
                    log(`[error] web_search failed: BRAVE_API_KEY is ${config.braveApiKey === undefined ? "undefined" : "null/empty"}`, "error");
                    return "Error: Brave API Key is not configured. Please add BRAVE_API_KEY to your .env file.";
                }

                // Brave Search API Call
                const response = await axios.get("https://api.search.brave.com/res/v1/web/search", {
                    params: { q: query, count: 8 },
                    headers: { 
                        "Accept": "application/json",
                        "Accept-Encoding": "gzip",
                        "X-Subscription-Token": config.braveApiKey
                    },
                    timeout: 10000
                });
                
                const webResults = (response.data.web?.results || []).slice(0, 5);
                
                if (webResults.length > 0) {
                    const formatted = webResults.map((r: any) => 
                        `### [${r.title}](${r.url})\n${r.description || "No description available."}`
                    ).join("\n\n");
                    return `Top search results for "${query}":\n\n${formatted}`;
                } else {
                    return `Brave search for "${query}" returned no results. Try broader terms.`;
                }
            }
            if (name === "read_url") {
                let url = args.url;
                log(`[tool] Reading URL: ${url}`);
                
                // Specialized handler for YouTube/Shorts
                if (url.includes("youtube.com") || url.includes("youtu.be")) {
                    log(`[tool] YouTube URL detected, fetching metadata...`);
                    let embedUrl = url;
                    if (url.includes("/shorts/")) {
                        const id = url.split("/shorts/")[1]?.split("?")[0];
                        if (id) embedUrl = `https://www.youtube.com/watch?v=${id}`;
                    }

                    try {
                        const metaResponse = await axios.get(`https://noembed.com/embed?url=${encodeURIComponent(embedUrl)}`, { timeout: 5000 });
                        const meta = metaResponse.data;
                        if (meta.title) {
                            return `YouTube Video Information for ${url}:\n\nTitle: ${meta.title}\nAuthor: ${meta.author_name}\nProvider: ${meta.provider_name}\n\nNote: This is a video link. I can access the metadata but not the visual content directly.`;
                        }
                    } catch (metaErr: any) {
                        log(`[warn] YouTube metadata fetch failed: ${metaErr.message}`, "warn");
                    }

                    // Fallback to web search for YouTube info
                    log(`[tool] Falling back to web search for YouTube info: ${url}`);
                    const searchResult = await this.executeTool("web_search", { query: url });
                    return `I couldn't fetch direct metadata for this YouTube link, but here is what I found online:\n\n${searchResult}`;
                }

                const response = await axios.get(url, {
                    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36" },
                    timeout: 8000
                });
                const text = response.data.replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, "")
                                          .replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, "")
                                          .replace(/<[^>]+>/g, " ")
                                          .replace(/\s+/g, " ")
                                          .trim();
                return `Content of ${url}:\n\n${text.substring(0, 8000)}`;
            }
            if (name === "send_email") {
                const { to, subject, body } = args;
                const result = await agentMail.sendEmail(to, subject, body);
                return `Email sent successfully to ${to}. ID: ${result.id || 'unknown'}`;
            }
            if (name === "list_emails") {
                const limit = args.limit || 10;
                const messages = await agentMail.listMessages(limit);
                if (messages.length === 0) return "No emails found in the inbox.";
                const formatted = messages.map((m: any) => `- [${m.timestamp}] From: ${m.from}, Subject: ${m.subject} (ID: ${m.id})`).join("\n");
                return `Recent emails:\n\n${formatted}\n\nUse 'read_email' with an ID to see the full content.`;
            }
            if (name === "read_email") {
                const message = await agentMail.getMessage(args.messageId);
                return `Email from ${message.from} at ${message.timestamp}\nSubject: ${message.subject}\n\nContent:\n${message.body}`;
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
                    name: "list_shared_files",
                    description: "List all files available in the shared data folder.",
                    parameters: { type: "object", properties: {} }
                }
            },
            {
                type: "function",
                function: {
                    name: "read_shared_file",
                    description: "Read the full content of a specific file from the shared data folder.",
                    parameters: {
                        type: "object",
                        properties: {
                            fileName: { type: "string", description: "The name of the file to read (including extension)." }
                        },
                        required: ["fileName"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "web_search",
                    description: "Search the internet for information, news, or general knowledge.",
                    parameters: {
                        type: "object",
                        properties: {
                            query: { type: "string", description: "The search query." }
                        },
                        required: ["query"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "read_url",
                    description: "Fetch and read the text content of a specific website URL.",
                    parameters: {
                        type: "object",
                        properties: {
                            url: { type: "string", description: "The URL to visit." }
                        },
                        required: ["url"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "send_email",
                    description: "Send a professional email outreach to a recipient.",
                    parameters: {
                        type: "object",
                        properties: {
                            to: { type: "string", description: "Recipient email address." },
                            subject: { type: "string", description: "Email subject line." },
                            body: { type: "string", description: "Email body content (text/markdown)." }
                        },
                        required: ["to", "subject", "body"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "list_emails",
                    description: "List recent emails received by the agent.",
                    parameters: {
                        type: "object",
                        properties: {
                            limit: { type: "number", description: "Number of emails to list (default 10)." }
                        }
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "read_email",
                    description: "Read the full content of a specific email by its ID.",
                    parameters: {
                        type: "object",
                        properties: {
                            messageId: { type: "string", description: "The ID of the message to read." }
                        },
                        required: ["messageId"]
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
        const basePrompt = systemOverride || this.getSystemPrompt();
        const systemPrompt = `${basePrompt}
        
        CRITICAL: 
        1. ALWAYS provide a detailed text response summarizing your findings.
        2. DO NOT return an empty message or only tool calls if you have finished your research.
        3. NEVER claim you cannot browse the internet or access URLs. You have tools for this. If a site is blocked or empty, summarize what you found and suggest an alternative search.
        
        EXAMPLE OF PROPER TOOL USE:
        User: "Analyze this video: https://youtube.com/shorts/XYZ"
        You: [Call read_url(url="https://youtube.com/shorts/XYZ")]
        Tool Result: "YouTube Video Information... Title: How to code..."
        You: "I've analyzed the video you sent. It is titled 'How to code' and covers..."`;

        const tools = this.getTools();

        try {
            const isMultimodal = config.openaiModel?.includes("vision") || 
                                config.openaiModel?.includes("gemini") || 
                                config.openaiModel?.includes("gpt-4");
            
            let finalContent = userText;
            if (Array.isArray(userText) && !isMultimodal) {
                log(`[agent] ${name} detected visual context but model ${config.openaiModel} is text-only. Converting to text fallback.`, "warn");
                finalContent = userText
                    .filter((item: any) => item.type === "text")
                    .map((item: any) => item.text)
                    .join("\n") + "\n[System Note: User uploaded an image, but the current model cannot see it.]";
            }

            let messages = [
                { role: "system", content: systemPrompt },
                ...history,
                { role: "user", content: finalContent }
            ] as any;

            let toolIteration = 0;
            const maxToolIterations = 5;

            while (toolIteration < maxToolIterations) {
                let response: any;
                let retryCount = 0;
                const maxRetries = 3;

                while (retryCount < maxRetries) {
                    try {
                        const aiResponse = await askAI(
                            "", // Prompt is in messages
                            systemPrompt,
                            {
                                messages: messages,
                                tools: tools.length > 0 ? tools : undefined,
                                toolChoice: tools.length > 0 ? "auto" : undefined,
                                model: this.model,
                                temperature: 0.7
                            }
                        );

                        response = {
                            choices: [{
                                message: {
                                    role: "assistant",
                                    content: aiResponse.content,
                                    toolCalls: aiResponse.toolCalls
                                }
                            }]
                        };

                        break; // Success
                    } catch (e: any) {
                        retryCount++;
                        const isRetryable = e.status === 504 || e.status === 503 || e.status === 429 || (config.aiProvider === "gemini" && e.message.includes("failed"));
                        if (!isRetryable || retryCount >= maxRetries) {
                            log(`[error] Final LLM failure after ${retryCount} attempts: ${e.message}`, "error");
                            throw e;
                        }
                        const delay = retryCount * 2000;
                        log(`[agent] LLM ${config.aiProvider} error. Retrying in ${delay}ms... (Attempt ${retryCount}/${maxRetries})`, "warn");
                        await new Promise(resolve => setTimeout(resolve, delay));
                    }
                }

                let message = response.choices[0].message;

                if (!message.toolCalls) {
                    if (!message.content) {
                        log(`[agent] ${name} returned empty message. Retrying...`, "warn");
                        messages.push({ role: "user", content: "Please provide a textual summary of your findings." });
                        toolIteration++;
                        continue;
                    }
                    return message;
                }

                log(`[agent] ${name} is calling ${message.toolCalls.length} tools (Iteration ${toolIteration + 1})...`);
                messages.push(message);

                for (const toolCall of message.toolCalls) {
                    const result = await this.executeTool(toolCall.function.name, JSON.parse(toolCall.function.arguments));
                    messages.push({
                        role: "tool",
                        toolCallId: toolCall.id,
                        content: result
                    });
                }
                
                toolIteration++;
            }

            // Final attempt to force text if we reached the limit
            log(`[warn] Agent ${name} reached max tool iterations. Forcing final text response.`, "warn");
            messages.push({ role: "user", content: "You have reached your search limit. Please provide a final summary of all the information you found above." });
            
            let finalResponse: any;
            let finalRetryCount = 0;
            const finalMaxRetries = 2;

            while (finalRetryCount < finalMaxRetries) {
                try {
                    const aiResponse = await askAI(
                        "",
                        "You have reached your search limit. Please provide a final summary of all the information you found above.",
                        {
                            messages: messages,
                            model: config.openaiModel,
                            temperature: 0.5
                        }
                    );
                    finalResponse = {
                        choices: [{ message: { content: aiResponse.content } }]
                    } as any;
                    break; 
                } catch (e: any) {
                    finalRetryCount++;
                    if (finalRetryCount >= finalMaxRetries) throw e;
                    await new Promise(resolve => setTimeout(resolve, finalRetryCount * 2000));
                }
            }

            const finalMessage = finalResponse.choices[0].message;
            if (!finalMessage.content) {
                return { content: "I encountered an error summarizing my research. Please try a more specific question." };
            }
            return finalMessage;
        } catch (error: any) {
            log(`[error] Agent ${name} failed: ${error.message}`, "error");
            throw error;
        }
    }
}

