/**
 * gildedCommand.ts
 * Telegram bot commands for Gilded Claws production.
 */

import { Telegraf } from "telegraf";
import { DramaAgent, GILDED_CLAWS_CONFIG } from "./DramaAgent.js";
import { GILDED_SCRIPTS } from "./GildedScripts.js";
import { log } from "../../core/config.js";
import { GILDED_SEASON_1 } from "../ContentSchedulerAgent.js";
import { produceDynamicEpisode } from "../cinema/CinemaAgent.js";

export function registerGildedCommands(bot: Telegraf) {
    const dramaAgent = new DramaAgent(GILDED_CLAWS_CONFIG);

    bot.command("gilded", async (ctx: any) => {
        log(`[gilded] Command received: ${ctx.message.text}`);
        const args = ctx.message.text.replace("/gilded", "").trim().split(/\s+/);
        const action = args[0]?.toLowerCase();

        if (!action) {
            return ctx.reply(
                "🐺 **Gilded Claws Production Studio**\n\n" +
                "The luxury animal drama series.\n\n" +
                "**Commands:**\n" +
                "`/gilded produce S01E01` — Film the next episode\n" +
                "`/gilded list` — View script library\n" +
                "`/gilded status` — Check studio status\n\n" +
                "**Examples:**\n" +
                "`/gilded produce S01E31` (Victor's Meltdown)",
                { parse_mode: "Markdown" }
            );
        }

        switch (action) {
            case "list":
                const listText = Object.values(GILDED_SCRIPTS).map((script) => `🎬 \`${script.id}\` — ${script.title}`).join("\n");
                return ctx.reply(
                    "📺 **Gilded Claws Script Library**\n\n" +
                    listText + 
                    "\n\nUse `/gilded produce [ep]` to start luxury filming.",
                    { parse_mode: "Markdown" }
                );

            case "produce":
                const epCode = args[1]?.toUpperCase();
                if (!epCode) return ctx.reply("⚠️ Please specify an episode code (e.g., S01E01).");

                const script = GILDED_SCRIPTS[epCode];
                if (!script) return ctx.reply(`❌ Script for \`${epCode}\` not found in library.`);

                await ctx.reply(`🐺 **Gilded Claws Production START**\n\nEpisode: \`${epCode}\` - *${script.title}*\nStyle: **Luxury Elitewood (Pixar)**\nPipeline: Muapi + Wav2Lip...`, { parse_mode: "Markdown" });
                
                try {
                    // Convert scenes to the format CinemaAgent expects
                    const cinemaScenes = script.scenes.map((s, i) => ({
                        id: i + 1,
                        description: s.description,
                        character: s.characters.join(", "),
                        location: s.location,
                        mood: "Dramatic Luxury",
                        dialogue: s.dialogue.map(d => d.line).join(" ")
                    }));

                    const clips = await produceDynamicEpisode(
                        "Gilded Claws",
                        parseInt(epCode.replace("S01E", "")),
                        script.title,
                        cinemaScenes as any
                    );

                    if (clips && clips.length > 0) {
                        await ctx.reply(`✅ **Gilded Claws ${epCode} Produced!**\n\nGenerated ${clips.length} scenes.\n\nReady for the auto-scheduler.`, { parse_mode: "Markdown" });
                        
                        // Send the first clip as preview
                        if (clips[0]) {
                            await ctx.reply(clips[0]);
                        }
                    } else {
                        await ctx.reply(`❌ **Production Failed**: No clips were generated.`);
                    }
                } catch (err: any) {
                    await ctx.reply(`❌ **System Error**: ${err.message}`);
                }
                break;

            case "status":
                return ctx.reply("🏰 **Gilded Claws Studio**: System Online. Style: Luxury Pixar 9:16. Ready for production.");

            default:
                return ctx.reply("❓ Unknown gilded command. Try `/gilded` for help.");
        }
    });

    log("[gilded] Gilded Claws commands registered: /gilded");
}
