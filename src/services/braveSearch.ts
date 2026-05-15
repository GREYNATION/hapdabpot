import { config, log } from "../core/config.js";
import { healthManager } from "./sourceHealth.js";
import { sanitizeBraveQuery } from "../utils/safe.js";

/**
 * Brave Search Service
 * Fully hardened for production reliability.
 */
export class BraveSearch {
  private static readonly BASE_URL = "https://api.search.brave.com/res/v1/web/search";

  /**
   * Perform a web search
   */
  static async search(query: string, count: number = 5) {
    const SOURCE_NAME = 'Brave Search';

    if (!query || query.trim().length < 3) {
      throw new Error('Brave: Query too short');
    }

    if (!config.braveApiKey.trim()) {
      log(`[brave] BRAVE_API_KEY is missing`, "error");
      throw new Error("BRAVE_API_KEY is not configured.");
    }

    if (!healthManager.isHealthy(SOURCE_NAME)) {
      throw new Error(`${SOURCE_NAME} is currently on cooldown.`);
    }

    try {
      const cleanQuery = sanitizeBraveQuery(query);
      if (!cleanQuery || cleanQuery.length < 3) return { web: { results: [] } };
      
      log(`[brave] Searching for: ${cleanQuery}`);
      
      const url = new URL(this.BASE_URL);
      url.searchParams.append("q", cleanQuery);
      url.searchParams.append("count", count.toString());
      url.searchParams.append("safesearch", "off");
      url.searchParams.append("text_decorations", "false");

      log(`[brave] Requesting: ${url.toString()}`);

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: { 
          "Accept": "application/json",
          "X-Subscription-Token": config.braveApiKey.trim(),
          "User-Agent": "Hermes/1.0",
          "Cache-Control": "no-cache"
        },
        signal: AbortSignal.timeout(8000)
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const status = response.status;
        const msg = errorData.error?.message || response.statusText;
        const details = JSON.stringify(errorData);
        
        log(`[brave] Search failed (${status}): ${msg} | Details: ${details}`, "error");
        healthManager.reportFailure(SOURCE_NAME, `HTTP ${status}: ${msg}`);
        throw new Error(`Brave Search failed: ${msg}`);
      }

      const data = await response.json();
      healthManager.reportSuccess(SOURCE_NAME);
      return data;
    } catch (error: any) {
      if (error.name === 'TimeoutError') {
        log(`[brave] Search timed out`, "error");
        healthManager.reportFailure(SOURCE_NAME, "Timeout");
        throw new Error("Brave Search timed out");
      }
      
      // If it's already an error we threw above, just rethrow it
      if (error.message.startsWith("Brave Search failed")) {
        throw error;
      }

      log(`[brave] Search error: ${error.message}`, "error");
      healthManager.reportFailure(SOURCE_NAME, error.message);
      throw error;
    }

  }
}

