/**
 * SpiderAgent.ts
 * Dedicated agent for Spider Jr. cartoon production.
 * 
 * Video Generation Strategy:
 *   1. PRIMARY: fal.ai cloud LTX-Video (fast, reliable, no local server needed)
 *   2. FALLBACK: Local ComfyUI server (if fal.ai key is missing or fails)
 */

import { log, logToOpsConsole } from "../../core/config.js";
import { askAI } from "../../core/ai.js";
import { comfyAgent } from "../comfy/ComfyAgent.js";
import { SEASON_1 } from "../ContentSchedulerAgent.js";
import * as fs from "fs";
import * as path from "path";

import { spiderSeason1, SpiderScript } from './SpiderScripts.js';
import { falVideoClient } from './FalVideoClient.js';

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
        const script = spiderSeason1.find(s => s.id.toUpperCase() === epCode.toUpperCase());
        
        if (!episode) {
            return { success: false, error: `Episode ${epCode} not found in Season 1 registry.` };
        }

        const title = episode.title;
        const theme = episode.theme;
        
        onProgress?.(`🎬 Planning episode ${epCode}: "${title}"`);

        // 2. Use hardcoded prompt if available, otherwise fallback to AI
        let finalPrompt = "";
        if (script) {
            onProgress?.(`📜 Using high-quality script from Season 1 Prompt Pack.`);
            finalPrompt = script.prompt;
        } else {
            onProgress?.(`🤖 No script found in pack. Generating AI prompt...`);
            const enhancedPrompt = await askAI(
                `Create a detailed LTX-Video prompt for a Spider-Man Kids Cartoon (Spider Jr.).
                Title: ${title}
                Theme: ${theme}
                Style: 3D Animation, Pixar-style, high quality, bright colors, friendly characters.
                Resolution: 720x1280
                Return ONLY the prompt.`,
                "You are a cartoon director."
            );
            finalPrompt = enhancedPrompt.content;
        }

        // Always use local ComfyUI
        onProgress?.(`📽️ Filming in ComfyUI @ 704x1280 (9:16)...`);
        return this.generateViaComfy(epCode, episode, finalPrompt, onProgress);
    }

    /**
     * Generate video via fal.ai cloud API.
     */
    private async generateViaFal(
        epCode: string,
        prompt: string,
        onProgress?: (msg: string) => void
    ): Promise<{ success: boolean; buffer?: Buffer; error?: string }> {
        try {
            log(`[SpiderAgent] ☁️ Starting fal.ai production for ${epCode}...`);
            
            const result = await falVideoClient.generateVideo({
                prompt,
                width: 704,
                height: 1280,
                numFrames: 97,  // ~4 seconds at 24fps
                fps: 24,
                numInferenceSteps: 30,
                guidanceScale: 7.5,
            });

            if (!result.success || !result.videoBuffer) {
                return { success: false, error: result.error || "No video buffer returned" };
            }

            log(`[SpiderAgent] ☁️ fal.ai video received: ${(result.videoBuffer.length / 1024 / 1024).toFixed(1)}MB`);
            onProgress?.(`✅ Video generated! ${(result.videoBuffer.length / 1024 / 1024).toFixed(1)}MB`);
            return { success: true, buffer: result.videoBuffer };

        } catch (err: any) {
            log(`[SpiderAgent] fal.ai error: ${err.message}`, "error");
            return { success: false, error: err.message };
        }
    }

    /**
     * Generate video via local ComfyUI server (fallback).
     */
    private async generateViaComfy(
        epCode: string,
        episode: any,
        prompt: string,
        onProgress?: (msg: string) => void
    ): Promise<{ success: boolean; url?: string; error?: string }> {
        try {
            log(`[SpiderAgent] 🔄 Starting ComfyUI production for ${epCode}...`);
            const result = await comfyAgent.video(prompt, {
                duration: 4,
                resolution: "704x1280"
            });

            log(`[SpiderAgent] ComfyUI result: ${JSON.stringify({ hasBuffers: result.videoBuffers.length > 0, count: result.videoBuffers.length })}`);

            if (!result.videoBuffers || result.videoBuffers.length === 0) {
                log(`[SpiderAgent] ❌ No video buffer from ComfyUI for ${epCode}`, "error");
                return { success: false, error: "No video produced. Is ComfyUI running at " + (process.env.COMFYUI_HOST || "127.0.0.1:8188") + "?" };
            }

            return this.saveVideo(epCode, episode, result.videoBuffers[0], onProgress);

        } catch (err: any) {
            log(`[SpiderAgent] ComfyUI error: ${err.message}`, "error");
            return { success: false, error: err.message };
        }
    }

    /**
     * Save a video buffer to disk.
     */
    private async saveVideo(
        epCode: string,
        episode: any,
        buffer: Buffer,
        onProgress?: (msg: string) => void
    ): Promise<{ success: boolean; url?: string; error?: string }> {
        const filename = episode.filename;
        const outputPath = path.join(VIDEO_DIR, filename);

        if (!fs.existsSync(VIDEO_DIR)) fs.mkdirSync(VIDEO_DIR, { recursive: true });
        fs.writeFileSync(outputPath, buffer);

        log(`[SpiderAgent] ✅ Episode ${epCode} saved: ${outputPath} (${(buffer.length / 1024 / 1024).toFixed(1)}MB)`);
        onProgress?.(`💾 Saved to ${outputPath}`);
        await logToOpsConsole(this.getName(), `✅ Episode ${epCode} produced and saved to ${outputPath}`, "chat");
        return { success: true, url: outputPath };
    }
}

export const spiderAgent = new SpiderAgent();
