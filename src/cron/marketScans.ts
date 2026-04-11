import cron from "node-cron";
import { SupabaseCrm } from "../core/supabaseCrm.js";
import { log, config } from "../core/config.js";
import { Telegraf } from "telegraf";
import { findMotivatedSellers } from "../services/universalLeadScraper.js";
import { filterTopDeals, formatTopDeal } from "../services/leadFilter.js";
import { runAutonomousPipeline } from "../core/orchestrator/clawOrchestrator.js";
import { runClawAgent } from "../agents/claw/runClaw.js";

/**
 * Daily Deal Scanners
 * Currently targeting: Dallas, TX and Houston, TX
 */
export function initMarketScans(bot?: Telegraf) {
    log("[cron] ⏳ Initializing market scan cron jobs...");

    // 1. Dallas Daily Scan - 9:00 AM
    cron.schedule("0 9 * * *", async () => {
        log("🤖 [cron] Running scheduled daily deal scan for Dallas...");
        try {
            const count = await SupabaseCrm.scanMarket("Dallas");
            log(`✅ [cron] Dallas scan complete. Found ${count} new deals.`);
        } catch (err: any) {
            log(`❌ [cron] Dallas scan failed: ${err.message}`, "error");
        }
    });

    // 2. Houston Daily Top Deal Scan - 10:00 AM
    cron.schedule("0 10 * * *", async () => {
        log("🤖 [cron] Running scheduled daily top deal scan for Houston...");
        try {
            const deals = await findMotivatedSellers(undefined, "Houston", true);
            const topDeals = filterTopDeals(deals);
            
            if (topDeals.length > 0 && bot && config.ownerId) {
                const best = topDeals[0];
                const message = formatTopDeal(best);
                await bot.telegram.sendMessage(config.ownerId, message, { parse_mode: "HTML" });
                log(`✅ [cron] Houston top deal sent to Telegram.`);
            } else {
                log(`[cron] Houston scan complete. No top deals found above threshold.`);
            }
        } catch (err: any) {
            log(`❌ [cron] Houston scan failed: ${err.message}`, "error");
        }
    });

    // 3. Autonomous Pipeline Scan with Self-Improvement Loop - 9:00 AM
    cron.schedule("0 9 * * *", async () => {
        log("🚀 Running daily autonomous pipeline with Self-Improvement Flywheel");
        try {
            // STEP 1: AI Learns Patterns
            const rawDeals = await SupabaseCrm.findDeals("Houston");
            let marketInsights = "Focus on standard distressed properties with high ARV spread.";
            
            if (rawDeals && rawDeals.length > 0) {
                try {
                    marketInsights = await runClawAgent(`
Analyze past deals for Houston:
${JSON.stringify(rawDeals.slice(0, 10))}
Identify which properties converted best and write a 1-sentence strategy rule for what to hunt for today.
`) || marketInsights;
                } catch (e) {
                    log(`[cron] Insights extraction failed, defaulting strategy.`);
                }
            }

            // STEP 2: AI Improves Next Run
            await runAutonomousPipeline(`
Find 5 off-market distressed properties in Houston and prepare deals.

CRITICAL STRATEGY LEARNED FROM PAST DATA:
"${marketInsights}"

Apply this strategy strictly when choosing which deals to target.
`);
        } catch (err: any) {
            log(`❌ [cron] Autonomous scan failed: ${err.message}`, "error");
        }
    });

    // 4. Daily Surplus Agent Pipeline Scan - 8:00 AM
    cron.schedule("0 8 * * *", async () => {
        log("🏛️ [cron] Running surplus agent for Texas...");
        try {
            const { runSurplusAgent } = await import("../core/surplus/runSurplusAgent.js");
            await runSurplusAgent("Texas");
        } catch (err: any) {
            log(`❌ [cron] Surplus scan failed: ${err.message}`, "error");
        }
    });

    log("[cron] ✅ Market scan cron jobs scheduled.");
}
