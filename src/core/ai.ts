import { openai, anthropic, config, log } from "./config.js";
import { getRecentMessages } from "./memory.js";

export interface ToolCall {
    id: string;
    function: {
        name: string;
        arguments: string;
    };
}

export interface AIResponse {
    content: string;
    toolCalls?: ToolCall[];
}

export interface AIOptions {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    jsonMode?: boolean;
    tools?: any[];
    toolChoice?: "auto" | "none";
    messages?: any[]; // For multi-turn support
}

/**
 * Unified interface for calling different AI providers.
 */
export async function askAI(
    prompt: string,
    systemPrompt: string = "You are a helpful assistant.",
    options: AIOptions = {}
): Promise<AIResponse> {
    const provider = config.aiProvider;
    const model = options.model || config.openaiModel;

    log(`[ai] Calling ${provider} with model ${model}...`);

    try {
        if (provider === "groq") {
            const messages = options.messages || [
                { role: "system", content: systemPrompt },
                { role: "user", content: prompt }
            ];

            const completion = await openai.chat.completions.create({
                model,
                messages: messages as any[],
                temperature: options.temperature ?? 0.7,
                max_tokens: options.maxTokens || 1000,
                response_format: options.jsonMode ? { type: "json_object" } : undefined,
                tools: options.tools as any,
                tool_choice: options.toolChoice as any
            });

            const message = completion.choices[0].message;
            return {
                content: message.content || "",
                toolCalls: message.tool_calls as ToolCall[]
            };
        }

        if (provider === "gemini") {
            throw new Error("Gemini SDK has been removed. Please use Groq or OpenAI for compatible models.");
        }

        if (provider === "anthropic") {
            if (!anthropic) throw new Error("Anthropic client not initialized.");

            const messages = options.messages?.filter(m => m.role !== 'system') || [{ role: "user", content: prompt }];
            const system = options.messages?.find(m => m.role === 'system')?.content || systemPrompt;

            const message = await anthropic.messages.create({
                model: model.includes("/") ? model.split("/")[1] : model,
                max_tokens: options.maxTokens || 1024,
                system: system,
                messages: messages as any[],
                temperature: options.temperature ?? 0.7,
            });

            return {
                content: (message.content[0] as any).text || ""
            };
        }

        throw new Error(`Unsupported AI provider: ${provider}`);
    } catch (err: any) {
        log(`[error] AI Call failed: ${err.message}`, "error");
        if (err.status === 401 || err.message.includes("401") || err.message.includes("unauthorized") || err.message.includes("Authentication")) {
            return {
                content: "âš ï¸ AI service temporarily unavailable (Authentication error). Try again in a moment."
            };
        }
        throw err;
    }
}

/**
 * Fast, cost-effective chat for general bot responses.
 */
export async function simpleChat(input: string, chatId?: number) {
    try {
        const systemPrompt = "You are hapdabot. You have persistent memory of past conversations with this user. You are an advanced AI Trading Assistant and wholesale real estate agent. You have a built-in Master Trader agent hooked up to a TradingView webhook capable of institutional-grade order flow execution. If a user asks you to trade, tell them to send a TradingView webhook payload to `/webhook/tradingview` or execute the `/trade` and `/performance` commands to view their live P&L.";
        
        const history = chatId ? getRecentMessages(chatId, 10) : [];
        const messages = [
            { role: "system", content: systemPrompt },
            ...history.map(m => ({ role: m.role, content: m.content })),
            { role: "user", content: input }
        ];

        const res = await openai.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: messages as any[],
        });

        return res.choices[0].message.content || "No response";
    } catch (err: any) {
        log(`[error] SimpleChat failed: ${err.message}`, "error");
        if (err.status === 401 || err.message.includes("401") || err.message.includes("unauthorized")) {
            return "âš ï¸ AI service temporarily unavailable. Try again in a moment.";
        }
        return "I encountered an error. Please try again later.";
    }
}

