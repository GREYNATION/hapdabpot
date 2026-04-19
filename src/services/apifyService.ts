import axios from "axios";
import { config, log } from "../core/config.js";

/**
 * Apify Integration Service
 * Commands the external scraping fleet to harvest county records and social data.
 */

// Mapping of States to specific Apify Actor IDs from config
const STATE_ACTOR_MAP: Record<string, string | undefined> = {
    "TX": config.txActorId, 
    "FL": config.flActorId, 
    "GA": config.gaActorId,
    "NJ": config.njActorId
};

export class ApifyService {
    /**
     * Triggers a cloud-based auction scan for a specific state and county.
     * This restores the core Real Estate lead generation engine.
     */
    static async triggerScan(state: string, county: string): Promise<string> {
        const token = config.apifyToken;
        if (!token) return "Error: APIFY_TOKEN missing.";

        const stateKey = state.toUpperCase();
        const actorId = STATE_ACTOR_MAP[stateKey] || "apify/web-scraper";

        if (!actorId) {
            log(`[apifyService] ⚠️ No Actor ID found for ${stateKey}. Cannot trigger cloud scan.`, "warn");
            return `No cloud actor configured for ${stateKey}.`;
        }

        log(`[apifyService] 🚀 Triggering cloud scan for ${stateKey}/${county} using actor ${actorId}`);
        
        try {
            const response = await axios.post(
                `https://api.apify.com/v2/acts/${actorId}/runs?token=${token}`,
                {
                    state: stateKey,
                    county: county.toLowerCase(),
                    maxResults: 50
                }
            );

            const runId = response.data.data.id;
            log(`[apifyService] ✅ Scan triggered successfully. Run ID: ${runId}`);
            return `Auction scan triggered for ${stateKey}/${county}. Run ID: ${runId}`;
        } catch (err: any) {
            log(`[apifyService] ❌ Failed to trigger cloud scan: ${err.message}`, "error");
            return `Error triggering cloud scan: ${err.message}`;
        }
    }

    /**
     * Scrapes a TikTok video for metadata and content using the standard scraper.
     */
    static async scrapeTikTok(url: string): Promise<string> {
        const token = config.apifyToken;
        if (!token) return "Error: APIFY_TOKEN missing.";

        log(`[apifyService] 🎵 Scraping TikTok: ${url}`);
        
        try {
            // Use the standard TikTok scraper actor
            const response = await axios.post(
                `https://api.apify.com/v2/acts/clockworks~tiktok-scraper/runs?token=${token}`,
                {
                    postURLs: [url],
                    resultsPerPage: 1,
                    shouldDownloadVideo: false,
                    shouldDownloadCovers: false
                }
            );

            const runId = response.data.data.id;
            log(`[apifyService] ✅ Scrape initiated. Run ID: ${runId}. Waiting for results...`);

            // Poll for results (simple version)
            await new Promise(r => setTimeout(r, 8000));
            
            const results = await axios.get(
                `https://api.apify.com/v2/acts/clockworks~tiktok-scraper/runs/${runId}/dataset/items?token=${token}`
            );

            if (!results.data || results.data.length === 0) return "No content found for this TikTok URL.";
            
            const item = results.data[0];
            return `### TIKTOK ANALYSIS: ${item.text?.substring(0, 500)}...\n` +
                   `- **Author**: @${item.authorMeta?.name}\n` +
                   `- **Stats**: ${item.diggCount} likes, ${item.commentCount} comments, ${item.playCount} views\n` +
                   `- **Hashtags**: ${item.hashtags?.map((h: any) => h.name).join(", ")}\n` +
                   `- **Sound**: ${item.musicMeta?.musicName}`;
        } catch (err: any) {
            log(`[apifyService] ❌ TikTok Scrape Failed: ${err.message}`, "error");
            return `Error scraping TikTok: ${err.message}`;
        }
    }
}
