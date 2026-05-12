import { Telegraf } from 'telegraf';
import { log } from "../core/config.js";
import { TrendScannerService } from "../services/trendScanner.js";

export function registerTrendCommand(bot: Telegraf) {
    bot.command('trend', async (ctx: any) => {
        const text = ctx.message?.text?.replace('/trend', '').trim();
        const platform = text || "tiktok";

        await ctx.reply(`🔍 *Trend Scanner Online*\nScanning ${platform} for breaking trends over the past 24 hours...`, { parse_mode: "Markdown" });
        
        try {
            // 1. Scrape the data
            const rawTrends = await TrendScannerService.scrapePlatformTrends(platform);
            
            if (rawTrends.length === 0) {
                return ctx.reply(`❌ Could not find any trending data for ${platform}. Check Brave API keys.`);
            }

            await ctx.reply(`🧠 Found ${rawTrends.length} raw topics. Routing to Engagement Prediction Engine for virality scoring...`);

            // 2. Score with AI
            const scoredTrends = await TrendScannerService.scoreTrends(rawTrends);

            if (scoredTrends.length === 0) {
                return ctx.reply(`❌ Engagement Prediction Engine failed to score the topics. (Check API limits).`);
            }

            // 3. Format the top 3 results
            const topTrends = scoredTrends.slice(0, 3);
            let responseMsg = `🔥 *Top 3 Viral Opportunities on ${platform.toUpperCase()}* 🔥\n\n`;

            topTrends.forEach((trend, index) => {
                const fireEmoji = trend.viralityScore > 90 ? "🚀" : "🔥";
                responseMsg += `*${index + 1}. ${trend.title}*\n`;
                responseMsg += `${fireEmoji} *Virality Score:* ${trend.viralityScore}/100\n`;
                responseMsg += `🎭 *Genre:* ${trend.genre?.toUpperCase()}\n`;
                responseMsg += `🎯 *Audience:* ${trend.targetAudience}\n`;
                responseMsg += `🎣 *Hook:* "${trend.hookIdea}"\n`;
                responseMsg += `🔗 [Source Link](${trend.url})\n\n`;
            });

            responseMsg += `_Tip: Pass this hook to the Adaptive Script Engine to generate the full script._`;

            await ctx.reply(responseMsg, { parse_mode: "Markdown" });

        } catch (err: any) {
            log(`[/trend] Error: ${err.message}`, "error");
            await ctx.reply(`❌ Fatal error in Trend Scanner: ${err.message}`);
        }
    });

    log("[Bot] Command registered: /trend [platform]");
}
