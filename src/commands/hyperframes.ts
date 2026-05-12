import { Telegraf } from 'telegraf';
import { log } from "../core/config.js";
import { TrendScannerService } from "../services/trendScanner.js";
import { AdaptiveScriptEngine } from '../services/scriptEngine.js';
import { HyperFramesEngine } from '../services/hyperframesEngine.js';

export function registerHyperFramesCommand(bot: Telegraf) {
    bot.command('render', async (ctx: any) => {
        const text = ctx.message?.text?.replace('/render', '').trim();
        const trendIndex = text ? parseInt(text, 10) - 1 : 0;

        const trends = TrendScannerService.lastScoredTrends;

        if (trends.length === 0) {
            return ctx.reply(`❌ No trends found in memory. Please run /trend first.`);
        }

        if (trendIndex < 0 || trendIndex >= trends.length) {
            return ctx.reply(`❌ Invalid trend number. Choose a number between 1 and ${trends.length}.`);
        }

        const selectedTrend = trends[trendIndex];
        const cachedScript = AdaptiveScriptEngine.lastGeneratedScripts[selectedTrend.title];

        if (!cachedScript) {
            return ctx.reply(`❌ No cached script found for this trend. Please run /script ${trendIndex + 1} first!`);
        }

        const msg = await ctx.reply(`🎥 *HyperFrames Cinematic Engine Online*\nSending B-Roll Prompt to Fal.ai (LTX-Video) for rendering...\n\n_Prompt:_ ${cachedScript.brollPrompt}`, { parse_mode: "Markdown" });
        
        try {
            const result = await HyperFramesEngine.generateCinematicBRoll(cachedScript, async (progressMsg) => {
                log(`[HyperFrames] ${progressMsg}`);
                // Could edit message here if needed
            });

            if (result.success && result.url) {
                await ctx.reply(`✅ *Cinematic B-Roll Rendered!* ✅\n\nSaving file to server storage...`, { parse_mode: "Markdown" });
                
                // Attempt to send the video preview via Telegram
                try {
                    await ctx.replyWithVideo({ source: result.url }, { caption: `🎥 B-Roll: ${selectedTrend.title}` });
                } catch (vidErr: any) {
                    await ctx.reply(`✅ Video saved locally to: \`${result.url}\`\n(File might be too large for Telegram preview).`, { parse_mode: "Markdown" });
                }
            } else {
                await ctx.reply(`❌ *Rendering Failed:* ${result.error}`, { parse_mode: "Markdown" });
            }

        } catch (err: any) {
            log(`[/render] Error: ${err.message}`, "error");
            await ctx.reply(`❌ Fatal error in HyperFrames Engine: ${err.message}`);
        }
    });

    log("[Bot] Command registered: /render [trend_number]");
}
