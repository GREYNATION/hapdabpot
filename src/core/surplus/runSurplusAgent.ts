import { tools, sendSurplusAlert, skipTrace } from "../../core/tools/index.js";
import { log } from "../config.js";
import { triggerAICall } from "../../services/outreachService.js";

/**
 * Modular Surplus Agent Executor
 */
export async function runSurplusAgent(city: string) {
    log(`[surplusAgent] 🔍 Initiating Hardcoded Surplus Pipeline for ${city}`);
    const auctions = await tools.findAuctionDeals({ city });

    let results = [];

    for (let a of auctions) {
        const salePrice = a.price || 200000;
        const debt = 150000; 

        // 1. Math Pipeline
        const surplus = await tools.calculateSurplus({ salePrice, debt });

        // 2. Filter Hook
        if (surplus > 10000) {
            log(`[surplusAgent] 💰 Surplus Opportunity Found: ${a.address} ($${surplus} overage)`);
            
            // 3. Skip Trace pipeline
            // Updated skipTrace returns {name, phone} directly
            const owner = await tools.skipTrace({ name: (a as any).ownerName || (a as any).sellerName || "Current Owner", city });

            const deal = {
                address: a.address,
                surplus,
                debt: debt,
                owner: owner.name,
                phone: owner.phone
            };

            results.push(deal);

            // 4. Notification Hook
            await tools.sendSurplusAlert(deal);
        }
    }

    // 5. 🔥 Trigger AI Call Hook (THROTTLED)
    const MAX_CALLS = 5;
    for (let i = 0; i < results.length && i < MAX_CALLS; i++) {
        const targetDeal = results[i];
        if (targetDeal.phone) {
            log(`[surplusAgent] 📞 Pushing Deal to AI Voice Caller: ${targetDeal.phone}`);
            await triggerAICall(targetDeal);
        }
    }

    log(`[surplusAgent] ✅ Processed ${results.length} high-margin surplus deals. Dialed ${Math.min(results.length, MAX_CALLS)} owners.`);
    return results;
}
