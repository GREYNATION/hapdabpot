/*
 * core/ai.ts — Modernized
 * Unified AI provider interface with Groq SDK + Timeout.
 */

import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import Groq from "groq-sdk";
import { config, log } from "./config.js";
import { withTimeout, getErrorMessage } from "./timeout.js";

// ── Clients (Re-initialized via initializeClients) ───────────────────────────
import * as cfg from "./config.js";

const GROQ_MODEL = "llama-3.3-70b-versatile"; // keep this exact string

export let openai = cfg.openai;
let groqClient = cfg.groq;
let openRouterClient: OpenAI;
let anthropicClient = cfg.anthropic;

/**
 * Re-initialize AI clients after config is fetched from Supabase.
 */
export function initializeClients() {
    log(`[ai] Re-initializing clients with fresh credentials...`);
    
    openai = cfg.openai;
    groqClient = cfg.groq;
    anthropicClient = cfg.anthropic;

    openRouterClient = new OpenAI({
        apiKey: process.env.OPENROUTER_API_KEY || "placeholder",
        baseURL: "https://openrouter.ai/api/v1",
        defaultHeaders: { "HTTP-Referer": "https://hapdabot.railway.app" },
    });
}

// ── State for Circuit Breaker ────────────────────────────────────────────────
let circuitBreakerOpen = false;
let consecutiveFailures = 0;
const BREAKER_THRESHOLD = 3;
const BREAKER_COOLDOWN = 60_000; // 60 seconds

function checkBreaker() {
    if (circuitBreakerOpen) {
        throw new Error("AI Circuit Breaker is OPEN. Cooling down to avoid 429 penalties.");
    }
}

function handleFailure(err: any) {
    const isRateLimit = err.status === 429 || 
                       (err.message && err.message.toLowerCase().includes("rate limit")) ||
                       (err.message && err.message.toLowerCase().includes("429"));

    if (isRateLimit) {
        consecutiveFailures++;
        if (consecutiveFailures >= BREAKER_THRESHOLD) {
            log(`[ai] Circuit Breaker TRIPPED due to consecutive rate limits. Pausing for ${BREAKER_COOLDOWN/1000}s.`, "error");
            circuitBreakerOpen = true;
            setTimeout(() => {
                circuitBreakerOpen = false;
                consecutiveFailures = 0;
                log(`[ai] Circuit Breaker RESET. Resuming operations.`, "info");
            }, BREAKER_COOLDOWN);
        }
    }
}

function resetFailure() {
    consecutiveFailures = 0;
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
        const tool_calls = msg.tool_calls?.map((tc) => ({
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

// ── Fallbacks ─────────────────────────────────────────────────────────────────

async function callOpenRouter(
    messages: OpenAI.ChatCompletionMessageParam[],
    options: AIOptions
): Promise<AIResponse> {
    const isMultimodal = messages.some(m => Array.isArray(m.content));
    const model = isMultimodal 
        ? "openai/gpt-4o" 
        : ("meta-llama/llama-3.3-70b-instruct:free");

    const completion = await openRouterClient.chat.completions.create({
        model,
        messages: messages as any,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens || 1000,
        response_format: options.jsonMode ? { type: "json_object" } : undefined,
    });

    const msg = completion.choices[0].message;
    return {
        content: msg.content || "",
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
    checkBreaker();

    const maxRetries = 3;
    let attempt = 0;

    const executeWithBackoff = async (): Promise<AIResponse> => {
        const messages: OpenAI.ChatCompletionMessageParam[] = options.messages || [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt },
        ];

        const model = options.model || "";
        const isExplicitCloud = model.includes("google/") || model.includes("anthropic/");
        const isGroqMode = config.aiProvider === "groq";
        const isOpenRouterMode = config.aiProvider === "openrouter";

        try {
            if (isGroqMode && !isExplicitCloud) {
                const timeoutMs = options.tools?.length ? 120_000 : 60_000;
                if (model.includes("gpt-") || !model || model === "llama-3.1-70b-versatile") {
                    options.model = config.groqModel || GROQ_MODEL;
                }
                const response = await withTimeout(callGroq(messages, options), timeoutMs, "askAI:groq");
                resetFailure();
                return response;
            }

            if (isOpenRouterMode || isExplicitCloud) {
                const response = await withTimeout(callOpenRouter(messages, options), 90_000, "askAI:openrouter");
                resetFailure();
                return response;
            }

            // Default fallback
            const response = await withTimeout(callOpenRouter(messages, options), 90_000, "askAI:openrouter");
            resetFailure();
            return response;
        } catch (err: any) {
            const isRateLimit = err.status === 429 || 
                               err.message?.toLowerCase().includes("rate limit") ||
                               err.message?.toLowerCase().includes("429");
            
            const isCreditOrModelError = err.status === 402 || 
                                        err.status === 400 || 
                                        err.message?.toLowerCase().includes("credit") ||
                                        err.message?.toLowerCase().includes("not exist");

            if (isRateLimit && attempt < maxRetries) {
                attempt++;
                handleFailure(err);
                const backoffMs = Math.pow(2, attempt) * 1000;
                log(`[ai] Rate limit encountered. Retrying in ${backoffMs}ms...`, "warn");
                await new Promise(r => setTimeout(r, backoffMs));
                return executeWithBackoff();
            }

            if (isCreditOrModelError) {
                log(`[ai] Provider issue (${err.status}): ${err.message}. Triggering emergency Groq fallback...`, "error");
                // Explicitly force Groq fallback if OpenRouter/Anthropic fails due to credits
                try {
                    return await withTimeout(callGroq(messages, { ...options, model: GROQ_MODEL }), 60_000, "askAI:emergency:groq");
                } catch (groqErr: any) {
                    log(`[ai] Emergency Groq fallback failed: ${groqErr.message}`, "error");
                }
            }

            log(`[ai] AI call failed: ${err.message}. Attempting general fallback...`, "error");
            
            if (!model.includes("openrouter")) {
                try {
                    return await withTimeout(callOpenRouter(messages, { ...options }), 90_000, "askAI:openrouter:fallback");
                } catch (fallbackErr: any) {
                    log(`[ai] All fallbacks failed.`, "error");
                }
            }
            throw err;
        }
    };

    return executeWithBackoff();
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
