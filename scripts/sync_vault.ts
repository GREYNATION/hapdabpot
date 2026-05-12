import { initVault, saveLeadToObsidian } from "../src/services/vaultService.js";
import { findMotivatedSellers } from "../src/services/universalLeadScraper.js";
import { log } from "../src/core/config.js";
import { startupSequence } from "../src/core/startup.js";

/**
 * Manual Sync Script:
 * 1. Initializes system configuration.
 * 2. Ensures Vault directory structure is present.
 * 3. Runs a fresh market scan.
 * 4. Saves top deals to Obsidian.
 */
async function sync() {
    log("🌟 --- HERMES MANUAL SYNC STARTING ---");

    try {
        // 1. Initialize core system (Config, DB, AI Clients)
        const ok = await startupSequence();
        if (!ok) {
            log("⚠️ System initialized in fallback mode.", "warn");
        }

        // 2. Ensure Vault is ready
        initVault();

        // 3. Perform Market Scan
        log("[sync] Triggering lead scan across all active markets...");
        const leads = await findMotivatedSellers(undefined, undefined, false); // false to avoid double saving to CRM if not desired, or true to keep in sync

        // 4. Filter and Save
        const validDeals = leads
            .filter(l => (l.dealScore || 0) >= 60)
            .sort((a, b) => (b.dealScore || 0) - (a.dealScore || 0));

        log(`[sync] Found ${validDeals.length} qualifying deals (Score >= 60).`);

        for (const lead of validDeals) {
            saveLeadToObsidian(lead);
        }

        log("✅ --- HERMES SYNC COMPLETE ---");
    } catch (err: any) {
        log(`[sync] FATAL ERROR: ${err.message}`, "error");
        process.exit(1);
    }
}

sync();
