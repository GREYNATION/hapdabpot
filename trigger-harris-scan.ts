import { realEstateAgent } from "./src/agents/realEstateAgent.js";
import { runStartupSequence } from "./src/core/startup.js";
import { log } from "./src/core/config.js";

async function triggerLiveHarrisScan() {
    // 1. Run startup to init config/AI
    await runStartupSequence();

    console.log("🚀 TRIGGERING LIVE HARRIS COUNTY SCAN (APIFY MODE)...");
    
    // Simulate the user command: "/auto scan harris county texas"
    // The realEstateAgent instance handles the parsing and offloading
    const response = await realEstateAgent.handle("/auto scan harris county texas");
    
    console.log("\n--- AGENT RESPONSE ---");
    console.log(response);
    console.log("\n----------------------");
    
    console.log("\n📡 Monitoring bot.log for cloud trigger and ingestion events...");
}

triggerLiveHarrisScan();
