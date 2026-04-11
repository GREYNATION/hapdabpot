import { findAuctionDeals } from "./src/services/universalLeadScraper.js";
import { config, log } from "./src/core/config.js";

async function testHybridTrigger() {
    console.log("Testing Hybrid Cloud/Local Trigger Logic...");

    console.log("\n--- TEST 1: Texas (Cloud Configured) ---");
    // Ensure TX_ACTOR_ID is set for the test
    if (config.txActorId) {
        const txDeals = await findAuctionDeals("Houston");
        console.log("TX Result:", JSON.stringify(txDeals[0], null, 2));
        if (txDeals[0].source === "Apify Cloud") {
            console.log("✅ SUCCESS: Texas scan correctly offloaded to Apify Cloud.");
        } else {
            console.error("❌ FAILURE: Texas scan should have been offloaded.");
        }
    } else {
        console.warn("⚠️ SKIPPING TEST 1: TX_ACTOR_ID not set in environment.");
    }

    console.log("\n--- TEST 2: Ohio (No Cloud Scraper) ---");
    const ohDeals = await findAuctionDeals("Columbus");
    console.log("OH Result Source:", ohDeals[0]?.source || "N/A");
    if (ohDeals[0]?.source === "Auction.com / Web") {
        console.log("✅ SUCCESS: Ohio correctly fell back to local Brave Search.");
    } else {
        console.warn("⚠️ NOTE: Ohio result source may vary based on Brave search results.");
    }
}

testHybridTrigger();
