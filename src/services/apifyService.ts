import axios from "axios";
import { config, log } from "../core/config.js";

/**
 * Apify Integration Service
 * Commands the external scraping fleet to harvest county records.
 */

// Mapping of States to specific Apify Actor IDs (Placeholders if not provided)
const STATE_ACTOR_MAP: Record<string, string> = {
    "TX": "clockworks/tiktok-scraper", 
    "FL": "clockworks/tiktok-scraper", 
    "GA": "clockworks/tiktok-scraper",
    "NJ": "clockworks/tiktok-scraper"
};

export class ApifyService {
    /**
     * Triggers an Apify Actor to scan a specific state/county
     */
    static async triggerScan(state: string, county: string = "All"): Promise<boolean> {
        const stateKey = state.toUpperCase();
        
        // Dynamic Mapping from Config
        const actorIdMap: Record<string, string | undefined> = {
            "TX": config.txActorId,
            "FL": config.flActorId,
            "GA": config.gaActorId,
            "NJ": config.njActorId
        };

        const actorId = actorIdMap[stateKey];
        const token = config.apifyToken;

        if (!actorId) {
            log(`[apifyService] ⚠️ No specific Actor ID configured for ${stateKey}. Cannot trigger cloud scan.`, "warn");
            return false;
        }

        const webhookUrl = `${config.baseUrl}/api/webhook/property-data`;
        
        log(`[apifyService] 🚀 Triggering Apify Actor ${actorId} for ${state}/${county}...`);

        try {
            // 1. Run the Actor via API
            // Documentation: https://docs.apify.com/api/v2#/reference/actors/run-collection/run-actor
            const response = await axios.post(
                `https://api.apify.com/v2/actors/${actorId}/runs?token=${token}`,
                {
                    state: state.toUpperCase(),
                    county: county,
                    webhookUrl: webhookUrl,
                    apiKey: config.scraperApiKey
                }
            );

            log(`[apifyService] ✅ Actor triggered. Run ID: ${response.data.data.id}`);
            return true;
        } catch (err: any) {
            log(`[apifyService] ❌ Failed to trigger Apify Actor: ${err.message}`, "error");
            return false;
        }
    }
}
