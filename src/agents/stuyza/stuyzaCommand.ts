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

import { Telegraf } from "telegraf";
import { StuyzaVideoAgent, produceVideo, produceCinematicScene, produceSocialClip } from "./StuyzaVideoAgent.js";
import { log } from "../../core/config.js";

const SERIES_NAME = "Stuyza Productions";

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

  await ctx.reply(`🎬 **Stuyza Productions**\n\nStarting explainer production about: *${topic}*\nThis will take a few minutes...`, { parse_mode: "Markdown" });

  try {
    const result = await produceVideo(
      `Make a 60-second animated explainer about ${topic}. Professional tone, clear visuals, suitable for real estate marketing.`,
      "stuyza-explainer"
    );

    if (result.status === "success") {
      await ctx.reply(
        `✅ **Explainer Complete!**\n\n` +
        `🎬 Video: ${result.videoUrl}\n` +
        `💰 Cost: $${result.cost?.toFixed(2) || "N/A"}\n\n` +
        `Stages: ${result.stages?.join(" → ")}`,
        { parse_mode: "Markdown" }
      );
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

  await ctx.reply(`🎬 **Stuyza Productions**\n\nStarting cinematic production...\nScene: *${description}*`, { parse_mode: "Markdown" });

  try {
    const result = await produceCinematicScene(
      description,
      "protagonist",
      "Brooklyn"
    );

    if (result.status === "success") {
      await ctx.reply(
        `✅ **Scene Complete!**\n\n` +
        `🎬 Video: ${result.videoUrl}\n` +
        `💰 Cost: $${result.cost?.toFixed(2) || "N/A"}`,
        { parse_mode: "Markdown" }
      );
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

  await ctx.reply(`📱 **Stuyza Productions**\n\nCreating social media clip...\nTopic: *${topic}*`, { parse_mode: "Markdown" });

  try {
    const result = await produceSocialClip(topic, "tiktok");

    if (result.status === "success") {
      await ctx.reply(
        `✅ **Social Clip Complete!**\n\n` +
        `🎬 Video: ${result.videoUrl}\n` +
        `💰 Cost: $${result.cost?.toFixed(2) || "N/A"}`,
        { parse_mode: "Markdown" }
      );
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
  await ctx.reply(`🎬 **Stuyza Productions**\n\nStarting video production...\nPrompt: *${prompt.substring(0, 100)}${prompt.length > 100 ? "..." : ""}*`, { parse_mode: "Markdown" });

  try {
    const result = await produceVideo(prompt);

    if (result.status === "success") {
      await ctx.reply(
        `✅ **Production Complete!**\n\n` +
        `🎬 Video: ${result.videoUrl}\n` +
        `💰 Cost: $${result.cost?.toFixed(2) || "N/A"}\n\n` +
        `Stages completed: ${result.stages?.length || 0}`,
        { parse_mode: "Markdown" }
      );
    } else {
      await ctx.reply(`❌ **Production failed**\n\nReason: ${result.error || "Unknown neuro-sync error."}\n\n💡 Try describing your scene in more detail, or use /stuyza pipelines to see available formats.`, { parse_mode: "Markdown" });
    }
  } catch (err: any) {
    log(`[stuyza] Production failed: ${err.message}`, "error");
    await ctx.reply(`❌ **Neural Link Error**\n\n${err.message}\n\nI have automatically reported this to the Master Brain. Please try again in 30 seconds.`, { parse_mode: "Markdown" });
  }
}
