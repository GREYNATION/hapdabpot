/*
 * core/ai.ts â€” Modernized
 * Unified AI provider interface with Groq SDK + Timeout.
 */

import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import Groq from "groq-sdk";
import { config, log } from "./config.js";
import { withTimeout, getErrorMessage, delay } from "./timeout.js";
import { puterService } from "./puter.js";

// â”€â”€ Clients (Re-initialized via initializeClients) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
import * as cfg from "./config.js";

const GROQ_MODEL = "llama-3.3-70b-versatile"; // keep this exact string

export let openai = cfg.openai;
let groqClient = cfg.groq;
export let openRouterClient: OpenAI;
let anthropicClient = cfg.anthropic;
let kimiClient = cfg.kimi;

/**
 * Re-initialize AI clients after config is fetched from Supabase.
 */
export function initializeClients() {
    log(`[ai] Re-initializing clients with fresh credentials...`);
    
    openai = cfg.openai;
    groqClient = cfg.groq;
    anthropicClient = cfg.anthropic;
    kimiClient = cfg.kimi;

    openRouterClient = new OpenAI({
        apiKey: process.env.OPENROUTER_API_KEY || "placeholder",
        baseURL: "https://openrouter.ai/api/v1",
        defaultHeaders: { "HTTP-Referer": "https://hapdabot.railway.app" },
    });

    log(`[ai] ðŸš€ Infrastructure version: 1.0.2 (Fixed Anthropic roles & HiveMind schema)`);
}

// â”€â”€ Rate Limiting & Throttling â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
import PQueue from "p-queue";
export { PQueue };

export const globalQueue = new PQueue({
  concurrency: 3,          // how many requests at once
  interval: 1000,          // time window
  intervalCap: 5           // max requests per window
});

class CircuitBreaker {
  state = "CLOSED";
  failures = 0;
  lastFailure = 0;

  constructor(private threshold = 5, private cooldown = 30000) {}

  async execute(fn: () => Promise<any>) {
    if (this.state === "OPEN") {
      if (Date.now() - this.lastFailure > this.cooldown) {
        log(`[ai] Circuit Breaker entering HALF-OPEN state (testing recovery)...`, "warn");
        this.state = "HALF_OPEN";
      } else {
        throw new Error("âš ï¸ System cooling down (rate limit reached). Try again in a few seconds.");
      }
    }

    try {
      const result = await fn();
      if (this.state === "HALF_OPEN") {
          log(`[ai] Circuit Breaker CLOSED. Recovery successful.`, "info");
      }
      this.failures = 0;
      this.state = "CLOSED";
      return result;
    } catch (err: any) {
      const isRateLimit = err.status === 429 || 
                          (err.message && err.message.toLowerCase()?.includes("rate limit")) ||
                          (err.message && err.message.toLowerCase()?.includes("429"));

      if (isRateLimit) {
        this.failures++;
        this.lastFailure = Date.now();

        // Extract retry delay from headers if available (Cline pattern)
        const retryAfter = 
            err.headers?.["retry-after"] || 
            err.headers?.["x-ratelimit-reset"] || 
            err.headers?.["ratelimit-reset"];
        
        if (retryAfter) {
            const delaySec = parseInt(retryAfter);
            if (!isNaN(delaySec)) {
                // If it's a large number, it might be a timestamp
                const actualDelay = delaySec > 1000000 ? (delaySec * 1000 - Date.now()) : (delaySec * 1000);
                this.cooldown = Math.max(actualDelay, 5000); // at least 5s
            }
        }

        if (this.state === "HALF_OPEN" || this.failures >= this.threshold) {
          log(`[ai] Circuit Breaker OPEN (rate limit reached). Pausing for ${Math.round(this.cooldown/1000)}s.`, "error");
          this.state = "OPEN";
        }
      }

      throw err;
    }
  }
}

const breaker = new CircuitBreaker();

function isRetryable(err: any): boolean {
    return err.status === 429 || 
           (err.message && err.message.toLowerCase()?.includes("rate limit")) ||
           (err.message && err.message.toLowerCase()?.includes("429")) ||
           err.status === 502 || err.status === 503 || err.status === 504;
}

export async function withRetry(fn: () => Promise<any>, maxRetries = 5) {
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      return await fn();
    } catch (err: any) {
      if (!isRetryable(err)) throw err;

      attempt++;
      const delayMs = Math.min(1000 * 2 ** attempt, 15000) + Math.random() * 500;
      log(`[ai] Rate limit encountered. Retrying in ${delayMs.toFixed(0)}ms... (Attempt ${attempt}/${maxRetries})`, "warn");
      await delay(delayMs);
    }
  }

  throw new Error("Max retries reached");
}

export async function runAgentTask(task: () => Promise<any>) {
  return globalQueue.add(() =>
    breaker.execute(() =>
      withRetry(task)
    )
  );
}

// Initial call
initializeClients();

// â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export type AIMessage = OpenAI.ChatCompletionMessageParam;

export interface ToolCall {
    id: string;
    function: {
        name: string;
        arguments: string;
    };
}

export interface AIResponse {
    content: string;
    tool_calls?: ToolCall[]; // Standardized for BaseAgent compatibility
    toolCalls?: ToolCall[];  // Compatibility alias
    provider: "groq" | "openrouter" | "anthropic";
    tokens?: number;
    model: string;
}

export interface AITool {
    type: "function";
    function: {
        name: string;
        description: string;
        parameters: {
            type: "object";
            properties: Record<string, { type: string; description: string; enum?: string[] }>;
            required?: string[];
        };
    };
}

export interface AIOptions {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    jsonMode?: boolean;
    tools?: AITool[];
    toolChoice?: "auto" | "none" | "required";
    messages?: OpenAI.ChatCompletionMessageParam[];
    stream?: boolean;
    onChunk?: (chunk: string) => void;
    provider?: "groq" | "openrouter" | "anthropic"; // explicit provider override
    freeTierOnly?: boolean; // new flag for free-tier restrictions
}

// â”€â”€ Message Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function systemMsg(content: string): AIMessage { return { role: "system", content }; }
export function userMsg(content: string): AIMessage { return { role: "user", content }; }

/**
 * buildTool â€” Construct an AITool object efficiently (Claw Agent compatibility)
 */
export function buildTool(
    name: string, 
    description: string, 
    properties: Record<string, any>, 
    required: string[] = []
): AITool {
    return {
        type: "function",
        function: {
            name,
            description,
            parameters: {
                type: "object",
                properties,
                required
            }
        }
    };
}

// â”€â”€ Groq â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function cleanForGroq(
    messages: OpenAI.ChatCompletionMessageParam[]
): OpenAI.ChatCompletionMessageParam[] {
    return messages.map((m) => {
        if (m.role === "assistant" && (m as any).tool_calls && !m.content) {
            return { ...m, content: "Executing functions..." };
        }
        return m;
    });
}

/**
 * ðŸ›¡ï¸ Token guard for Groq â€” rough estimate: 1 token â‰ˆ 4 chars.
 * Groq free-tier models have ~6k context windows; trim before sending.
 */
function trimForGroq(
    messages: OpenAI.ChatCompletionMessageParam[]
): OpenAI.ChatCompletionMessageParam[] {
    const totalChars = messages.reduce((acc, m) => {
        const content = typeof m.content === "string" ? m.content : JSON.stringify(m.content ?? "");
        return acc + content.length;
    }, 0);
    const estimatedTokens = Math.ceil(totalChars / 4);

    if (estimatedTokens > 3000) {
        log(`[ai] âš ï¸ Groq prompt too large (~${estimatedTokens} tokens). Trimming to 8000 chars...`, "warn");
        // Keep system message intact, trim only the last user message
        return messages.map((m, i) => {
            if (i === messages.length - 1 && typeof m.content === "string" && m.content.length > 8000) {
                return { ...m, content: m.content.slice(0, 8000) + "\n[...content trimmed for token limit]" };
            }
            return m;
        });
    }
    return messages;
}

async function callGroq(
    messages: OpenAI.ChatCompletionMessageParam[],
    options: AIOptions
): Promise<AIResponse> {
    const model = options.model || config.groqModel || GROQ_MODEL;
    const cleaned = cleanForGroq(messages);
    // ðŸ›¡ï¸ Trim oversized prompts before they hit the API
    const trimmed = trimForGroq(cleaned);

    try {
        if (options.stream && options.onChunk) {
            const stream = await groqClient.chat.completions.create({
                model,
                messages: trimmed as any,
                temperature: options.temperature ?? 0.7,
                max_tokens: options.maxTokens || 1500,
                stream: true,
            });

            let fullContent = "";
            for await (const chunk of stream) {
                const delta = chunk.choices[0]?.delta?.content || "";
                if (delta) {
                    fullContent += delta;
                    options.onChunk(delta);
                }
            }
            return { content: fullContent, provider: "groq", model };
        }

        const completion = await groqClient.chat.completions.create({
            model,
            messages: trimmed as any,
            temperature: Math.min(options.temperature ?? 0.7, 2.0),
            max_tokens: options.maxTokens || 1500,
            tools: options.tools as any,
            tool_choice: (options.toolChoice ?? "auto") as any,
            response_format: options.jsonMode ? { type: "json_object" } : undefined,
        });

        const msg = completion.choices[0].message;
        const tool_calls = msg.tool_calls?.map((tc: any) => ({
            id: tc.id,
            type: "function" as const,
            function: { name: tc.function.name, arguments: tc.function.arguments },
        }));

        return {
            content: msg.content || "",
            tool_calls,
            toolCalls: tool_calls,
            provider: "groq",
            tokens: completion.usage?.total_tokens,
            model,
        };
    } catch (e: any) {
        if (e.status === 429) {
            log(`[ai] Groq rate limit hit (429). Falling back...`, "warn");
        }
        throw e;
    }
}

// â”€â”€ Anthropic â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function callAnthropic(
    messages: OpenAI.ChatCompletionMessageParam[],
    options: AIOptions
): Promise<AIResponse> {
    if (!anthropicClient) throw new Error("Anthropic client not initialized");

    let model = options.model || config.anthropicModel || "claude-3-5-sonnet-20241022";
    if ((model ?? "")?.includes("-latest")) {
        model = model.replace("-latest", "-20241022");
    }
    const systemMsgRaw = messages.find(m => m.role === "system")?.content as string || "";
    const systemMsg = systemMsgRaw.trim();
    
    // Convert OpenAI messages to Anthropic format
    const nonSystem: any[] = [];
    
    for (const m of messages) {
        if (m.role === "system") continue;
        
        if (m.role === "tool") {
            // Anthropic tool result must follow the tool_use it responds to
            nonSystem.push({
                role: "user",
                content: [
                    {
                        type: "tool_result",
                        tool_use_id: (m as any).tool_call_id,
                        content: m.content
                    }
                ]
            });
            continue;
        }

        let content: any = m.content;
        
        if (Array.isArray(m.content)) {
            content = (m.content as any[]).map(item => {
                if (item.type === "text") return item;
                if (item.type === "image_url") {
                    const url = item.image_url.url;
                    const match = url.match(/^data:(image\/\w+);base64,(.+)$/);
                    if (match) {
                        return {
                            type: "image",
                            source: {
                                type: "base64",
                                media_type: match[1],
                                data: match[2]
                            }
                        };
                    }
                }
                return item;
            });
        }

        if (m.role === "assistant" && (m as any).tool_calls) {
            const toolUseContent = (m as any).tool_calls.map((tc: any) => ({
                type: "tool_use",
                id: tc.id,
                name: tc.function.name,
                input: JSON.parse(tc.function.arguments)
            }));
            
            nonSystem.push({
                role: "assistant",
                content: m.content ? [{ type: "text", text: m.content }, ...toolUseContent] : toolUseContent
            });
        } else {
            nonSystem.push({ role: m.role as "user" | "assistant", content });
        }
    }

    const tools = options.tools?.map(t => ({
        name: t.function.name,
        description: t.function.description,
        input_schema: t.function.parameters
    }));

    const response = await (anthropicClient as any).messages.create({
        model,
        max_tokens: options.maxTokens || 1024,
        system: systemMsg.length > 0 ? [
            {
                type: "text",
                text: systemMsg,
                cache_control: { type: "ephemeral" }
            }
        ] : undefined,
        messages: nonSystem as any,
        tools: tools as any,
        tool_choice: tools?.length ? { type: "auto" } : undefined,
        // Support for Claude's thinking mode if budget is provided in options
        thinking: (options as any).thinkingBudget ? { type: "enabled", budget_tokens: (options as any).thinkingBudget } : undefined,
    }, {
        // Headers for beta features like prompt caching if needed (though now standard)
        headers: { "anthropic-beta": "prompt-caching-2024-07-31" }
    });

    const textBlock = response.content.find((b: any) => b.type === "text");
    const toolBlocks = response.content.filter((b: any) => b.type === "tool_use");

    const tool_calls = toolBlocks.map((b: any) => ({
        id: b.id,
        type: "function" as const,
        function: { name: b.name, arguments: JSON.stringify(b.input) }
    }));

    return {
        content: (textBlock as any)?.text || "",
        tool_calls: tool_calls.length ? tool_calls : undefined,
        toolCalls: tool_calls.length ? tool_calls : undefined,
        provider: "anthropic",
        tokens: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0),
        model
    };
}

// â”€â”€ Kimi-K2 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function callKimi(
    messages: OpenAI.ChatCompletionMessageParam[],
    options: AIOptions
): Promise<AIResponse> {
    const model = options.model || "moonshot-v1-128k"; // Standard high-context model

    const completion = await kimiClient.chat.completions.create({
        model,
        messages: messages as any,
        temperature: options.temperature ?? 0.3, // Kimi prefers lower temp for reasoning
        max_tokens: options.maxTokens || 4096,
        tools: options.tools as any,
        tool_choice: (options.toolChoice ?? "auto") as any,
        response_format: options.jsonMode ? { type: "json_object" } : undefined,
    });

    const msg = completion.choices[0].message;
    const tool_calls = msg.tool_calls?.map((tc: any) => ({
        id: tc.id,
        type: "function" as const,
        function: { name: tc.function.name, arguments: tc.function.arguments },
    }));

    return {
        content: msg.content || "",
        tool_calls,
        toolCalls: tool_calls,
        provider: "openrouter",
        tokens: completion.usage?.total_tokens,
        model,
    };
}


// â”€â”€ Fallbacks â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function callOpenRouter(
    messages: OpenAI.ChatCompletionMessageParam[],
    options: AIOptions
): Promise<AIResponse> {
    const isMultimodal = messages.some(m => Array.isArray(m.content));
    const model = options.model || (isMultimodal 
        ? "openai/gpt-4o" 
        : "google/gemini-2.0-flash-001");

    const completion = await openRouterClient.chat.completions.create({
        model,
        messages: messages as any,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens || 1000,
        tools: options.tools as any,
        tool_choice: (options.toolChoice ?? "auto") as any,
        response_format: options.jsonMode ? { type: "json_object" } : undefined,
    });

    const msg = completion.choices[0].message;
    const tool_calls = msg.tool_calls?.map((tc: any) => ({
        id: tc.id,
        type: "function" as const,
        function: { name: tc.function.name, arguments: tc.function.arguments },
    }));

    return {
        content: msg.content || "",
        tool_calls: tool_calls?.length ? tool_calls : undefined,
        toolCalls: tool_calls?.length ? tool_calls : undefined,
        provider: "openrouter",
        tokens: completion.usage?.total_tokens,
        model,
    };
}

/**
 * mapModel â€” Ensure model names have correct provider prefixes for OpenRouter
 */
function mapModel(model: string): string {
    if (!model) return "google/gemini-2.0-flash-001"; // Default OR model
    if ((model ?? "")?.includes("/")) return model; // Already has prefix
    
    if (model.startsWith("claude-")) return `anthropic/${model}`;
    if (model.startsWith("gpt-")) return `openai/${model}`;
    if (model.startsWith("gemini-")) return `google/${model}`;
    if (model.startsWith("llama-")) return `meta-llama/${model}`;
    
    return model;
}

// â”€â”€ Main Interface â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function askAI(
    prompt: string,
    systemPrompt = "You are a helpful assistant.",
    options: AIOptions = {}
): Promise<AIResponse> {
    const messages: OpenAI.ChatCompletionMessageParam[] = options.messages || [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
    ];

    let model = options.model || "";
    const isExplicitCloud = (model ?? "")?.includes("google/") || (model ?? "")?.includes("anthropic/");
    const isGroqMode = config.aiProvider === "groq";
    const isOpenRouterMode = config.aiProvider === "openrouter";

    const task = async (): Promise<AIResponse> => {
        try {
            const effectiveProvider = options.provider || config.aiProvider;
            if (effectiveProvider === "anthropic") {
                return await withTimeout(callAnthropic(messages, options), 30_000, "askAI:anthropic");
            }
            if (effectiveProvider === "groq") {
                const timeoutMs = options.tools?.length ? 45_000 : 30_000;
                if (model?.includes("gpt-") || !model || model === "llama-3.1-70b-versatile") {
                    options.model = config.groqModel || "llama-3.3-70b-versatile";
                }
                return await withTimeout(callGroq(messages, options), timeoutMs, "askAI:groq");
            }
            if (config.aiProvider === "kimi") {
                return await withTimeout(callKimi(messages, options), 90_000, "askAI:kimi");
            }
            
            // OpenRouter Logic
            if (isOpenRouterMode || isExplicitCloud) {
                options.model = mapModel(model);
                return await withTimeout(callOpenRouter(messages, options), 45_000, "askAI:openrouter");
            }

            if (isGroqMode && !isExplicitCloud) {
                const timeoutMs = options.tools?.length ? 120_000 : 60_000;
                if (model?.includes("gpt-") || !model || model === "llama-3.1-70b-versatile") {
                    options.model = config.groqModel || GROQ_MODEL;
                }
                return await withTimeout(callGroq(messages, options), timeoutMs, "askAI:groq");
            }

            // Default fallback
            options.model = mapModel(model);
            return await withTimeout(callOpenRouter(messages, options), 45_000, "askAI:openrouter");
        } catch (err: any) {
            const isCreditOrModelError = err.status === 401 ||
                                        err.status === 402 || 
                                        err.status === 400 || 
                                        err.status === 404 ||
                                        err.status === 429 ||
                                        err.message?.toLowerCase()?.includes("credit") ||
                                        err.message?.toLowerCase()?.includes("not exist") ||
                                        err.message?.toLowerCase()?.includes("user not found") ||
                                        err.message?.toLowerCase()?.includes("not_found_error") ||
                                        err.message?.toLowerCase()?.includes("rate limit");

            if (isCreditOrModelError) {
                log(`[ai] Provider issue (${err.status}): ${err.message}. Triggering emergency Groq fallback...`, "error");
                try {
                    return await withTimeout(callGroq(messages, { ...options, model: GROQ_MODEL }), 60_000, "askAI:emergency:groq");
                } catch (groqErr: any) {
                    log(`[ai] Emergency Groq fallback failed: ${groqErr.message}`, "error");
                }
            }

            if (!model?.includes("openrouter")) {
                log(`[ai] AI call failed: ${err.message}. Attempting general fallback...`, "error");
                try {
                    options.model = "google/gemini-2.0-flash-001"; // Rock solid fallback
                    return await withTimeout(callOpenRouter(messages, { ...options }), 90_000, "askAI:openrouter:fallback");
                } catch (fallbackErr: any) {
                    log(`[ai] OpenRouter fallback failed. Attempting emergency Puter fallback...`, "warn");
                    try {
                        const puterContent = await puterService.ask(prompt || messages[messages.length-1].content as string || "Analyze this task.");
                        return {
                            content: puterContent || "Emergency response failed.",
                            provider: "groq",
                            model: "puter-gpt-4o"
                        } as any;
                    } catch (puterErr: any) {
                        log(`[ai] All fallbacks including Puter failed.`, "error");
                    }
                }
            }
            throw err;
        }
    };

    return runAgentTask(task);
}

/**
 * callAI â€” Wrapper for multi-message chat sessions (DramaAgent compatible)
 */
export async function callAI(
    messages: AIMessage[],
    domain = "global",
    tools?: AITool[]
): Promise<AIResponse> {
    return askAI("", "You are a helpful assistant.", { messages, tools });
}

export function parseToolArgs<T = Record<string, unknown>>(toolCall: ToolCall): T {
    try {
        return JSON.parse(toolCall.function.arguments) as T;
    } catch {
        throw new Error(`Failed to parse args for "${toolCall.function.name}"`);
    }
}

