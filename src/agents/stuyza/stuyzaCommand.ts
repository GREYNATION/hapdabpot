/**
 * stuyzaCommand.ts
 * Telegram bot commands for Stuyza Productions / OpenMontage integration
 *
 * Commands:
 *   /stuyza [prompt]        — Produce a video from description
 *   /stuyza explain [topic] — Real estate explainer video
 *   /stuyza cinematic [desc]— Cinematic scene/drama
 *   /stuyza social [topic]  — Social media clip
 *   /stuyza pipelines       — List available pipelines
 */

import fs from "fs";
import { Telegraf } from "telegraf";
import { StuyzaVideoAgent, produceVideo, produceCinematicScene, produceSocialClip } from "./StuyzaVideoAgent.js";
import { VideoProductionResult } from "./StuyzaVideoAgent.js";
import { log } from "../../core/config.js";

/**
 * Send a rendered video to Telegram.
 * Streams the local file if it exists on disk; falls back to a text reply.
 */
async function sendVideo(ctx: any, result: VideoProductionResult, caption: string) {
  if (result.outputPath && fs.existsSync(result.outputPath)) {
    const stats = fs.statSync(result.outputPath);
    const fileSizeMB = stats.size / (1024 * 1024);
    if (fileSizeMB > 49) {
      // Telegram bot API limit is 50 MB
      await ctx.reply(
        `${caption}\n\n⚠️ Video is ${fileSizeMB.toFixed(1)} MB — too large to send directly via Telegram (50 MB limit).\n📁 Stored at: ${result.outputPath}`
      );
    } else {
      await ctx.replyWithVideo(
        { source: fs.createReadStream(result.outputPath) },
        { caption }
      );
    }
  } else {
    // File not found — just report the path
    await ctx.reply(`${caption}\n\n🎬 Video: ${result.videoUrl || result.outputPath || "N/A"}`);
  }
}

const SERIES_NAME = "Stuyza Productions";

/**
 * Creates a progress callback that edits a Telegram message in place.
 * @param ctx      Telegraf context (for ctx.telegram access)
 * @param msgId    The message ID to edit
 * @param header   Fixed header line(s) shown above the status text
 */
function makeSafeEdit(ctx: any, msgId: number, header: string) {
  return async (status: string) => {
    try {
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        msgId,
        undefined,
        `${header}\n\n${status}`
      );
    } catch {
      // Silently ignore — edit failures (rate limit, unchanged text) must not crash the render
    }
  };
}

export function registerStuyzaCommands(bot: Telegraf) {

  // /stuyza — Main production command
  bot.command("stuyza", async (ctx) => {
    const args = ctx.message.text.replace("/stuyza", "").trim().split(/\s+/).filter(Boolean);
    const subcommand = args[0]?.toLowerCase();

    // Show help if no args
    if (args.length === 0) {
      return ctx.reply(
        `🎬 **${SERIES_NAME}** — Agentic Video Production\n\n` +
        `Powered by OpenMontage — the world's first open-source agentic video system.\n\n` +
        `*Commands:*\n` +
        `/stuyza [description] — Produce a video from description\n` +
        `/stuyza explain [topic] — Real estate explainer video\n` +
        `/stuyza cinematic [scene] — Cinematic drama scene\n` +
        `/stuyza social [topic] — Social media clip (TikTok/Shorts)\n` +
        `/stuyza pipelines — List available pipelines\n\n` +
        `*Examples:*\n` +
        `/stuyza Make a 60-second explainer about real estate wholesaling\n` +
        `/stuyza cinematic Jaylen on a Brooklyn rooftop at golden hour\n` +
        `/stuyza social 3 tips for motivated sellers`,
        { parse_mode: "Markdown" }
      );
    }

    // Route to specific handlers
    switch (subcommand) {
      case "pipelines":
        return handlePipelines(ctx);

      case "explain":
        return handleExplain(ctx, args.slice(1).join(" "));

      case "cinematic":
        return handleCinematic(ctx, args.slice(1).join(" "));

      case "social":
        return handleSocial(ctx, args.slice(1).join(" "));

      default:
        // Default: produce from full prompt
        return handleProduce(ctx, args.join(" "));
    }
  });

  // /explain — Quick explainer command
  bot.command("explain", async (ctx) => {
    const topic = ctx.message.text.replace("/explain", "").trim();
    if (!topic) {
      return ctx.reply("🏠 Usage: /explain [topic]\nExample: /explain wholesaling real estate");
    }
    return handleExplain(ctx, topic);
  });

  // /cinematic — Quick cinematic command
  bot.command("cinematic", async (ctx) => {
    const description = ctx.message.text.replace("/cinematic", "").trim();
    if (!description) {
      return ctx.reply("🎬 Usage: /cinematic [scene description]\nExample: /cinematic Jaylen on a rooftop at sunset");
    }
    return handleCinematic(ctx, description);
  });

  // /social — Quick social clip command
  bot.command("social", async (ctx) => {
    const topic = ctx.message.text.replace("/social", "").trim();
    if (!topic) {
      return ctx.reply("📱 Usage: /social [topic]\nExample: /social 5 signs you're a motivated seller");
    }
    return handleSocial(ctx, topic);
  });

  log("[stuyza] Stuyza Productions commands registered: /stuyza /explain /cinematic /social");
}

/**
 * Handle /stuyza pipelines
 */
async function handlePipelines(ctx: any) {
  const agent = new StuyzaVideoAgent();
  const pipelines = agent.getAvailablePipelines();

  const pipelineList = pipelines
    .map((p) => `  • ${p}`)
    .join("\n");

  await ctx.reply(
    `🎬 **Available Pipelines**\n\n` +
    `${pipelineList}\n\n` +
    `*Stuyza Custom:*\n` +
    `  • stuyza-explainer — Real estate explainers\n` +
    `  • stuyza-cinematic — Cinematic drama series\n` +
    `  • stuyza-social — Social media clips`,
    { parse_mode: "Markdown" }
  );
}

/**
 * Handle /stuyza explain [topic]
 */
async function handleExplain(ctx: any, topic: string) {
  if (!topic) {
    return ctx.reply("🏠 Please specify a topic. Example: /stuyza explain wholesaling");
  }

  const statusMsg = await ctx.reply(`🎬 Stuyza Productions\n\nTopic: ${topic}\n\n⏳ Starting...`);
  const safeEdit = makeSafeEdit(ctx, statusMsg.message_id, `🎬 Stuyza Productions\n\nTopic: ${topic}`);

  try {
    const result = await produceVideo(
      `Make a 60-second animated explainer about ${topic}. Professional tone, clear visuals, suitable for real estate marketing.`,
      "stuyza-explainer",
      safeEdit
    );

    if (result.status === "success") {
      await sendVideo(ctx, result,
        `✅ Explainer Complete!\n💰 Cost: $${result.cost?.toFixed(2) || "N/A"}\nStages: ${result.stages?.join(" → ")}`);
    } else {
      await ctx.reply(`❌ Production failed: ${result.error}`);
    }
  } catch (err: any) {
    log(`[stuyza] Explain production failed: ${err.message}`, "error");
    await ctx.reply(`❌ Error: ${err.message}`);
  }
}

/**
 * Handle /stuyza cinematic [scene]
 */
async function handleCinematic(ctx: any, description: string) {
  if (!description) {
    return ctx.reply("🎬 Please describe the scene. Example: /stuyza cinematic Jaylen on a Brooklyn rooftop");
  }

  const statusMsg = await ctx.reply(`🎬 Stuyza Productions\n\nScene: ${description}\n\n⏳ Starting...`);
  const safeEdit = makeSafeEdit(ctx, statusMsg.message_id, `🎬 Stuyza Productions\n\nScene: ${description}`);

  try {
    const result = await produceCinematicScene(description, "protagonist", "Brooklyn", safeEdit);

    if (result.status === "success") {
      await sendVideo(ctx, result,
        `✅ Scene Complete!\n💰 Cost: $${result.cost?.toFixed(2) || "N/A"}`);
    } else {
      await ctx.reply(`❌ Production failed: ${result.error}`);
    }
  } catch (err: any) {
    log(`[stuyza] Cinematic production failed: ${err.message}`, "error");
    await ctx.reply(`❌ Error: ${err.message}`);
  }
}

/**
 * Handle /stuyza social [topic]
 */
async function handleSocial(ctx: any, topic: string) {
  if (!topic) {
    return ctx.reply("📱 Please specify a topic. Example: /stuyza social 3 tips for sellers");
  }

  const statusMsg = await ctx.reply(`📱 Stuyza Productions\n\nTopic: ${topic}\n\n⏳ Starting...`);
  const safeEdit = makeSafeEdit(ctx, statusMsg.message_id, `📱 Stuyza Productions\n\nTopic: ${topic}`);

  try {
    const result = await produceSocialClip(topic, "tiktok", safeEdit);

    if (result.status === "success") {
      await sendVideo(ctx, result,
        `✅ Social Clip Complete!\n💰 Cost: $${result.cost?.toFixed(2) || "N/A"}`);
    } else {
      await ctx.reply(`❌ Production failed: ${result.error}`);
    }
  } catch (err: any) {
    log(`[stuyza] Social production failed: ${err.message}`, "error");
    await ctx.reply(`❌ Error: ${err.message}`);
  }
}

/**
 * Handle generic /stuyza [prompt]
 */
async function handleProduce(ctx: any, prompt: string) {
  log(`[stuyza] Handshake received. Prompt: ${prompt.substring(0, 50)}...`);

  const statusMsg = await ctx.reply(`🎬 Stuyza Productions\n\n${prompt.substring(0, 80)}\n\n⏳ Starting...`);
  const safeEdit = makeSafeEdit(ctx, statusMsg.message_id, `🎬 Stuyza Productions\n\n${prompt.substring(0, 80)}`);

  try {
    const result = await produceVideo(prompt, undefined, safeEdit);

    if (result.status === "success") {
      await sendVideo(ctx, result,
        `✅ Production Complete!\n💰 Cost: $${result.cost?.toFixed(2) || "N/A"}\nStages: ${result.stages?.length || 0}`);
    } else {
      await ctx.reply(`❌ Production failed\n\n${result.error || "Unknown error."}\n\n💡 Try /stuyza pipelines.`);
    }
  } catch (err: any) {
    log(`[stuyza] Production failed: ${err.message}`, "error");
    await ctx.reply(`❌ Neural Link Error\n\n${err.message}`);
  }
}
