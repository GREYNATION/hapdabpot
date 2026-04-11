import { PropertyNormalizer } from "./src/core/property/normalize.js";
import { Property } from "./src/core/property/types.js";

async function testPropertyEngine() {
    console.log("Testing Unified Property Engine...");

    // 1. Test Raw Scrape Data (Tier 3 format)
    const messyCountyData = {
        address: "123 main st   ",
        City: "Houston",
        State: "tx",
        OwnerName: " John Doe  ",
        LastSalePrice: "$250,000.00",
        TotalDebt: "150000"
    };

    console.log("Raw Scraped Data:", messyCountyData);

    const normalized = PropertyNormalizer.fromRawScrape(messyCountyData, "county");
    
    console.log("\nNormalized Property Model:");
    console.log(JSON.stringify(normalized, null, 2));

    // 2. Type Verification
    const p: Property = normalized; // TS check
    
    if (p.address === "123 MAIN ST" && p.lastSalePrice === 250000) {
        console.log("\n✅ SUCCESS: Normalization and Type Mapping verified.");
    } else {
        console.error("\n❌ FAILURE: Normalization results incorrect.");
    }
}

testPropertyEngine();
