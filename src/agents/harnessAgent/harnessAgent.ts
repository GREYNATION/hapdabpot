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
                    headless: "shell",
                    args: ["--no-sandbox", "--disable-setuid-sandbox"]
                });
            }

            const page = await this.browser.newPage();
            await page.goto(url, { waitUntil: 'networkidle2' });

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
            return `❌ Harness Error: ${err.message}`;
        }
    }

    public async shutdown() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }
}

export async function handleHarnessCommand(args: string): Promise<string> {
    if (!args) return "📖 Usage: `/harness [url] [task]`";

    const parts = args.split(' ');
    const url = parts[0].startsWith('http') ? parts.shift() : 'https://www.google.com';
    const task = parts.join(' ') || "Summarize the page";

    const agent = HarnessAgent.getInstance();
    return await agent.browse(url!, task);
}
