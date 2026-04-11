import { getAllProperties } from "../core/county/getAllProperties.js";
import { detectSurplus, formatSurplusMessage } from "../core/property/surplus.js";
import { skipTrace, triggerAICall, sendTelegram } from "./outreachService.js";
import { log } from "../core/config.js";
import { Property } from "../core/property/types.js";

/**
 * High-Profit Surplus Pipeline
 * Scans all county data sources (or processes external batches), 
 * detects >$10k overages, and triggers immediate outreach.
 */
export async function runAutomatedSurplusScan(preHarvestedProperties: Property[] | null = null): Promise<number> {
    log("[surplusPipeline] 🚀 Starting surplus scan session...");

    try {
        // 1. Get properties (either from external batch or local harvest)
        const properties = preHarvestedProperties || await getAllProperties();
        
        if (properties.length === 0) {
            log("[surplusPipeline] ⚠️ No properties to analyze.");
            return 0;
        }

        log(`[surplusPipeline] 🔍 Analyzing ${properties.length} properties for surplus overages...`);

        let dealsFound = 0;

        for (const p of properties) {
            // 2. Filter for Surplus Opportunities (> $10k)
            const deal = detectSurplus(p);

            if (deal) {
                dealsFound++;
                log(`[surplusPipeline] 💰 HIGH-VALUE DEAL FOUND: ${deal.address} (Surplus: $${deal.surplus})`);

                try {
                    // 3. Skip Trace (Identify the owner and contact info)
                    log(`[surplusPipeline] 🔍 Triggering SkipTrace for ${deal.owner || 'Unknown Owner'}...`);
                    const ownerData = await skipTrace(deal.owner || "Current Owner", deal.city);
                    
                    const enrichedDeal = {
                        ...deal,
                        owner: ownerData.name,
                        phone: ownerData.phone
                    };

                    // 4. Alert the Human Operator (Telegram)
                    log(`[surplusPipeline] 📲 Sending Telegram alert for ${enrichedDeal.address}...`);
                    const msg = formatSurplusMessage(enrichedDeal);
                    await sendTelegram(msg);

                    // 5. Trigger the AI Voice Call Agent
                    log(`[surplusPipeline] 📞 Triggering Outbound AI Voice Agent to ${enrichedDeal.phone}...`);
                    await triggerAICall(enrichedDeal);

                    log(`[surplusPipeline] ✅ Pipeline complete for ${enrichedDeal.address}.`);
                } catch (outreachErr: any) {
                    log(`[surplusPipeline] ❌ Outreach failed for ${deal.address}: ${outreachErr.message}`, "error");
                }
            }
        }

        log(`[surplusPipeline] 🎉 Automated scan complete. Processed ${dealsFound} high-margin surplus opportunities.`);
        return dealsFound;
    } catch (err: any) {
        log(`[surplusPipeline] ❌ Critical pipeline failure: ${err.message}`, "error");
        return 0;
    }
}

export async function runHarrisCountyScan(): Promise<number> {
    return await runAutomatedSurplusScan();
}
