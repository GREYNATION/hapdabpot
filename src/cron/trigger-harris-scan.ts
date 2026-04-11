import { startupSequence } from "../core/startup.js";
import { runHarrisCountyScan } from "../services/surplusPipeline.js";
import { log } from "../core/config.js";

async function main() {
    log("🚀 Manually triggering Harris County Surplus Scan...");
    
    // Ensure config and DB are ready
    const ok = await startupSequence();
    if (!ok) {
        log("❌ Startup sequence failed. Aborting manual trigger.", "error");
        process.exit(1);
    }

    try {
        await runHarrisCountyScan();
        log("✅ Harris County scan completed successfully.");
        process.exit(0);
    } catch (err: any) {
        log(`❌ Scan error: ${err.message}`, "error");
        process.exit(1);
    }
}

main();
