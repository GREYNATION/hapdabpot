import { runAutomatedSurplusScan } from "./src/services/surplusPipeline.js";

async function testFullSurplusPipeline() {
    console.log("Testing Full Automated Surplus Pipeline (Step 2 & 3 Integration)...");

    try {
        // Trigger the automated scan
        // This will use the mock data from camden.ts and texas.ts
        await runAutomatedSurplusScan();

        console.log("\n✅ Pipeline execution finished.");
        console.log("Check the logs above for SkipTrace, Telegram, and AI Call triggers.");
    } catch (err: any) {
        console.error("\n❌ CRITICAL PIPELINE TEST FAILURE:", err.message);
    }
}

testFullSurplusPipeline();
