import { scrapeCounty } from "./src/core/county/scraperUtils.js";

async function testHeadlessScraper() {
    console.log("Testing Headless Browser Scraper (Puppeteer)...");

    const testUrl = "https://example.com";
    
    try {
        const result = await scrapeCounty(testUrl, () => {
            return [{
                title: document.title,
                h1: document.querySelector("h1")?.innerText || "None"
            }];
        });

        console.log("\nScrape Result from Example.com:");
        console.log(JSON.stringify(result, null, 2));

        if (result.length > 0 && result[0].title === "Example Domain") {
            console.log("\n✅ SUCCESS: Puppeteer launched and extracted data correctly.");
        } else {
            console.error("\n❌ FAILURE: Extraction failed or data mismatch.");
        }
    } catch (err: any) {
        console.error("\n❌ CRITICAL SCRAPER TEST FAILURE:", err.message);
    }
}

testHeadlessScraper();
