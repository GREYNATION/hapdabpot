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
     * Execute a browser task using an iterative loop (Cline-style).
     */
    public async browse(url: string, task: string, maxSteps = 10): Promise<string> {
        log(`[harness] Starting iterative task on ${url}: ${task}`);

        try {
            if (!this.browser) {
                this.browser = await puppeteer.launch({
                    headless: true,
                    args: [
                        "--no-sandbox",
                        "--disable-setuid-sandbox",
                        "--disable-dev-shm-usage",
                        "--disable-gpu",
                        "--single-process",
                        "--window-size=1280,800"
                    ]
                });
            }

            const page = await this.browser.newPage();
            await page.setViewport({ width: 1280, height: 800 });
            await page.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36");

            let currentUrl = url;
            let step = 0;
            let finalResult = "";

            // Initial navigation
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
            await this.waitTillHTMLStable(page);

            while (step < maxSteps) {
                step++;
                log(`[harness] Step ${step}/${maxSteps}...`);

                // Capture Screenshot
                const screenshot = await page.screenshot({ encoding: "base64", type: "jpeg", quality: 70 });

                // Extract high-fidelity state
                const state = await page.evaluate(() => {
                    function getSelector(el: Element) {
                        if (el.id) return `#${el.id}`;
                        const tag = el.tagName.toLowerCase();
                        if (el.className) {
                            const classes = el.className.split(/\s+/).filter(Boolean).join('.');
                            if (classes) return `${tag}.${classes}`;
                        }
                        return tag;
                    }

                    const elements = Array.from(document.querySelectorAll('button, a, input, select, [role="button"], [role="link"]'));
                    return {
                        title: document.title,
                        url: window.location.href,
                        text: document.body.innerText.substring(0, 3000),
                        interactables: elements.slice(0, 30).map(el => ({
                            tag: el.tagName,
                            text: el.textContent?.trim().substring(0, 50),
                            ariaLabel: el.getAttribute('aria-label'),
                            placeholder: el.getAttribute('placeholder'),
                            selector: getSelector(el),
                            type: (el as any).type
                        }))
                    };
                });

                // Prompt with Visual Context
                const promptMessages: any[] = [
                    { role: "system", content: "You are a precise browser automation controller. Use the screenshot and text to decide the best action." },
                    { 
                        role: "user", 
                        content: [
                            { type: "text", text: `User Task: ${task}\nCurrent URL: ${state.url}\nPage Title: ${state.title}\n\nVisible Content:\n${state.text}\n\nInteractive Elements:\n${JSON.stringify(state.interactables, null, 2)}` },
                            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${screenshot}` } }
                        ]
                    },
                    { role: "user", content: "DECIDE YOUR NEXT ACTION. Return ONLY a JSON object: {\"thought\": \"...\", \"action\": \"click\"|\"type\"|\"scroll\"|\"wait\"|\"done\", \"selector\": \"...\", \"text\": \"...\", \"answer\": \"...\"}" }
                ];

                const aiResponse = await askAI("", "", { 
                    messages: promptMessages, 
                    model: "claude-3-5-sonnet-20241022" 
                });
                
                let decision;
                try {
                    const cleaned = aiResponse.content.replace(/```json|```/g, "").trim();
                    decision = JSON.parse(cleaned);
                } catch (e) {
                    log(`[harness] AI returned non-JSON: ${aiResponse.content}`, "error");
                    decision = { action: "done", answer: aiResponse.content };
                }

                log(`[harness] Action: ${decision.action} - ${decision.thought}`);

                if (decision.action === "done") {
                    finalResult = decision.answer || "Task completed.";
                    break;
                }

                try {
                    if (decision.action === "click" && decision.selector) {
                        await page.click(decision.selector);
                        // Wait for navigation OR network to settle
                        await Promise.race([
                            page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 5000 }),
                            new Promise(r => setTimeout(r, 2000))
                        ]).catch(() => {});
                    } else if (decision.action === "type" && decision.selector) {
                        await page.focus(decision.selector);
                        await page.keyboard.down('Control');
                        await page.keyboard.press('A');
                        await page.keyboard.up('Control');
                        await page.keyboard.press('Backspace');
                        await page.type(decision.selector, decision.text || "");
                        await page.keyboard.press('Enter');
                    } else if (decision.action === "scroll") {
                        await page.evaluate(() => window.scrollBy(0, 600));
                        await new Promise(r => setTimeout(r, 1000));
                    } else if (decision.action === "wait") {
                        await new Promise(r => setTimeout(r, 3000));
                    }
                    
                    await this.waitTillHTMLStable(page);
                } catch (actionErr: any) {
                    log(`[harness] Action error: ${actionErr.message}`, "warn");
                }
            }

            await page.close();
            return finalResult || "Exceeded maximum steps without completion.";

        } catch (err: any) {
            log(`[harness] Error: ${err.message}`, "error");
            if (this.browser) {
                await this.browser.close().catch(() => {});
                this.browser = null;
            }
            return `Harness Error: ${err.message}`;
        }
    }

    /**
     * Cline-style HTML stability check
     */
    private async waitTillHTMLStable(page: any, timeout = 5000) {
        const checkDuration = 500;
        const maxChecks = timeout / checkDuration;
        let lastSize = 0;
        let stableCount = 0;

        for (let i = 0; i < maxChecks; i++) {
            const html = await page.content();
            const currentSize = html.length;

            if (lastSize !== 0 && currentSize === lastSize) {
                stableCount++;
            } else {
                stableCount = 0;
            }

            if (stableCount >= 2) break;
            lastSize = currentSize;
            await new Promise(r => setTimeout(r, checkDuration));
        }
    }

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
