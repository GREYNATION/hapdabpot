import cron from "node-cron";
import { SupabaseCrm } from "../core/supabaseCrm.js";
import { log } from "../core/config.js";

/**
 * Daily Deal Scanners
 * Currently targeting: Dallas, TX
 */
export function initMarketScans() {
    log("[cron] âŒ›ï¸  Initializing market scan cron jobs...");

    // 1. Dallas Daily Scan - 9:00 AM
    cron.schedule("0 9 * * *", async () => {
        log("ðŸ¤– [cron] Running scheduled daily deal scan for Dallas...");
        try {
            const count = await SupabaseCrm.scanMarket("Dallas");
            log(`âœ… [cron] Dallas scan complete. Found ${count} new deals.`);
        } catch (err: any) {
            log(`â Œ [cron] Dallas scan failed: ${err.message}`, "error");
        }
    });

    log("[cron] âœ… Market scan cron jobs scheduled.");
}
