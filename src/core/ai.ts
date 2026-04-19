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
    const messages: OpenAI.ChatCompletionMessageParam[] = options.messages || [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
    ];

    // Intelligent Routing:
    const model = options.model || "";
    const isExplicitCloud = model.includes("google/") || model.includes("anthropic/");
    const isGroqMode = config.aiProvider === "groq";

    // If we're in Groq mode, we want to stay in Groq unless it's a model Groq physically CANNOT do (like multimodal)
    if (isGroqMode && !isExplicitCloud) {
        try {
            const timeoutMs = options.tools?.length ? 120_000 : 60_000;
            // Use the versatile model for standard Council calls
            if (model.includes("gpt-") || !model || model === "llama-3.1-70b-versatile") {
                options.model = config.groqModel || GROQ_MODEL;
            }
            const systemWithProtocol = systemPrompt + "\n\nSTRICT PROTOCOL: You MUST use JSON tools. DO NOT use XML <function> tags. Stay in character.";
            return await withTimeout(callGroq(messages, { ...options }), timeoutMs, "askAI:groq");
        } catch (err: any) {
            log(`[ai] Groq call failed: ${err.message}. ${config.openaiApiKey ? "Attempting OpenRouter fallback..." : "No fallback available."}`, "warn");
            if (!config.openaiApiKey) throw err;
            // PRESERVE TOOLS in fallback
            return await withTimeout(callOpenRouter(messages, { ...options, tools: options.tools }), 90_000, "askAI:openrouter");
        }
    }

    // Default legacy path (OpenRouter/OpenAI)
    try {
        return await withTimeout(callOpenRouter(messages, options), 90_000, "askAI:openrouter");
    } catch (err) {
        log(`[ai] OpenAI/OpenRouter failed. Error: ${getErrorMessage(err)}`, "error");
        throw err;
    }
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
