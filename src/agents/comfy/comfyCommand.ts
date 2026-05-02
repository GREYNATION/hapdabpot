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

export function registerComfyCommands(bot: Telegraf) {

    // ─── /imagine <prompt> ───────────────────────────────────────────────────

    bot.command("imagine", async (ctx: any) => {
        const raw = ctx.message.text.replace("/imagine", "").trim();

        if (!raw) {
            return ctx.reply(
                "🎨 **ComfyUI Image Generator**\n\n" +
                "Usage:\n" +
                "`/imagine <prompt>` — SD1.5 (512×512)\n" +
                "`/imagine flux <prompt>` — FLUX.1 (1024×1024)\n\n" +
                "Examples:\n" +
                "`/imagine a golden hour street scene in Brooklyn`\n" +
                "`/imagine flux a futuristic city at night, cinematic`",
                { parse_mode: "Markdown" }
            );
        }

        // Detect FLUX mode: /imagine flux <prompt>
        const useFlux = raw.toLowerCase().startsWith("flux ");
        const prompt = useFlux ? raw.slice(5).trim() : raw;

        if (!prompt) {
            return ctx.reply("⚠️ Please provide a prompt after `flux`.", { parse_mode: "Markdown" });
        }

        const thinkingMsg = await ctx.reply(
            useFlux
                ? "⚡ **FLUX.1 Generating...**\nEnhancing your prompt and queuing in ComfyUI. This may take 30–90 seconds..."
                : "🎨 **Generating Image...**\nEnhancing your prompt and queuing in ComfyUI. This may take 20–60 seconds...",
            { parse_mode: "Markdown" }
        );

        try {
            const { text, imageBuffers } = await comfyAgent.imagine(prompt, { useFlux });

            if (imageBuffers.length > 0) {
                // Send the generated image(s)
                for (const buf of imageBuffers) {
                    await ctx.replyWithPhoto(
                        { source: buf },
                        { caption: text, parse_mode: "Markdown" }
                    ).catch(async () => {
                        // If photo send fails (e.g. too large), send text only
                        await ctx.reply(text + "\n\n⚠️ _Image too large for direct send._", { parse_mode: "Markdown" });
                    });
                }
            } else {
                await ctx.reply(text, { parse_mode: "Markdown" });
            }
        } catch (err: any) {
            await ctx.reply(`❌ **ComfyUI Error**: ${err.message}`, { parse_mode: "Markdown" });
        }
    });

    // ─── /upscale <url> ──────────────────────────────────────────────────────

    bot.command("upscale", async (ctx: any) => {
        const imageUrl = ctx.message.text.replace("/upscale", "").trim();

        if (!imageUrl || !imageUrl.startsWith("http")) {
            return ctx.reply(
                "🔍 **4x AI Upscaler**\n\n" +
                "Usage: `/upscale <image_url>`\n\n" +
                "Example:\n`/upscale https://example.com/image.jpg`\n\n" +
                "_Requires an upscale model in `ComfyUI/models/upscale_models/`_",
                { parse_mode: "Markdown" }
            );
        }

        await ctx.reply("🔬 **Upscaling (4x)...**\nThis may take 20–60 seconds...", { parse_mode: "Markdown" });

        try {
            const { text, imageBuffers } = await comfyAgent.upscale(imageUrl);

            if (imageBuffers.length > 0) {
                for (const buf of imageBuffers) {
                    await ctx.replyWithPhoto(
                        { source: buf },
                        { caption: text, parse_mode: "Markdown" }
                    ).catch(async () => {
                        await ctx.reply(text + "\n\n⚠️ _Image too large for direct send._", { parse_mode: "Markdown" });
                    });
                }
            } else {
                await ctx.reply(text, { parse_mode: "Markdown" });
            }
        } catch (err: any) {
            await ctx.reply(`❌ **Upscale Error**: ${err.message}`, { parse_mode: "Markdown" });
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
                    await ctx.reply(statusText, { parse_mode: "Markdown" });
                    break;
                }
                case "models": {
                    await ctx.reply("📂 **Fetching available checkpoints...**");
                    const modelText = await comfyAgent.listModels();
                    if (modelText.length <= 4096) {
                        await ctx.reply(modelText, { parse_mode: "Markdown" });
                    } else {
                        const chunks = modelText.match(/[\s\S]{1,4000}/g) ?? [modelText];
                        for (const chunk of chunks) await ctx.reply(chunk, { parse_mode: "Markdown" }).catch(() => {});
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
                        `⏳ **ComfyUI Queue**\n\n🏃 Running: ${running}\n⏸️ Pending: ${pending}`,
                        { parse_mode: "Markdown" }
                    );
                    break;
                }
                case "help":
                default: {
                    const helpText = comfyAgent.getHelp();
                    await ctx.reply(helpText, { parse_mode: "Markdown" });
                    break;
                }
            }
        } catch (err: any) {
            ctx.reply(`❌ ComfyUI Error: ${err.message}`);
        }
    });

    log("[comfy] ComfyUI commands registered: /imagine, /upscale, /comfy");
}
