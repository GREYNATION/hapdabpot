import axios from "axios";
import { config } from "./core/config.js";

async function testBrave() {
    console.log("--- BRAVE SEARCH TEST ---");
    const query = "82 Halsey Street Brooklyn sale price";
    console.log("Query:", query);
    console.log("API Key loaded:", config.braveApiKey ? "YES" : "NO");

    if (!config.braveApiKey) {
        console.error("BRAVE_API_KEY is not configured.");
        return;
    }

    try {
        console.log("Sending request to Brave...");
        const response = await axios.get("https://api.search.brave.com/res/v1/web/search", {
            params: { q: query, count: 5 },
            headers: { 
                "Accept": "application/json",
                "Accept-Encoding": "gzip",
                "X-Subscription-Token": config.braveApiKey
            },
            timeout: 10000
        });
        
        console.log("Status:", response.status);
        const webResults = response.data.web?.results || [];
        console.log("Results found:", webResults.length);
        
        if (webResults.length > 0) {
            console.log("KEYS for result 0:", Object.keys(webResults[0]));
            webResults.forEach((r: any, i: number) => {
                console.log(`${i+1}. ${r.title}`);
                console.log(`   ${r.url}`);
                console.log(`   Description: ${r.description || r.snippet || "MISSING"}`);
            });
        }
    } catch (e: any) {
        console.error("SEARCH FAILED!");
        if (e.response) {
            console.error("Status:", e.response.status);
            console.error("Data:", JSON.stringify(e.response.data, null, 2));
        } else {
            console.error("Error:", e.message);
        }
    }
    console.log("--------------------------");
}

testBrave();
