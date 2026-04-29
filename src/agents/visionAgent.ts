import { BaseAgent } from "./baseAgent.js";
import { config, log } from "../core/config.js";
import Anthropic from "@anthropic-ai/sdk";
import screenshot from "screenshot-desktop";
import * as fs from "fs";
import * as path from "path";

/**
 * Unified VisionAgent — Handles both image URL analysis and local screen captures.
 */
export class VisionAgent extends BaseAgent {
    private anthropic: Anthropic | null = null;
    private SCREENSHOT_PATH = path.join(process.cwd(), "screen-capture.jpg");

    constructor() {
        super();
        if (process.env.ANTHROPIC_API_KEY) {
            this.anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        }
    }

    public getName(): string {
        return "Visionary";
    }

    /**
     * Captures the current desktop screen and returns base64.
     */
    private async captureScreen(): Promise<string> {
        log("[vision] Capturing desktop screen...");
        const imgBuffer = await screenshot({ format: "jpg" });
        fs.writeFileSync(this.SCREENSHOT_PATH, imgBuffer);
        return imgBuffer.toString("base64");
    }

    /**
     * Primary entry point for task routing.
     */
    public async ask(query: string): Promise<{ content: string }> {
        // If the task implies a screenshot or desktop view
        if (query.toLowerCase().includes("screenshot") || query.toLowerCase().includes("screen") || query.toLowerCase().includes("desktop")) {
            const analysis = await this.analyzeScreen(query);
            return { content: `**[Visionary]**: ${analysis}` };
        }

        return { content: "**[Visionary]**: I can analyze your screen or any images you provide. Try asking 'What is on my screen?'" };
    }

    /**
     * Analyzes the current desktop screen using Claude Multimodal.
     */
    public async analyzeScreen(prompt: string): Promise<string> {
        if (!this.anthropic) {
            return "❌ Anthropic API key is missing. Visual analysis unavailable.";
        }

        try {
            const base64Image = await this.captureScreen();
            
            const response = await this.anthropic.messages.create({
                model: "claude-3-5-sonnet-latest", // Upgraded to latest sonnet
                max_tokens: 1024,
                messages: [
                    {
                        role: "user",
                        content: [
                            {
                                type: "image",
                                source: {
                                    type: "base64",
                                    media_type: "image/jpeg",
                                    data: base64Image,
                                },
                            },
                            {
                                type: "text",
                                text: prompt,
                            },
                        ],
                    },
                ],
            });

            const result = response.content[0].type === "text" ? response.content[0].text : "Could not analyze screen.";
            return result;
        } catch (err: any) {
            log(`[vision] Screen analysis failed: ${err.message}`, "error");
            return `Vision error: ${err.message}`;
        }
    }

    /**
     * Analyzes an external image URL (used by property/real estate agents).
     */
    public async analyzeImage(imageUrl: string, prompt: string): Promise<string> {
        // Implementation for external URLs using OpenRouter or GPT-4o
        // Bypassing askAI to ensure multimodal formatting.
        try {
            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: "openai/gpt-4o",
                    messages: [
                        {
                            role: "user",
                            content: [
                                { type: "text", text: prompt },
                                { type: "image_url", image_url: { url: imageUrl } }
                            ]
                        }
                    ]
                })
            });

            const data = await response.json();
            return data.choices?.[0]?.message?.content || "❌ Model returned no content.";
        } catch (err: any) {
            return `❌ Image analysis failed: ${err.message}`;
        }
    }
}
