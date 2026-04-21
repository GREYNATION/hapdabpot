import { Telegraf } from "telegraf";
import { log, config } from "../core/config.js";
import { ExecutiveManager } from "../core/executive/executiveManager.js";

export function startMorningBriefing(bot: Telegraf) {
    const briefingHour = parseInt(process.env.BRIEFING_HOUR || "7");
    
    log(`[cron] Morning briefing scheduled for ${briefingHour}:00 AM daily.`);

    let lastRunDate = "";

    setInterval(async () => {
        const now = new Date();
        const currentDate = now.toISOString().split("T")[0]; // YYYY-MM-DD
        const currentHour = now.getHours();

        // Run if it's the right hour AND we haven't run today yet
        if (currentHour === briefingHour && lastRunDate !== currentDate) {
            try {
                await sendExecutiveBriefing(bot);
                lastRunDate = currentDate;
                log(`[cron] Executive morning briefing sent for ${currentDate}`);
            } catch (err: any) {
                log(`[cron] Failed to send morning briefing: ${err.message}`, "error");
            }
        }
    }, 60 * 1000); // Check every minute
}

async function sendExecutiveBriefing(bot: Telegraf) {
    const ownerId = config.ownerId;
    if (!ownerId) {
        log("[cron] Skip briefing: OWNER_CHAT_ID not set", "warn");
        return;
    }

    // 1. Generate the sophisticated report
    const report = await ExecutiveManager.generateMorningBriefing();

    // 2. Wrap and send to Telegram
    let message = `☀️ **Executive Briefing Initialized**\n\n`;
    message += report;

    if (message.length <= 4096) {
        await bot.telegram.sendMessage(ownerId, message, { parse_mode: "Markdown" });
    } else {
        const chunks = message.match(/[\s\S]{1,4000}/g) ?? [message];
        for (const chunk of chunks) {
            await bot.telegram.sendMessage(ownerId, chunk, { parse_mode: "Markdown" }).catch(() => {});
        }
    }
}
