/**
 * comfyCommand.ts
 * Telegram bot commands for the ComfyAgent / ComfyUI integration.
 *
 * Commands registered:
 *   /imagine <prompt>           — SD1.5 text-to-image
 *   /imagine flux <prompt>      — FLUX.1 text-to-image
 *   /upscale <url>              — 4x upscale an image URL
 *   /comfy [status|models|queue|help]
 */

import { Telegraf } from "telegraf";
import { comfyAgent } from "./ComfyAgent.js";
import { log } from "../../core/config.js";
import { sanitizeHTML } from "../../core/telegramUtils.js";

export function registerComfyCommands(bot: Telegraf) {

    // ─── /imagine <prompt> ───────────────────────────────────────────────────

    bot.command("imagine", async (ctx: any) => {
        const raw = ctx.message.text.replace("/imagine", "").trim();

        if (!raw) {
            return ctx.reply(
                "<b>🎨 ComfyUI Image Generator</b>\n\n" +
                "Usage:\n" +
                "<code>/imagine &lt;prompt&gt;</code> — SD1.5 (512×512)\n" +
                "<code>/imagine flux &lt;prompt&gt;</code> — FLUX.1 (1024×1024)\n\n" +
                "Examples:\n" +
                "<code>/imagine a golden hour street scene in Brooklyn</code>\n" +
                "<code>/imagine flux a futuristic city at night, cinematic</code>",
                { parse_mode: "HTML" }
            );
        }

        // Detect FLUX mode: /imagine flux <prompt>
        const useFlux = raw.toLowerCase().startsWith("flux ");
        const prompt = useFlux ? raw.slice(5).trim() : raw;

        if (!prompt && useFlux) {
            return ctx.reply("⚠️ Please provide a prompt after <code>flux</code>.", { parse_mode: "HTML" });
        }

        const thinkingMsg = await ctx.reply(
            useFlux
                ? "⚡ <b>FLUX.1 Generating...</b>\nEnhancing your prompt and queuing in ComfyUI. This may take 30–90 seconds..."
                : "🎨 <b>Generating Image...</b>\nEnhancing your prompt and queuing in ComfyUI. This may take 20–60 seconds...",
            { parse_mode: "HTML" }
        );

        try {
            const { text, imageBuffers } = await comfyAgent.imagine(prompt, { useFlux });

            if (imageBuffers.length > 0) {
                // Send the generated image(s)
                for (const buf of imageBuffers) {
                    await ctx.replyWithPhoto(
                        { source: buf },
                        { caption: text, parse_mode: "HTML" }
                    ).catch(async () => {
                        // If photo send fails (e.g. too large), send text only
                        await ctx.reply(text + "\n\n⚠️ <i>Image too large for direct send.</i>", { parse_mode: "HTML" });
                    });
                }
            } else {
                await ctx.reply(text, { parse_mode: "HTML" });
            }
        } catch (err: any) {
            await ctx.reply(`❌ <b>ComfyUI Error</b>: ${sanitizeHTML(err.message)}`, { parse_mode: "HTML" });
        }
    });

    // ─── /video <prompt> ─────────────────────────────────────────────────────

    bot.command("video", async (ctx: any) => {
        const prompt = ctx.message.text.replace("/video", "").trim();

        if (!prompt) {
            return ctx.reply(
                "<b>🎬 LTX-Video Generator</b>\n\n" +
                "Usage: <code>/video &lt;prompt&gt;</code>\n\n" +
                "Example:\n<code>/video Spider Jr walking through a futuristic city, cartoon style</code>",
            );
        }

        await ctx.reply("🎬 <b>Generating Video (LTX-V)...</b>\nThis will take a significant amount of time on CPU (10–30 mins). Please be patient!", { parse_mode: "HTML" });

        try {
            const { text, videoBuffers } = await comfyAgent.video(prompt);

            if (videoBuffers.length > 0) {
                for (const buf of videoBuffers) {
                    await ctx.replyWithVideo(
                        { source: buf },
                        { caption: text, parse_mode: "HTML" }
                    ).catch(async () => {
                        await ctx.reply(text + "\n\n⚠️ <i>Video too large for direct send.</i>", { parse_mode: "HTML" });
                    });
                }
            } else {
                await ctx.reply(text, { parse_mode: "HTML" });
            }
        } catch (err: any) {
            await ctx.reply(`❌ <b>Video Error</b>: ${sanitizeHTML(err.message)}`, { parse_mode: "HTML" });
        }
    });

    // ─── /upscale <url> ──────────────────────────────────────────────────────

    bot.command("upscale", async (ctx: any) => {
        const imageUrl = ctx.message.text.replace("/upscale", "").trim();

        if (!imageUrl || !imageUrl.startsWith("http")) {
            return ctx.reply(
                "<b>🔍 4x AI Upscaler</b>\n\n" +
                "Usage: <code>/upscale &lt;image_url&gt;</code>\n\n" +
                "Example:\n<code>/upscale https://example.com/image.jpg</code>\n\n" +
                "<i>Requires an upscale model in <code>ComfyUI/models/upscale_models/</code></i>",
                { parse_mode: "HTML" }
            );
        }

        await ctx.reply("🔬 <b>Upscaling (4x)...</b>\nThis may take 20–60 seconds...", { parse_mode: "HTML" });

        try {
            const { text, imageBuffers } = await comfyAgent.upscale(imageUrl);

            if (imageBuffers.length > 0) {
                for (const buf of imageBuffers) {
                    await ctx.replyWithPhoto(
                        { source: buf },
                        { caption: text, parse_mode: "HTML" }
                    ).catch(async () => {
                        await ctx.reply(text + "\n\n⚠️ <i>Image too large for direct send.</i>", { parse_mode: "HTML" });
                    });
                }
            } else {
                await ctx.reply(text, { parse_mode: "HTML" });
            }
        } catch (err: any) {
            await ctx.reply(`❌ <b>Upscale Error</b>: ${sanitizeHTML(err.message)}`, { parse_mode: "HTML" });
        }
    });

    // ─── /comfy [status|models|queue|help] ───────────────────────────────────

    bot.command("comfy", async (ctx: any) => {
        const args = ctx.message.text.replace("/comfy", "").trim().toLowerCase();
        const sub = args.split(/\s+/)[0] || "help";

        try {
            switch (sub) {
                case "status": {
                    const statusText = await comfyAgent.checkStatus();
                    await ctx.reply(statusText, { parse_mode: "HTML" });
                    break;
                }
                case "models": {
                    await ctx.reply("<b>📂 Fetching available checkpoints...</b>", { parse_mode: "HTML" });
                    const modelText = await comfyAgent.listModels();
                    if (modelText.length <= 4096) {
                        await ctx.reply(modelText, { parse_mode: "HTML" });
                    } else {
                        const chunks = modelText.match(/[\s\S]{1,4000}/g) ?? [modelText];
                        for (const chunk of chunks) await ctx.reply(chunk, { parse_mode: "HTML" }).catch(() => {});
                    }
                    break;
                }
                case "queue": {
                    const { comfyClient: client } = await import("./ComfyClient.js");
                    if (!await client.isOnline()) {
                        return ctx.reply("❌ ComfyUI is offline.");
                    }
                    const queue = await client.getQueueStatus();
                    const running = queue?.queue_running?.length || 0;
                    const pending = queue?.queue_pending?.length || 0;
                    await ctx.reply(
                        `⏳ <b>ComfyUI Queue</b>\n\n🏃 Running: ${running}\n⏸️ Pending: ${pending}`,
                        { parse_mode: "HTML" }
                    );
                    break;
                }
                case "help":
                default: {
                    const helpText = comfyAgent.getHelp();
                    await ctx.reply(helpText, { parse_mode: "HTML" });
                    break;
                }
            }
        } catch (err: any) {
            ctx.reply(`❌ ComfyUI Error: ${err.message}`);
        }
    });

    log("[comfy] ComfyUI commands registered: /imagine, /video, /upscale, /comfy");
}
