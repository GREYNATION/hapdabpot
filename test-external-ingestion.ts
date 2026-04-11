import fetch from "node-fetch";

async function testExternalIngestion() {
    console.log("Testing External Webhook Ingestion (Apify Simulation)...");

    const webhookUrl = "http://localhost:8181/api/webhook/property-data";
    
    const mockPayload = [
        {
            address: "444 EXTERNAL WAY",
            city: "Miami",
            state: "FL",
            owner: "External Success LLC",
            auctionPrice: "150000",
            debt: "120000" // Surplus: $30,000
        },
        {
            address: "555 LOW VALUE ST",
            city: "Atlanta",
            state: "GA",
            owner: "John Georgia",
            auctionPrice: "55000",
            debt: "50000" // Surplus: $5,000 (Should be skipped)
        }
    ];

    try {
        const response = await fetch(webhookUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                // "x-api-key": process.env.SCRAPER_API_KEY || "test_key" 
            },
            body: JSON.stringify(mockPayload)
        });

        const result = await response.json();
        console.log("\nWebhook Response:");
        console.log(JSON.stringify(result, null, 2));

        if (result.success && result.processed === 2 && result.deals === 1) {
            console.log("\n✅ SUCCESS: Ingestion correctly identified 1 high-value deal out of 2.");
        } else {
            console.error("\n❌ FAILURE: Mismatch in processed records or deals.");
        }
    } catch (err: any) {
        console.error("\n❌ CRITICAL INGESTION TEST FAILURE:", err.message);
    }
}

testExternalIngestion();
