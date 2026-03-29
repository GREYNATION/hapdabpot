import { PropertyScraper } from '../src/core/scraper.js';
import { SkipTracer } from '../src/core/skiptrace.js';
import { log } from '../src/core/config.js';

async function runTest() {
    log("🚀 Testing Lead Gen Pipeline...");

    try {
        // 1. Test Scraper
        const leads = await PropertyScraper.fetchLatestDeeds('3', 1);
        if (leads.length > 0) {
            log(`✅ Scraper Success! Found: ${leads[0].address} (Owner: ${leads[0].ownerName})`);
            
            // 2. Test Skip Tracer (using the lead found)
            const contact = await SkipTracer.trace(leads[0].ownerName, leads[0].address);
            log(`🔎 Skip Trace Result: Phone=${contact.phone || 'None'}, Email=${contact.email || 'None'}`);
        } else {
            log("⚠️ No recent deeds found in Brooklyn. Try another borough?", "warn");
        }

    } catch (e) {
        log(`❌ Test failed: ${e.message}`, "error");
    }
}

runTest();
