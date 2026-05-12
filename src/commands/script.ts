import { Telegraf } from 'telegraf';
import { log } from "../core/config.js";
import { TrendScannerService } from "../services/trendScanner.js";
import { AdaptiveScriptEngine } from '../services/scriptEngine.js';

export function registerScriptCommand(bot: Telegraf) {
    bot.command('script', async (ctx: any) => {
        const text = ctx.message?.text?.replace('/script', '').trim();
        const trendIndex = text ? parseInt(text, 10) - 1 : 0;

        const trends = TrendScannerService.lastScoredTrends;

        if (trends.length === 0) {
            return ctx.reply(`❌ No trends found in memory. Please run /trend first.`);
        }

        if (trendIndex < 0 || trendIndex >= trends.length) {
            return ctx.reply(`❌ Invalid trend number. Choose a number between 1 and ${trends.length}.`);
        }

        const selectedTrend = trends[trendIndex];

        await ctx.reply(`🎬 *Adaptive Script Engine Online*\nGenerating full script, B-roll prompts, and syncing avatar voice profile for: *${selectedTrend.title}*...`, { parse_mode: "Markdown" });
        
        try {
            const scriptPackage = await AdaptiveScriptEngine.generateScript(selectedTrend);

            if (!scriptPackage) {
                return ctx.reply(`❌ Script Engine failed to generate the script.`);
            }

            let responseMsg = `✅ *Adaptive Script Generated Successfully!* ✅\n\n`;
            responseMsg += `🎙️ *Voice Profile:* ${scriptPackage.voiceProfile.toUpperCase()}\n`;
            responseMsg += `🎭 *Genre Tone:* ${scriptPackage.trend.genre.toUpperCase()}\n\n`;
            
            responseMsg += `🎣 *Hook:* "${scriptPackage.trend.hookIdea}"\n\n`;
            responseMsg += `📝 *Body Script:*\n${scriptPackage.script}\n\n`;
            responseMsg += `📢 *Call to Action:*\n"${scriptPackage.cta}"\n\n`;
            
            responseMsg += `🎥 *B-Roll Generation Prompt:*\n_${scriptPackage.brollPrompt}_\n\n`;

            responseMsg += `_Tip: Pass this to the HyperFrames Cinematic Engine to generate the video!_`;

            await ctx.reply(responseMsg, { parse_mode: "Markdown" });

        } catch (err: any) {
            log(`[/script] Error: ${err.message}`, "error");
            await ctx.reply(`❌ Fatal error in Script Engine: ${err.message}`);
        }
    });

    log("[Bot] Command registered: /script [trend_number]");
}
