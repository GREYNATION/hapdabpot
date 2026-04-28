import { log } from "../../core/config.js";
import { openai, askAI } from "../../core/ai.js";
import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";

/**
 * HarnessAgent — Integration with browser-use/browser-harness principles.
 * Low-level Chrome DevTools Protocol (CDP) interactions for high-fidelity agent browsing.
 */
export class HarnessAgent {
    private static instance: HarnessAgent;
    private browser: any = null;

    private constructor() {}

    public static getInstance() {
        if (!this.instance) this.instance = new HarnessAgent();
        return this.instance;
    }

    /**
     * Execute a browser task using the harness philosophy.
     */
    public async browse(url: string, task: string): Promise<string> {
        log(`[harness] Starting agent task on ${url}: ${task}`);

        try {
            if (!this.browser) {
                this.browser = await puppeteer.launch({
                    headless: true,
                    args: [
                        "--no-sandbox",
                        "--disable-setuid-sandbox",
                        "--disable-dev-shm-usage",
                        "--disable-gpu",
                        "--single-process"
                    ]
                });
            }

            const page = await this.browser.newPage();
            await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");

            try {
                await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
            } catch (navErr: any) {
                await page.close();
                if (navErr.message?.includes('ERR_NAME_NOT_RESOLVED')) {
                    return `Could not reach "${url}" — domain not found.\n\nDid you mistype the URL? (e.g. "new.google.com" should be "news.google.com")`;
                }
                if (navErr.message?.includes('timeout') || navErr.message?.includes('TimeoutError')) {
                    return `Page load timed out for "${url}".\n\nThe site may be slow or blocking headless browsers. Try a different URL.`;
                }
                return `Navigation failed: ${navErr.message}`;
            }

            // Extract page state for the AI
            const content = await page.evaluate(() => {
                return {
                    title: document.title,
                    text: document.body.innerText.substring(0, 5000),
                    links: Array.from(document.querySelectorAll('a')).slice(0, 20).map(a => (a as any).href)
                };
            });

            // Let AI decide the next step
            const aiResponse = await askAI(
                `You are a Browser Harness Agent. The user wants to: ${task}.
                 Current page content: ${content.text}
                 Page Title: ${content.title}
                 Links: ${content.links.join(', ')}
                 
                 Provide a concise summary or the answer based on this page state.`,
                "You are an expert browser automation agent."
            );

            await page.close();
            return aiResponse.content;

        } catch (err: any) {
            log(`[harness] Error: ${err.message}`, "error");
            // Reset browser on error so next call gets a fresh instance
            if (this.browser) {
                await this.browser.close().catch(() => {});
                this.browser = null;
            }
            return `Harness Error: ${err.message}`;
        }
    }

    public async shutdown() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }
}


export async function handleHarnessCommand(input: string) {
  const parts = input.split(" ");
  
  // The first part of input might be the url, or we just extract safely
  const url = parts[0];
  let task: any = parts.slice(1).join(" ");

  if (!url || !task) {
    return `Usage:\n/harness https://example.com "extract product data"\nOR\n/harness https://example.com {"type":"extract_products", "filters":{...}}`;
  }

  // Try to parse structured JSON tasks
  try {
    task = JSON.parse(task);
  } catch (e) {
    // Keep as string if it's not valid JSON
  }

  // Call your API instead of running locally
  try {
    const port = process.env.PORT || 8080;
    const res = await fetch(`http://localhost:${port}/api/agent/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agent: {
          id: "harness",
          type: "browser",
          task,
          input: { url }
        }
      })
    });

    const data = await res.json();
    return `🚀 Job queued: ${data.jobId}`;
  } catch (err: any) {
    return `❌ Failed to contact API: ${err.message}`;
  }
}
