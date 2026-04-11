import 'dotenv/config';
import { tools } from "../src/core/tools/index.js";

async function runTests() {
    console.log("=== Testing Claw Tools ===");

    try {
        console.log("\n1. Testing findDeals...");
        const deals = await tools.findDeals({ city: "Houston" });
        console.log(`Found ${deals?.length || 0} deals.`);

        if (deals && deals.length > 0) {
            const firstDeal = deals[0];
            const arv = firstDeal.arv || 200000;
            const repairs = firstDeal.repairs || 15000;
            
            console.log("\n2. Testing calculateMaxOffer...");
            const maxOffer = await tools.calculateMaxOffer({ arv, repairs });
            console.log(`Calculated Max Offer: $${maxOffer} (ARV: $${arv}, Repairs: $${repairs})`);

            console.log("\n3. Testing saveDeal (simulated - skipping actual DB write for safety)...");
            console.log(`Prepared to save: ${firstDeal.address}`);
            // await tools.saveDeal({ ...firstDeal, max_offer: maxOffer });

            console.log("\n4. Testing sendSMS (simulated - skipping actual send for safety)...");
            console.log(`Prepared to send SMS to: ${firstDeal.phone || 'N/A'}`);
            // await tools.sendSMS({ phone: firstDeal.phone || "+1234567890", message: "Test Message" });
        } else {
            console.log("\nNo deals retrieved, cannot fully test subsequent tools naturally.");
        }

        console.log("\n=== Testing Surplus Phase Extension ===");
        console.log("5. Testing findAuctionDeals...");
        const auctionDeals = await tools.findAuctionDeals({ city: "Houston" });
        console.log(`Found ${auctionDeals?.length || 0} auction deals.`);

        console.log("\n6. Testing calculateSurplus...");
        const surplus = await tools.calculateSurplus({ salePrice: 200000, debt: 150000 });
        console.log(`Calculated Surplus: $${surplus} (Sale: $200k, Debt: $150k)`);

        console.log("\n7. Testing skipTrace (MOCK)...");
        const phone = await tools.skipTrace({ name: "John Doe", city: "Houston" });
        console.log(`Resolved Skip Trace Phone: ${phone}`);
        
    } catch (e: any) {
        console.error("Test failed: ", e.message);
    }
}

runTests();
