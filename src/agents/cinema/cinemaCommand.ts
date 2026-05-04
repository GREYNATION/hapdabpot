/**
 * cinemaCommand.ts
 * Telegram bot commands for the CinemaAgent / "Out the Way" series
 *
 * Commands:
 *   /produce [ep]      — produce a full episode (default: ep 1)
 *   /scene [ep] [id]   — produce a single scene for testing
 *   /drama             — show series info and episode list
 */

import { Telegraf } from "telegraf";
import { CinemaAgent, runOutTheWayEpisode, OUT_THE_WAY_EP1 } from "../cinema/CinemaAgent.js";
import { log } from "../../core/config.js";

const SERIES_NAME = "Out the Way";

const EPISODE_MAP: Record<number, typeof OUT_THE_WAY_EP1> = {
  1: OUT_THE_WAY_EP1,
};

export function registerCinemaCommands(bot: Telegraf) {

  // /drama — series info
  bot.command("drama", async (ctx) => {
    const episodeList = Object.values(EPISODE_MAP)
      .map(ep => `  Ep ${ep.episodeNumber}: "${ep.title}" (${ep.scenes.length} scenes)`)
      .join("\n");

    await ctx.reply(
      `🎬 **DRAMA HUB**\n\n` +
      `**1. Gilded Claws (Active)**\n` +
      `Status: Production Ready\n` +
      `Commands: /drama_status, /drama_episode, /drama_season\n\n` +
      `**2. Out the Way (Legacy)**\n` +
      `Status: Suspended\n` +
      `Episodes:\n${episodeList}\n` +
      `Commands: /produce, /scene\n\n` +
      `Use /drama_status for the current main production.`,
      { parse_mode: "Markdown" }
    );
  });

  // /produce ep <n> | /produce scene <desc> | /produce (help)
  bot.command("produce", async (ctx) => {
    const args = ctx.message.text.replace("/produce", "").trim().split(/\s+/).filter(Boolean);
    const { ContentAgent } = await import("../ContentAgent.js");
    const agent = new ContentAgent();
    await agent.handleCinemaRequest(ctx, args);
  });

  // /scene [episodeNumber] [sceneId] — single scene test
  bot.command("scene", async (ctx) => {
    const parts = ctx.message.text.replace("/scene", "").trim().split(/\s+/);
    const epNum  = parseInt(parts[0]) || 1;
    const sceneId = parseInt(parts[1]) || 1;

    const ep = EPISODE_MAP[epNum];
    if (!ep) return ctx.reply(`❌ Episode ${epNum} not found`);

    const scene = ep.scenes.find(s => s.id === sceneId);
    if (!scene) return ctx.reply(`❌ Scene ${sceneId} not found in Episode ${epNum}`);

    await ctx.reply(
      `🎬 Generating Scene ${sceneId} from Ep ${epNum}...\n\n` +
      `📍 ${scene.location ?? "Unknown location"}\n` +
      `🎭 ${scene.character ?? "Unknown"} — "${scene.dialogue ?? "(no dialogue)"}"`,
      { parse_mode: "Markdown" }
    );

    try {
      const agent = new CinemaAgent();
      const result = await agent.processScene(scene);

      if (result.status === "complete") {
        const url = result.lipSyncUrl ?? result.videoUrl ?? result.imageUrl;
        if (url) {
          await ctx.replyWithPhoto(
            { url }, 
            { caption: `✅ *Scene ${sceneId} complete!*`, parse_mode: "Markdown" }
          ).catch(async () => {
            // Fallback if URL is too long for replyWithPhoto
            await ctx.reply(`✅ *Scene ${sceneId} complete!*\n<a href="${url}">🎬 View Render</a>`, { parse_mode: "HTML", link_preview_options: { is_disabled: false } });
          });
        }
      } else {
        await ctx.reply(`❌ Scene ${sceneId} failed:\n${result.error ?? "unknown error"}`);
      }
    } catch (err: any) {
      await ctx.reply(`❌ Scene generation error: ${err.message}`);
    }
  });

  log("[cinema] Drama/Cinema commands registered: /drama /produce /scene");
}
