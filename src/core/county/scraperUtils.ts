import puppeteer, { Browser, Page } from "puppeteer";
import { log } from "../config.js";

/**
 * Reusable County Record Scraper Utility
 * Provides a managed Puppeteer lifecycle for extracting property data from Tier 3 websites.
 */

export async function scrapeCounty<T>(
  url: string, 
  evaluator: () => T[] | Promise<T[]>,
  options: { waitSelector?: string; delay?: number } = {}
): Promise<T[]> {
  log(`[scraper] 🕵️ Starting headless scan: ${url}`);
  
  let browser: Browser | null = null;
  try {
    browser = await puppeteer.launch({
      headless: true, // Use "new" for performance
      args: ["--no-sandbox", "--disable-setuid-sandbox"] // Required for Linux/Railway
    });

    const page = await browser.newPage();
    
    // Set a realistic user agent to avoid basic bot detection
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");

    await page.goto(url, { waitUntil: "networkidle2", timeout: 45000 });

    if (options.waitSelector) {
      log(`[scraper] Waiting for selector: ${options.waitSelector}`);
      await page.waitForSelector(options.waitSelector, { timeout: 15000 });
    }

    if (options.delay) {
      await new Promise(r => setTimeout(r, options.delay));
    }

    const data = await page.evaluate(evaluator);

    log(`[scraper] ✅ Scan complete. Extracted ${data.length} items from ${url}`);
    return data;
  } catch (err: any) {
    log(`[scraper] ❌ Scrape error for ${url}: ${err.message}`, "error");
    return [];
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
