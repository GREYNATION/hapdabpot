import { ApifyService } from "./src/services/apifyService.js";
import { log } from "./src/core/config.js";

async function testApifyTrigger() {
    console.log("Testing Active Apify Trigger Integration (Mock Trigger)...");

    try {
        // Since we don't want to burn real credits in an automated test, 
        // we normally would mock axios. But for this first manual-assisted test,
        // we'll just check if the logic correctly identifies the missing configuration
        // or successfully hits the API.
        
        const success = await ApifyService.triggerScan("TX", "Harris");

        if (success) {
            console.log("\n✅ SUCCESS: Apify trigger call returned success response.");
        } else {
            console.warn("\n⚠️ TRIGGER RETURNED FALSE: This usually means APIFY_TOKEN is missing or the Actor ID is invalid.");
        }
    } catch (err: any) {
        console.error("\n❌ CRITICAL APIFY TEST FAILURE:", err.message);
    }
}

testApifyTrigger();
