/**
 * gildedCommand.ts
 * Telegram bot commands for Gilded Claws production.
 */

import { Telegraf } from "telegraf";
import { DramaAgent, GILDED_CLAWS_CONFIG } from "./DramaAgent.js";
import { GILDED_SCRIPTS as SEASON_1_SCRIPTS } from "./GildedScripts.js";
import { parseGildedScripts } from "./scriptImporter.js";
import { log } from "../../core/config.js";
import { produceDynamicEpisode } from "../cinema/CinemaAgent.js";
import path from "path";

// Load Season 2 from the local download folder
const S2_PATH = "c:\\Users\\hustl\\Downloads\\GILDED_CLAWS_Season2_Scripts.md";
const SEASON_2_SCRIPTS = parseGildedScripts(S2_PATH);

// Merge all scripts
const ALL_GILDED_SCRIPTS = { ...SEASON_1_SCRIPTS, ...SEASON_2_SCRIPTS };

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
                "`/gilded produce S02E01` — Film Season 2, Episode 1\n" +
                "`/gilded list 1` — List Season 1 scripts\n" +
                "`/gilded list 2` — List Season 2 scripts\n" +
                "`/gilded status` — Check studio status\n\n" +
                "**Examples:**\n" +
                "`/gilded produce S02E01` (The Return)",
                { parse_mode: "Markdown" }
            );
        }

        switch (action) {
            case "list":
                const season = args[1] || "2";
                const filtered = Object.values(ALL_GILDED_SCRIPTS).filter(s => s.id.startsWith(`S0${season}`));
                
                if (filtered.length === 0) return ctx.reply(`❌ No scripts found for Season ${season}.`);

                const listText = filtered.map((script) => `🎬 \`${script.id}\` — ${script.title}`).join("\n");
                const chunks = listText.match(/[\s\S]{1,4000}/g) ?? [listText];
                
                await ctx.reply(`📺 **Gilded Claws Season ${season} Library**\n\n`, { parse_mode: "Markdown" });
                for (const chunk of chunks) {
                    await ctx.reply(chunk, { parse_mode: "Markdown" });
                }
                return;

            case "produce":
                const epCode = args[1]?.toUpperCase();
                if (!epCode) return ctx.reply("⚠️ Please specify an episode code (e.g., S02E01).");

                const script = ALL_GILDED_SCRIPTS[epCode];
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
                        parseInt(epCode.split('E')[1]),
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
                const s1Count = Object.keys(SEASON_1_SCRIPTS).length;
                const s2Count = Object.keys(SEASON_2_SCRIPTS).length;
                return ctx.reply(`🏰 **Gilded Claws Studio Status**\n\nSeason 1: ${s1Count} scripts\nSeason 2: ${s2Count} scripts loaded from local\n\nReady for Pixar-style 9:16 production.`);

            default:
                return ctx.reply("❓ Unknown gilded command. Try `/gilded` for help.");
        }
    });

    log("[gilded] Gilded Claws commands registered: /gilded");
}

