import FirecrawlApp from '@mendable/firecrawl-js';
import { config, log } from "../core/config.js";
import { healthManager } from "./sourceHealth.js";

/**
 * Firecrawl Service
 * Hardened production implementation for robust web scraping and search.
 */
export class FirecrawlService {
  private static getApp() {
    if (!config.firecrawlApiKey) {
      throw new Error("FIRECRAWL_API_KEY is not configured.");
    }
    return new FirecrawlApp({ apiKey: config.firecrawlApiKey });
  }

  /**
   * Scrape a URL using Firecrawl
   */
  static async scrape(url: string) {
    const SOURCE_NAME = 'Firecrawl';
    if (!healthManager.isHealthy(SOURCE_NAME)) {
      throw new Error(`${SOURCE_NAME} is currently on cooldown.`);
    }

    try {
      log(`[firecrawl] Scraping URL: ${url}`);
      const app = this.getApp();
      const result = await app.scrape(url, {
        formats: ['markdown']
      }) as any;

      // Handle v4 SDK success check
      const isSuccess = result.success === true || result.markdown !== undefined || result.data !== undefined || result.content !== undefined;

      if (!isSuccess) {
        throw new Error(result.error || "Scrape failed");
      }

      healthManager.reportSuccess(SOURCE_NAME);
      // Normalize response: ensure markdown is accessible
      if (!result.markdown && result.data?.markdown) result.markdown = result.data.markdown;
      
      return result;
    } catch (error: any) {
      log(`[firecrawl] Scrape failed: ${error.message}`, "error");
      healthManager.reportFailure(SOURCE_NAME, error.message);
      throw error;
    }
  }

  /**
   * Search the web using Firecrawl
   */
  static async search(query: string, limit: number = 5) {
    const SOURCE_NAME = 'Firecrawl';
    if (!healthManager.isHealthy(SOURCE_NAME)) {
      throw new Error(`${SOURCE_NAME} is currently on cooldown.`);
    }

    try {
      log(`[firecrawl] Searching for: ${query}`);
      const app = this.getApp();
      const results = await app.search(query, {
        limit
      }) as any;

      // Normalize results for v4 SDK (which may return { success, data } or { web })
      const isSuccess = results.success === true || results.data !== undefined || results.web !== undefined;

      if (!isSuccess) {
         throw new Error(results.error || "Search failed");
      }

      // Normalize data property
      if (!results.data && results.web) results.data = results.web;

      healthManager.reportSuccess(SOURCE_NAME);
      return results;
    } catch (error: any) {
      log(`[firecrawl] Search failed: ${error.message}`, "error");
      healthManager.reportFailure(SOURCE_NAME, error.message);
      throw error;
    }
  }
}
