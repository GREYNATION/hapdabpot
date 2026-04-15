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

  // /produce [episodeNumber] — full episode pipeline
  bot.command("produce", async (ctx) => {
    const text = ctx.message.text.replace("/produce", "").trim();
    const epNum = parseInt(text) || 1;

    if (!EPISODE_MAP[epNum]) {
      return ctx.reply(`❌ Episode ${epNum} not defined yet. Available: ${Object.keys(EPISODE_MAP).join(", ")}`);
    }

    const ep = EPISODE_MAP[epNum];
    await ctx.reply(
      `🎬 Starting production of *${OUT_THE_WAY_SERIES}* — Ep ${epNum}: "${ep.title}"\n\n` +
      `📽️ ${ep.scenes.length} scenes queued\n` +
      `⏱️ Est. time: ${Math.ceil(ep.scenes.length * 6)}-${ep.scenes.length * 10} minutes\n\n` +
      `I'll send you each clip as it completes.`,
      { parse_mode: "Markdown" }
    );

    // Run in background — doesn't block the bot
    (async () => {
      try {
        const agent = new CinemaAgent();
        const results = await agent.produceEpisode(ep);

        const clips = agent.getPostableClips(results);
        const failed = results.filter(r => r.status === "failed").length;

        // Send each clip URL
        for (const [i, clip] of clips.entries()) {
          await ctx.reply(
            `✅ *Scene ${i + 1} ready*\n🎬 ${clip}`,
            { parse_mode: "Markdown" }
          );
        }

        await ctx.reply(
          `🏁 *Episode ${epNum} complete!*\n` +
          `${clips.length} clips ready · ${failed} failed\n\n` +
          `Clips saved to: \`out_the_way_output/ep${epNum}_manifest.json\``,
          { parse_mode: "Markdown" }
        );
      } catch (err: any) {
        log(`[cinema] Episode ${epNum} production error: ${err.message}`, "error");
        await ctx.reply(`❌ Production failed: ${err.message}`);
      }
    })();
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
