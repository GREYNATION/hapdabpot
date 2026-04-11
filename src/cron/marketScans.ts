import cron from "node-cron";
import { log, config } from "../core/config.js";
import { Telegraf } from "telegraf";
import { findMotivatedSellers } from "../services/universalLeadScraper.js";
import { filterTopDeals, formatTopDeal } from "../services/leadFilter.js";

/**
 * Daily Deal Scanners
 */
export function initMarketScans(bot?: Telegraf) {
    log("[cron] Initializing market scanners...");

    // Houston Daily Top Deal Scan - 10:00 AM
    cron.schedule("0 10 * * *", async () => {
        log("🤖 [cron] Running scheduled Houston scan...");
        try {
            const deals = await findMotivatedSellers(undefined, "Houston", true);
            const topDeals = filterTopDeals(deals);
            
            if (topDeals.length > 0 && bot && config.ownerId) {
                const message = formatTopDeal(topDeals[0]);
                await bot.telegram.sendMessage(config.ownerId, message, { parse_mode: "HTML" });
                log(`✅ [cron] Houston top deal sent.`);
            }
        } catch (err: any) {
            log(`❌ [cron] Houston scan failed: ${err.message}`, "error");
        }
    });

    log("[cron] ✅ Daily scanners scheduled.");
}
