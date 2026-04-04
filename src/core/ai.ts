/**
 * core/ai.ts — UPGRADED
 * Unified AI provider interface.
 * Supports: Groq, Anthropic, OpenRouter (auto-fallback)
 * Added: Tool calling, streaming, token tracking, parseToolArgs, buildTool
 */

import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { config, log } from "./config.js";

// ── Clients ───────────────────────────────────────────────────────────────────

const groqClient = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1",
});

const openRouterClient = new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: { "HTTP-Referer": "https://hapdabot.railway.app" },
});

const anthropicClient = process.env.ANTHROPIC_API_KEY
    ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    : null;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ToolCall {
    id: string;
    function: {
        name: string;
        arguments: string; // JSON string — parse with parseToolArgs()
    };
}

export interface AIResponse {
    content: string;
    toolCalls?: ToolCall[];
    provider: "groq" | "openrouter" | "anthropic";
    tokens?: number;
    model: string;
}

export interface AITool {
    name: string;
    description: string;
    parameters: {
        type: "object";
        properties: Record<string, { type: string; description: string; enum?: string[] }>;
        required?: string[];
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
    onChunk?: (chunk: string) => void; // streaming callback — fires on every token
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// Groq rejects tool_calls on assistant messages and role:'tool' messages — strip them
function cleanForGroq(
    messages: OpenAI.ChatCompletionMessageParam[]
): OpenAI.ChatCompletionMessageParam[] {
    return messages
        .filter((m) => m.role !== "tool")
        .map((m) => {
            if (m.role === "assistant") {
                const { tool_calls, ...rest } = m as any;
                return rest;
            }
            return m;
        });
}

// ── Groq ──────────────────────────────────────────────────────────────────────

async function callGroq(
    messages: OpenAI.ChatCompletionMessageParam[],
    options: AIOptions
): Promise<AIResponse> {
    const model = options.model || config.openaiModel || "llama-3.3-70b-versatile";
    const cleaned = cleanForGroq(messages);

    // Streaming (no tools when streaming)
    if (options.stream && options.onChunk) {
        const stream = await groqClient.chat.completions.create({
            model,
            messages: cleaned,
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

    // Tool calling
    if (options.tools?.length) {
        const completion = await groqClient.chat.completions.create({
            model,
            messages: cleaned,
            temperature: options.temperature ?? 0.7,
            max_tokens: options.maxTokens || 1000,
            tools: options.tools.map((t) => ({
                type: "function" as const,
                function: { name: t.name, description: t.description, parameters: t.parameters },
            })),
            tool_choice: options.toolChoice ?? "auto",
        });

        const msg = completion.choices[0].message;
        return {
            content: msg.content || "",
            toolCalls: msg.tool_calls?.map((tc) => ({
                id: tc.id,
                function: { name: tc.function.name, arguments: tc.function.arguments },
            })),
            provider: "groq",
            tokens: completion.usage?.total_tokens,
            model,
        };
    }

    // Standard
    const completion = await groqClient.chat.completions.create({
        model,
        messages: cleaned,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens || 1000,
        response_format: options.jsonMode ? { type: "json_object" } : undefined,
    });

    return {
        content: completion.choices[0].message.content || "",
        provider: "groq",
        tokens: completion.usage?.total_tokens,
        model,
    };
}

// ── OpenRouter fallback ───────────────────────────────────────────────────────

async function callOpenRouter(
    messages: OpenAI.ChatCompletionMessageParam[],
    options: AIOptions
): Promise<AIResponse> {
    const model = "google/gemini-2.0-flash-lite:free";
    const completion = await openRouterClient.chat.completions.create({
        model,
        messages: cleanForGroq(messages),
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens || 1000,
    });

    return {
        content: completion.choices[0].message.content || "",
        provider: "openrouter",
        tokens: completion.usage?.total_tokens,
        model,
    };
}

// ── Anthropic ─────────────────────────────────────────────────────────────────

async function callAnthropic(
    messages: OpenAI.ChatCompletionMessageParam[],
    options: AIOptions
): Promise<AIResponse> {
    if (!anthropicClient) throw new Error("ANTHROPIC_API_KEY not set.");

    const model = options.model?.includes("/")
        ? options.model.split("/")[1]
        : options.model || "claude-sonnet-4-5";

    const systemMsg = messages.find((m) => m.role === "system");
    const nonSystem = messages.filter((m) => m.role !== "system");
    const system = typeof systemMsg?.content === "string" ? systemMsg.content : undefined;

    // Streaming
    if (options.stream && options.onChunk) {
        const stream = anthropicClient.messages.stream({
            model,
            max_tokens: options.maxTokens || 1024,
            system,
            messages: nonSystem as any,
            temperature: options.temperature ?? 0.7,
        });

        let fullContent = "";
        stream.on("text", (text) => {
            fullContent += text;
            options.onChunk!(text);
        });

        await stream.finalMessage();
        return { content: fullContent, provider: "anthropic", model };
    }

    // Tool calling
    if (options.tools?.length) {
        const response = await anthropicClient.messages.create({
            model,
            max_tokens: options.maxTokens || 1024,
            system,
            messages: nonSystem as any,
            tools: options.tools.map((t) => ({
                name: t.name,
                description: t.description,
                input_schema: t.parameters,
            })),
        });

        const toolBlocks = response.content.filter((b) => b.type === "tool_use");
        const textBlocks = response.content.filter((b) => b.type === "text");

        return {
            content: textBlocks.map((b: any) => b.text).join("") || "",
            toolCalls: toolBlocks.map((b: any) => ({
                id: b.id,
                function: { name: b.name, arguments: JSON.stringify(b.input) },
            })),
            provider: "anthropic",
            tokens: response.usage.input_tokens + response.usage.output_tokens,
            model,
        };
    }

    // Standard
    const response = await anthropicClient.messages.create({
        model,
        max_tokens: options.maxTokens || 1024,
        system,
        messages: nonSystem as any,
        temperature: options.temperature ?? 0.7,
    });

    const textContent = response.content.find((b) => b.type === "text");
    return {
        content: textContent?.type === "text" ? textContent.text : "",
        provider: "anthropic",
        tokens: response.usage.input_tokens + response.usage.output_tokens,
        model,
    };
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * askAI — unified call with auto-fallback (Groq → OpenRouter).
 *
 * Standard:
 *   const res = await askAI("What is MAO?", "You are a real estate expert.");
 *
 * Tool calling:
 *   const res = await askAI("Research 123 Main St", system, { tools: [searchTool] });
 *   if (res.toolCalls) {
 *     const args = parseToolArgs<{ address: string }>(res.toolCalls[0]);
 *   }
 *
 * Streaming to Telegram:
 *   await askAI("Write my briefing", system, {
 *     stream: true,
 *     onChunk: (chunk) => process.stdout.write(chunk),
 *   });
 */
export async function askAI(
    prompt: string,
    systemPrompt = "You are a helpful assistant.",
    options: AIOptions = {}
): Promise<AIResponse> {
    let provider = (config.aiProvider as string) || "groq";
    if (provider === "openrouter") provider = "groq"; // openrouter is fallback only

    const messages: OpenAI.ChatCompletionMessageParam[] = options.messages || [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
    ];

    log(
        `[ai] provider=${provider} model=${options.model || config.openaiModel} ` +
        `tools=${options.tools?.length ?? 0} stream=${!!options.stream} json=${!!options.jsonMode}`
    );

    try {
        if (provider === "anthropic") return await callAnthropic(messages, options);
        return await callGroq(messages, options);
    } catch (err) {
        log(`[ai] ${provider} failed → OpenRouter fallback. Error: ${err}`);
        try {
            return await callOpenRouter(messages, options);
        } catch (fallbackErr) {
            throw new Error(`All AI providers failed. Last error: ${fallbackErr}`);
        }
    }
}

// ── Utility exports ───────────────────────────────────────────────────────────

/**
 * Parse tool call arguments safely with TypeScript generic.
 *
 * const args = parseToolArgs<{ address: string; arv: number }>(toolCall);
 * console.log(args.address); // typed
 */
export function parseToolArgs<T = Record<string, unknown>>(toolCall: ToolCall): T {
    try {
        return JSON.parse(toolCall.function.arguments) as T;
    } catch {
        throw new Error(
            `Failed to parse args for "${toolCall.function.name}": ${toolCall.function.arguments}`
        );
    }
}

/**
 * Build a tool definition with less boilerplate.
 *
 * const searchTool = buildTool(
 *   "brave_search",
 *   "Search the web for property info",
 *   { query: { type: "string", description: "search terms" } },
 *   ["query"]
 * );
 */
export function buildTool(
    name: string,
    description: string,
    properties: AITool["parameters"]["properties"],
    required: string[] = []
): AITool {
    return { name, description, parameters: { type: "object", properties, required } };
}