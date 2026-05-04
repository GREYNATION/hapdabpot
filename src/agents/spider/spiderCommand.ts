/**
 * spiderCommand.ts
 * Telegram bot commands for Spider Jr. production.
 */

import { Telegraf } from "telegraf";
import { spiderAgent } from "./SpiderAgent.js";
import { log } from "../../core/config.js";
import { SEASON_1 } from "../ContentSchedulerAgent.js";

export function registerSpiderCommands(bot: Telegraf) {

    bot.command("spider", async (ctx: any) => {
        log(`[spider] Command received: ${ctx.message.text}`);
        const args = ctx.message.text.replace("/spider", "").trim().split(/\s+/);
        const action = args[0]?.toLowerCase();

        if (!action) {
            return ctx.reply(
                "🕷️ **Spider Jr. Production Studio**\n\n" +
                "The world's first agentic cartoon pipeline.\n\n" +
                "**Commands:**\n" +
                "`/spider produce S01E01` — Film the next episode\n" +
                "`/spider list` — View Season 1 registry\n" +
                "`/spider status` — Check production queue\n\n" +
                "**Examples:**\n" +
                "`/spider produce S01E01` (Gummy Goblin)",
                { parse_mode: "Markdown" }
            );
        }

        switch (action) {
            case "list":
                const listText = SEASON_1.map((ep, i) => `${i + 1}. \`${ep.ep}\` — ${ep.title}`).join("\n");
                return ctx.reply(
                    "📺 **Spider Jr. Season 1 Registry**\n\n" +
                    listText + 
                    "\n\nUse `/spider produce [ep]` to start filming.",
                    { parse_mode: "Markdown" }
                );

            case "produce":
                const ep = args[1]?.toUpperCase();
                if (!ep) return ctx.reply("⚠️ Please specify an episode code (e.g., S01E01).");

                await ctx.reply(`🕷️ **Spider Jr. Production START**\n\nEpisode: \`${ep}\`\nQueuing in ComfyUI...`, { parse_mode: "Markdown" });
                
                try {
                    const result = await spiderAgent.produceEpisode(ep, async (msg) => {
                        // Optional: update status message if we had a persistent one
                        log(`[SpiderCommand] ${msg}`);
                    });

                    if (result.success) {
                        await ctx.reply(`✅ **Episode ${ep} Produced!**\n\n🎬 File saved to: \`${result.url}\`\n\nIt is now ready for the auto-scheduler.`, { parse_mode: "Markdown" });
                        
                        // Send the video preview
                        if (result.url) {
                            await ctx.replyWithVideo({ source: result.url }, { caption: `🕷️ Spider Jr. ${ep} Preview` });
                        }
                    } else {
                        await ctx.reply(`❌ **Production Failed**: ${result.error}`);
                    }
                } catch (err: any) {
                    await ctx.reply(`❌ **System Error**: ${err.message}`);
                }
                break;

            case "status":
                return ctx.reply("🛰️ **Spider Jr. Status**: System Online. Waiting for production tasks.");

            default:
                return ctx.reply("❓ Unknown spider command. Try `/spider` for help.");
        }
    });

    log("[spider] Spider Jr. commands registered: /spider");
}
