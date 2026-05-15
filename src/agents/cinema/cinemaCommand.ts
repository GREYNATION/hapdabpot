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
import { sanitizeHTML } from "../../core/telegramUtils.js";

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
      `🎬 <b>DRAMA HUB</b>\n\n` +
      `<b>1. Gilded Claws (Active)</b>\n` +
      `Status: Production Ready\n` +
      `Commands: <code>/drama_status</code>, <code>/drama_episode</code>, <code>/drama_season</code>\n\n` +
      `<b>2. Out the Way (Legacy)</b>\n` +
      `Status: Suspended\n` +
      `Episodes:\n${sanitizeHTML(episodeList)}\n` +
      `Commands: <code>/produce</code>, <code>/scene</code>\n\n` +
      `Use <code>/drama_status</code> for the current main production.`,
      { parse_mode: "HTML" }
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
      `🎬 Generating Scene <b>${sceneId}</b> from Ep <b>${epNum}</b>...\n\n` +
      `📍 ${sanitizeHTML(scene.location ?? "Unknown location")}\n` +
      `🎭 ${sanitizeHTML(scene.character ?? "Unknown")} — "<i>${sanitizeHTML(scene.dialogue ?? "(no dialogue)")}</i>"`,
      { parse_mode: "HTML" }
    );

    try {
      const agent = new CinemaAgent();
      const result = await agent.processScene(scene, ep.series);

      if (result.status === "complete") {
        const url = result.lipSyncUrl ?? result.videoUrl ?? result.imageUrl;
        if (url) {
          await ctx.replyWithPhoto(
            { url }, 
            { caption: `✅ <b>Scene ${sceneId} complete!</b>`, parse_mode: "HTML" }
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
