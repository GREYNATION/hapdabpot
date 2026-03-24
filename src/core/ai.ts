import { openai, anthropic, config, log } from "./config.js";

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
        if (provider === "openrouter") {
            const messages = options.messages || [
                { role: "system", content: systemPrompt },
                { role: "user", content: prompt }
            ];

            const completion = await openai.chat.completions.create({
                model,
                messages: messages as any[],
                temperature: options.temperature ?? 0.7,
                max_tokens: options.maxTokens,
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
            throw new Error("Gemini SDK has been removed. Please use OpenRouter for Gemini models.");
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
        throw err;
    }
}

/**
 * Fast, cost-effective chat for general bot responses.
 */
export async function simpleChat(input: string) {
    const res = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
            {
                role: "system",
                content: "You are HapdaBot, a smart AI assistant. Be helpful, short, and clear.",
            },
            {
                role: "user",
                content: input,
            },
        ],
    });

    return res.choices[0].message.content || "No response";
}
