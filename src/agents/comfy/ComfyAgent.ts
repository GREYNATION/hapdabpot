/**
 * ComfyAgent.ts
 * High-level agent that wraps the ComfyUI API with natural-language intelligence.
 *
 * Capabilities:
 *   - /imagine <prompt>          — text-to-image via SD1.5 or FLUX
 *   - /upscale <url>             — 4x upscale an image
 *   - /comfy status              — check if ComfyUI server is online
 *   - /comfy models              — list available checkpoints
 *   - /comfy queue               — show current queue
 *   - Natural language prompt enhancement via the AI layer
 *
 * The agent follows the Gravity Claw BaseAgent pattern:
 *   - Uses config.ts for env/credentials
 *   - Logs to ops console
 *   - Returns clean markdown strings for the Telegram bot
 */

import { log, logToOpsConsole, config } from "../../core/config.js";
import { askAI } from "../../core/ai.js";
import { comfyClient, ComfyOutput } from "./ComfyClient.js";
import {
    buildTxt2ImgWorkflow,
    buildFluxTxt2ImgWorkflow,
    buildUpscaleWorkflow,
    buildLtxVideoWorkflow,
    WORKFLOW_DESCRIPTIONS,
} from "./comfyWorkflows.js";

const AGENT_NAME = "ComfyAgent";

// ─── Prompt Enhancement ───────────────────────────────────────────────────────

async function enhancePrompt(rawPrompt: string): Promise<string> {
    try {
        const res = await askAI(
            rawPrompt,
            `You are a prompt engineer for AI image generation. 
Take the user's raw prompt and enhance it into a rich, detailed, high-quality image generation prompt.
Add: lighting style, camera lens, artistic style, mood, and quality tags (photorealistic, 8k, cinematic, etc.).
Keep it under 200 words. Return ONLY the enhanced prompt — no explanation, no quotes.`,
            { model: config.openaiModel }
        );
        return res.content?.trim() || rawPrompt;
    } catch {
        return rawPrompt; // fallback to raw prompt
    }
}

// ─── Main ComfyAgent Class ────────────────────────────────────────────────────

export class ComfyAgent {

    getName(): string {
        return AGENT_NAME;
    }

    // ─── Check if ComfyUI is online ─────────────────────────────────────────

    async checkStatus(): Promise<string> {
        const online = await comfyClient.isOnline().catch(() => false);
        if (!online) {
            return (
                `❌ **ComfyUI Offline**\n\n` +
                `The ComfyUI server is not reachable at \`${comfyClient.baseUrl}\`.\n\n` +
                `To start it locally:\n` +
                `\`\`\`\ncd ComfyUI && python main.py\n\`\`\`\n\n` +
                `Or set \`COMFYUI_HOST=your-host:8188\` in your environment.`
            );
        }

        try {
            const stats = await comfyClient.getSystemStats();
            const queue = await comfyClient.getQueueStatus();
            const vram = stats?.devices?.[0]?.vram_total ? 
                `${Math.round(stats.devices[0].vram_free / 1024 / 1024)}MB free / ${Math.round(stats.devices[0].vram_total / 1024 / 1024)}MB total` : 
                "N/A";

            return (
                `✅ **ComfyUI Online** — \`${comfyClient.baseUrl}\`\n\n` +
                `🖥️ **VRAM**: ${vram}\n` +
                `⏳ **Queue**: ${queue?.queue_running?.length || 0} running, ${queue?.queue_pending?.length || 0} pending`
            );
        } catch (err: any) {
            return `✅ ComfyUI is online but could not fetch full stats: ${err.message}`;
        }
    }

    // ─── List available models ───────────────────────────────────────────────

    async listModels(): Promise<string> {
        const online = await comfyClient.isOnline().catch(() => false);
        if (!online) return "❌ ComfyUI is offline. Cannot fetch models.";

        try {
            const models = await comfyClient.getAvailableModels();
            if (!models.length) return "⚠️ No checkpoints found. Add models to `ComfyUI/models/checkpoints/`.";
            return `🤖 **Available Checkpoints** (${models.length}):\n\n` + 
                   models.map((m, i) => `${i + 1}. \`${m}\``).join("\n");
        } catch (err: any) {
            return `❌ Failed to list models: ${err.message}`;
        }
    }

    // ─── Text to Image ────────────────────────────────────────────────────────

    async imagine(
        rawPrompt: string,
        options: {
            useFlux?: boolean;
            checkpoint?: string;
            width?: number;
            height?: number;
            steps?: number;
            enhancePrompt?: boolean;
        } = {}
    ): Promise<{ text: string; imageBuffers: Buffer[] }> {
        const { useFlux = false, enhancePrompt: doEnhance = true } = options;

        await logToOpsConsole(AGENT_NAME, `Generating image: "${rawPrompt.slice(0, 80)}"`, "think");

        const online = await comfyClient.isOnline().catch(() => false);
        if (!online) {
            return {
                text: "❌ **ComfyUI is offline.** Start it with `python main.py` in the ComfyUI directory.",
                imageBuffers: [],
            };
        }

        // Optionally enhance the prompt with AI
        const finalPrompt = doEnhance ? await enhancePrompt(rawPrompt) : rawPrompt;
        log(`[ComfyAgent] Enhanced prompt: ${finalPrompt.slice(0, 100)}...`);

        // Build workflow
        const workflow = useFlux
            ? buildFluxTxt2ImgWorkflow({
                prompt: finalPrompt,
                checkpoint: options.checkpoint,
                width: options.width || 1024,
                height: options.height || 1024,
                steps: options.steps || 4,
            })
            : buildTxt2ImgWorkflow({
                prompt: finalPrompt,
                checkpoint: options.checkpoint,
                width: options.width || 512,
                height: options.height || 512,
                steps: options.steps || 20,
            });

        // Track progress
        let lastProgress = "";
        comfyClient.on("progress", (p) => {
            if (p.step && p.totalSteps) {
                lastProgress = `Step ${p.step}/${p.totalSteps}`;
            }
        });

        try {
            const result = await comfyClient.run(workflow);
            const imageOutputs = result.outputs.filter(o => o.type === "image");

            if (!imageOutputs.length) {
                return { text: "⚠️ Generation completed but no images were produced.", imageBuffers: [] };
            }

            // Download the image bytes so Telegram can send them
            const imageBuffers: Buffer[] = [];
            for (const output of imageOutputs) {
                try {
                    const buf = await comfyClient.downloadOutput(output);
                    imageBuffers.push(buf);
                } catch (err: any) {
                    log(`[ComfyAgent] Failed to download output ${output.filename}: ${err.message}`, "warn");
                }
            }

            await logToOpsConsole(AGENT_NAME, `Image generation complete: ${imageOutputs.length} outputs`, "chat");

            const caption =
                `🎨 **Image Generated**\n\n` +
                `📝 **Original**: ${rawPrompt.slice(0, 100)}${rawPrompt.length > 100 ? "..." : ""}\n` +
                (doEnhance && finalPrompt !== rawPrompt 
                    ? `✨ **Enhanced**: ${finalPrompt.slice(0, 120)}${finalPrompt.length > 120 ? "..." : ""}\n` 
                    : "") +
                `🤖 **Model**: ${useFlux ? "FLUX" : "Stable Diffusion"}\n` +
                `📐 **Size**: ${options.width || (useFlux ? 1024 : 512)}×${options.height || (useFlux ? 1024 : 512)}`;

            return { text: caption, imageBuffers };
        } catch (err: any) {
            await logToOpsConsole(AGENT_NAME, `Generation failed: ${err.message}`, "error");
            return {
                text: `❌ **Generation Failed**\n\n${err.message}\n\n_Make sure a compatible checkpoint is loaded in ComfyUI._`,
                imageBuffers: [],
            };
        } finally {
            comfyClient.removeAllListeners("progress");
        }
    }

    // ─── Upscale an existing image ────────────────────────────────────────────

    async upscale(imageUrl: string): Promise<{ text: string; imageBuffers: Buffer[] }> {
        await logToOpsConsole(AGENT_NAME, `Upscaling: ${imageUrl}`, "think");

        const online = await comfyClient.isOnline().catch(() => false);
        if (!online) {
            return {
                text: "❌ **ComfyUI is offline.** Start it with `python main.py` in the ComfyUI directory.",
                imageBuffers: [],
            };
        }

        const workflow = buildUpscaleWorkflow({ imageUrl });

        try {
            const result = await comfyClient.run(workflow);
            const imageOutputs = result.outputs.filter(o => o.type === "image");

            const imageBuffers: Buffer[] = [];
            for (const output of imageOutputs) {
                try {
                    const buf = await comfyClient.downloadOutput(output);
                    imageBuffers.push(buf);
                } catch {}
            }

            return {
                text: `✅ **Upscaled** (4x) — ${imageOutputs.length} output(s)`,
                imageBuffers,
            };
        } catch (err: any) {
            return {
                text: `❌ **Upscale Failed**: ${err.message}\n\n_Ensure a 4x upscale model is in \`ComfyUI/models/upscale_models/\`_`,
                imageBuffers: [],
            };
        }
    }

    // ─── Text to Video (LTX-Video) ──────────────────────────────────────────

    async video(
        rawPrompt: string,
        options: {
            model?: string;
            duration?: number;
            resolution?: string;
            fps?: number;
        } = {}
    ): Promise<{ text: string; videoBuffers: Buffer[] }> {
        await logToOpsConsole(AGENT_NAME, `Generating video: "${rawPrompt.slice(0, 80)}"`, "think");

        const online = await comfyClient.isOnline().catch(() => false);
        if (!online) {
            return {
                text: "❌ **ComfyUI is offline.**",
                videoBuffers: [],
            };
        }

        const workflow = buildLtxVideoWorkflow({
            prompt: rawPrompt,
            model: options.model,
            duration: options.duration || 2,
            resolution: options.resolution || "512x512",
            fps: options.fps || 24,
        });

        try {
            const result = await comfyClient.run(workflow);
            const videoOutputs = result.outputs.filter(o => o.type === "video");

            if (!videoOutputs.length) {
                return { text: "⚠️ Video generation completed but no file produced.", videoBuffers: [] };
            }

            const videoBuffers: Buffer[] = [];
            for (const output of videoOutputs) {
                try {
                    const buf = await comfyClient.downloadOutput(output);
                    videoBuffers.push(buf);
                } catch {}
            }

            return {
                text: `🎬 **Video Generated (LTX-V)**\n\n📝 **Prompt**: ${rawPrompt}\n📐 **Res**: ${options.resolution || "512x512"}\n⏱️ **Duration**: ${options.duration || 2}s`,
                videoBuffers,
            };
        } catch (err: any) {
            await logToOpsConsole(AGENT_NAME, `Video failed: ${err.message}`, "error");
            return { text: `❌ **Video Failed**: ${err.message}`, videoBuffers: [] };
        }
    }

    // ─── Help text ────────────────────────────────────────────────────────────

    getHelp(): string {
        const wfList = Object.entries(WORKFLOW_DESCRIPTIONS)
            .map(([k, v]) => `  \`${k}\` — ${v}`)
            .join("\n");

        return (
            `🎨 **ComfyUI Agent** — Local AI Media Generation\n\n` +
            `**Commands:**\n` +
            `/imagine <prompt> — Generate an image (SD1.5)\n` +
            `/imagine flux <prompt> — Generate via FLUX.1\n` +
            `/video <prompt> — Generate text-to-video (LTX-V)\n` +
            `/upscale <url> — 4x AI upscale an image URL\n` +
            `/comfy status — Check ComfyUI server health\n` +
            `/comfy models — List available checkpoints\n` +
            `/comfy queue — Current generation queue\n` +
            `/comfy help — This menu\n\n` +
            `**Workflow types:**\n${wfList}\n\n` +
            `📡 Server: \`${comfyClient.baseUrl}\`\n` +
            `_Set \`COMFYUI_HOST=host:port\` to change the target._`
        );
    }
}

export const comfyAgent = new ComfyAgent();
