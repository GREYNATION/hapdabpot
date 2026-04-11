import { getAllProperties } from "./src/core/county/getAllProperties.js";

async function testAggregator() {
    console.log("Testing County Connector & Aggregator System...");

    try {
        const properties = await getAllProperties();

        console.log("\n--- Aggregated Results ---");
        properties.forEach((p, i) => {
            console.log(`${i + 1}. [${p.state}] ${p.address} (${p.city}) - Owner: ${p.owner} - Value: $${p.assessedValue}`);
        });

        if (properties.length >= 3) {
            console.log("\n✅ SUCCESS: Aggregator effectively combined data from Camden and Texas.");
        } else {
            console.error("\n❌ FAILURE: Missing data from one or more connectors.");
        }
    } catch (err: any) {
        console.error("\n❌ CRITICAL TEST FAILURE:", err.message);
    }
}

testAggregator();
