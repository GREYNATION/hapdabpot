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
import { CinemaAgent, runOutTheWayEpisode, OUT_THE_WAY_EP1, OUT_THE_WAY_SERIES } from "../cinema/CinemaAgent.js";
import { log } from "../../core/config.js";

const EPISODE_MAP: Record<number, typeof OUT_THE_WAY_EP1> = {
  1: OUT_THE_WAY_EP1,
  // Add future episodes here
};

export function registerCinemaCommands(bot: Telegraf) {

  // /drama — series info
  bot.command("drama", async (ctx) => {
    const episodeList = Object.values(EPISODE_MAP)
      .map(ep => `  Ep ${ep.episodeNumber}: "${ep.title}" (${ep.scenes.length} scenes)`)
      .join("\n");

    await ctx.reply(
      `🎬 *${OUT_THE_WAY_SERIES}* — Mini Drama Series\n\n` +
      `Street drama. South Brooklyn/Jersey. Raw & cinematic.\n\n` +
      `*Episodes:*\n${episodeList}\n\n` +
      `*Commands:*\n` +
      `/produce 1 — produce full episode 1\n` +
      `/scene 1 3 — generate scene 3 from episode 1`,
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
        await ctx.reply(`✅ *Scene ${sceneId} complete!*\n🎬 ${url}`, { parse_mode: "Markdown" });
      } else {
        await ctx.reply(`❌ Scene ${sceneId} failed during production.`);
      }
    } catch (err: any) {
      await ctx.reply(`❌ Scene generation error: ${err.message}`);
    }
  });

  log("[cinema] Drama/Cinema commands registered: /drama /produce /scene");
}
