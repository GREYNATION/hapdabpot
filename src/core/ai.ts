/*
 * core/ai.ts — Modernized
 * Unified AI provider interface with Groq SDK + Timeout.
 */

import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import Groq from "groq-sdk";
import { config, log } from "./config.js";
import { withTimeout, getErrorMessage, delay } from "./timeout.js";
import { puterService } from "./puter.js";

// ── Clients (Re-initialized via initializeClients) ───────────────────────────
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
}

// ── Rate Limiting & Throttling ───────────────────────────────────────────────
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
        throw new Error("⚠️ System cooling down (rate limit reached). Try again in a few seconds.");
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
                          (err.message && err.message.toLowerCase().includes("rate limit")) ||
                          (err.message && err.message.toLowerCase().includes("429"));

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
           (err.message && err.message.toLowerCase().includes("rate limit")) ||
           (err.message && err.message.toLowerCase().includes("429")) ||
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

// ── Types ─────────────────────────────────────────────────────────────────────

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
}

// ── Message Helpers ───────────────────────────────────────────────────────────

export function systemMsg(content: string): AIMessage { return { role: "system", content }; }
export function userMsg(content: string): AIMessage { return { role: "user", content }; }

/**
 * buildTool — Construct an AITool object efficiently (Claw Agent compatibility)
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

// ── Groq ──────────────────────────────────────────────────────────────────────

function cleanForGroq(
    messages: OpenAI.ChatCompletionMessageParam[]
): OpenAI.ChatCompletionMessageParam[] {
    // OLD: was filtering out 'tool' role entirely.
    // NEW: We preserve tool history so agents remember their findings.
    // However, some older Groq-SDK versions prefer assistant content to be non-null if tool_calls exist.
    return messages.map((m) => {
        if (m.role === "assistant" && (m as any).tool_calls && !m.content) {
            return { ...m, content: "Executing functions..." };
        }
        return m;
    });
}

async function callGroq(
    messages: OpenAI.ChatCompletionMessageParam[],
    options: AIOptions
): Promise<AIResponse> {
    const model = options.model || config.groqModel || GROQ_MODEL;
    const cleaned = cleanForGroq(messages);

    try {
        if (options.stream && options.onChunk) {
            const stream = await groqClient.chat.completions.create({
                model,
                messages: cleaned as any,
                temperature: options.temperature ?? 0.7,
                max_tokens: options.maxTokens || 1000,
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
            messages: cleaned as any,
            temperature: Math.min(options.temperature ?? 0.7, 2.0), // REMOVE if above 2.0
            max_tokens: options.maxTokens || 1024, // Optimized for versatile
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

// ── Anthropic ────────────────────────────────────────────────────────────────
async function callAnthropic(
    messages: OpenAI.ChatCompletionMessageParam[],
    options: AIOptions
): Promise<AIResponse> {
    if (!anthropicClient) throw new Error("Anthropic client not initialized");

    const model = options.model || config.anthropicModel || "claude-3-5-sonnet-20240620";
    const systemMsg = messages.find(m => m.role === "system")?.content as string || "";
    const nonSystem = messages.filter(m => m.role !== "system").map(m => {
        if (typeof m.content === "string") {
            return { role: m.role as "user" | "assistant", content: m.content };
        }
        
        // Handle Multimodal Content
        const content = (m.content as any[]).map(item => {
            if (item.type === "text") return item;
            if (item.type === "image_url") {
                // OpenAI format: { type: 'image_url', image_url: { url: 'data:image/png;base64,...' } }
                // Anthropic format: { type: 'image', source: { type: 'base64', media_type: 'image/png', data: '...' } }
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
        return { role: m.role as "user" | "assistant", content };
    });

    const tools = options.tools?.map(t => ({
        name: t.function.name,
        description: t.function.description,
        input_schema: t.function.parameters
    }));

    const response = await (anthropicClient as any).messages.create({
        model,
        max_tokens: options.maxTokens || 1024,
        system: [
            {
                type: "text",
                text: systemMsg,
                cache_control: { type: "ephemeral" }
            }
        ],
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

// ── Kimi-K2 ──────────────────────────────────────────────────────────────────

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
        provider: "kimi",
        tokens: completion.usage?.total_tokens,
        model,
    };
}


// ── Fallbacks ─────────────────────────────────────────────────────────────────

async function callOpenRouter(
    messages: OpenAI.ChatCompletionMessageParam[],
    options: AIOptions
): Promise<AIResponse> {
    const isMultimodal = messages.some(m => Array.isArray(m.content));
    const model = options.model || (isMultimodal 
        ? "openai/gpt-4o" 
        : "meta-llama/llama-3.3-70b-instruct:free");

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

// ── Main Interface ────────────────────────────────────────────────────────────

export async function askAI(
    prompt: string,
    systemPrompt = "You are a helpful assistant.",
    options: AIOptions = {}
): Promise<AIResponse> {
    const messages: OpenAI.ChatCompletionMessageParam[] = options.messages || [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
    ];

    const model = options.model || "";
    const isExplicitCloud = model.includes("google/") || model.includes("anthropic/");
    const isGroqMode = config.aiProvider === "groq";
    const isOpenRouterMode = config.aiProvider === "openrouter";

    const task = async (): Promise<AIResponse> => {
        try {
            if (config.aiProvider === "anthropic") {
                return await withTimeout(callAnthropic(messages, options), 60_000, "askAI:anthropic");
            }
            if (config.aiProvider === "kimi") {
                return await withTimeout(callKimi(messages, options), 90_000, "askAI:kimi");
            }
            if (isGroqMode && !isExplicitCloud) {
                const timeoutMs = options.tools?.length ? 120_000 : 60_000;
                if (model.includes("gpt-") || !model || model === "llama-3.1-70b-versatile") {
                    options.model = config.groqModel || GROQ_MODEL;
                }
                return await withTimeout(callGroq(messages, options), timeoutMs, "askAI:groq");
            }

            if (isOpenRouterMode || isExplicitCloud) {
                return await withTimeout(callOpenRouter(messages, options), 90_000, "askAI:openrouter");
            }

            // Default fallback
            return await withTimeout(callOpenRouter(messages, options), 90_000, "askAI:openrouter");
        } catch (err: any) {
            const isCreditOrModelError = err.status === 402 || 
                                        err.status === 400 || 
                                        err.message?.toLowerCase().includes("credit") ||
                                        err.message?.toLowerCase().includes("not exist");

            if (isCreditOrModelError) {
                log(`[ai] Provider issue (${err.status}): ${err.message}. Triggering emergency Groq fallback...`, "error");
                // Explicitly force Groq fallback if OpenRouter/Anthropic fails due to credits
                try {
                    return await withTimeout(callGroq(messages, { ...options, model: GROQ_MODEL }), 60_000, "askAI:emergency:groq");
                } catch (groqErr: any) {
                    log(`[ai] Emergency Groq fallback failed: ${groqErr.message}`, "error");
                }
            }

            // Don't retry the fallback if the error is retryable (since withRetry handles retries inherently).
            // We only do the general fallback if it's NOT a rate limit.
            if (!model.includes("openrouter") && !isRetryable(err)) {
                log(`[ai] AI call failed: ${err.message}. Attempting general fallback...`, "error");
                try {
                    return await withTimeout(callOpenRouter(messages, { ...options }), 90_000, "askAI:openrouter:fallback");
                } catch (fallbackErr: any) {
                    log(`[ai] OpenRouter fallback failed. Attempting emergency Puter fallback...`, "warn");
                    try {
                        const puterContent = await puterService.ask(prompt || messages[messages.length-1].content as string);
                        return {
                            content: puterContent,
                            provider: "groq", // Mapping to groq for compatibility if needed, or update AIResponse
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
 * callAI — Wrapper for multi-message chat sessions (DramaAgent compatible)
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
