/**
 * cron/contentCron.ts
 * Daily video content scheduler — fires at 10 AM.
 */

import cron from "node-cron";
import { Telegraf } from "telegraf";
import { ContentAgent } from "../agents/ContentAgent.js";
const contentCreator = new ContentAgent();
export function startContentCron(bot: Telegraf) {
    const ownerId = process.env.TELEGRAM_OWNER_ID || process.env.OWNER_CHAT_ID;

    // Daily content post — 10 AM
    cron.schedule("0 10 * * *", async () => {
        console.log("[cron] 🎬 Starting daily content generation...");
        cron.schedule("0 10 * * *", async () => {
            try {
                const result = await contentCreator.createVideo("daily real estate wholesaling tip", true);
                if (ownerId) bot.telegram.sendMessage(ownerId, result, { parse_mode: "Markdown" });
            } catch (err) {
                console.error("[contentCron] Failed:", err);
                if (ownerId) bot.telegram.sendMessage(ownerId, `❌ Daily content failed: ${err}`);
            }
        });


        const result = await contentCreator.createVideo("daily real estate wholesaling tip", true);
        if (ownerId) bot.telegram.sendMessage(ownerId, result, { parse_mode: "Markdown" });
    } catch (err) {
        console.error("[contentCron] Failed:", err);
        if (ownerId) bot.telegram.sendMessage(ownerId, `❌ Daily content failed: ${err}`);
    }
});

console.log("[cron] 🎬 Content cron scheduled for 10 AM daily.");
}
