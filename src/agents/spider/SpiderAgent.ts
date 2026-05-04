/**
 * SpiderAgent.ts
 * Dedicated agent for Spider Jr. cartoon production.
 * Bridges the ContentSchedulerAgent registry with the ComfyAgent video pipeline.
 */

import { log, logToOpsConsole } from "../../core/config.js";
import { askAI } from "../../core/ai.js";
import { comfyAgent } from "../comfy/ComfyAgent.js";
import { SEASON_1 } from "../ContentSchedulerAgent.js";
import * as fs from "fs";
import * as path from "path";

const VIDEO_DIR = process.env.VIDEO_DIR || "./videos/spidey";

export class SpiderAgent {
    getName(): string {
        return "SpiderJr";
    }

    /**
     * Produces a specific episode from the Season 1 registry.
     */
    async produceEpisode(epCode: string, onProgress?: (msg: string) => void): Promise<{ success: boolean; url?: string; error?: string }> {
        await logToOpsConsole(this.getName(), `Starting production for ${epCode}`, "think");
        
        // 1. Get episode details from the exported registry
        const episode = SEASON_1.find(e => e.ep.toUpperCase() === epCode.toUpperCase());
        
        if (!episode) {
            return { success: false, error: `Episode ${epCode} not found in Season 1 registry.` };
        }

        const theme = episode.theme;
        const title = episode.title;
        
        onProgress?.(`🎬 Planning episode ${epCode}: "${title}" (${theme})`);

        // 2. Enhance prompt for Cartoon LTX-Video
        const enhancedPrompt = await askAI(
            `Create a detailed LTX-Video prompt for a Spider-Man Kids Cartoon (Spider Jr.).
            Title: ${title}
            Theme: ${theme}
            Style: 3D Animation, Pixar-style, bright colors, friendly characters, smooth movement, no violence, kid-friendly.
            Resolution: 512x512
            Return ONLY the prompt.`,
            "You are a cartoon director."
        );

        onProgress?.(`📽️ Filming in ComfyUI... (This takes 10-20 mins)`);

        try {
            const result = await comfyAgent.video(enhancedPrompt.content, {
                duration: 3,
                resolution: "512x512"
            });

            if (result.videoBuffers.length > 0) {
                const buffer = result.videoBuffers[0];
                // Use the exact filename expected by the scheduler
                const filename = episode.filename; 
                const outputPath = path.join(VIDEO_DIR, filename);

                if (!fs.existsSync(VIDEO_DIR)) fs.mkdirSync(VIDEO_DIR, { recursive: true });
                fs.writeFileSync(outputPath, buffer);

                await logToOpsConsole(this.getName(), `✅ Episode ${epCode} produced and saved to ${outputPath}`, "chat");
                return { success: true, url: outputPath };
            } else {
                return { success: false, error: "No video produced by ComfyUI" };
            }
        } catch (err: any) {
            return { success: false, error: err.message };
        }
    }
}

export const spiderAgent = new SpiderAgent();
