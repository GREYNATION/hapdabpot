import axios from "axios";
import { config, log } from "../core/config.js";
import { healthManager } from "./sourceHealth.js";

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

    if (!config.braveApiKey) {
      log(`[brave] BRAVE_API_KEY is missing`, "error");
      throw new Error("BRAVE_API_KEY is not configured.");
    }

    if (!healthManager.isHealthy(SOURCE_NAME)) {
      throw new Error(`${SOURCE_NAME} is currently on cooldown.`);
    }

    try {
      log(`[brave] Searching for: ${query}`);
      const response = await axios.get(this.BASE_URL, {
        params: { 
          q: query, 
          count,
          safesearch: "off",
          text_decorations: false
        },
        headers: { 
          "Accept": "application/json",
          "X-Subscription-Token": config.braveApiKey
        },
        timeout: 8000 // Slightly longer timeout for reliability
      });
      
      healthManager.reportSuccess(SOURCE_NAME);
      return response.data;
    } catch (error: any) {
      const status = error.response?.status;
      const msg = error.response?.data?.message || error.message;
      
      log(`[brave] Search failed (${status}): ${msg}`, "error");
      healthManager.reportFailure(SOURCE_NAME, `HTTP ${status}: ${msg}`);
      
      throw new Error(`Brave Search failed: ${msg}`);
    }
  }
}
