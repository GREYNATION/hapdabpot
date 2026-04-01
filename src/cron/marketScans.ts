import cron from "node-cron";
import { SupabaseCrm } from "../core/supabaseCrm.js";
import { log, config } from "../core/config.js";
import { Telegraf } from "telegraf";
import { findMotivatedSellers } from "../services/universalLeadScraper.js";
import { filterTopDeals, formatTopDeal } from "../services/leadFilter.js";

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

    log("[cron] ✅ Market scan cron jobs scheduled.");
}
