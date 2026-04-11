import { Telegraf } from "telegraf";
import { CrmManager } from "../core/crm.js";
import { log, config } from "../core/config.js";

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
                await sendMorningBriefing(bot);
                lastRunDate = currentDate;
                log(`[cron] Morning briefing sent for ${currentDate}`);
            } catch (err: any) {
                log(`[cron] Failed to send morning briefing: ${err.message}`, "error");
            }
        }
    }, 60 * 1000); // Check every minute
}

async function sendMorningBriefing(bot: Telegraf) {
    const ownerId = config.ownerId;
    if (!ownerId) {
        log("[cron] Skip briefing: OWNER_CHAT_ID not set", "warn");
        return;
    }

    const stats = CrmManager.getStats();
    const hottest = CrmManager.getHottestDeal();
    const revenue = CrmManager.getTotalRevenue();
    const followUps = CrmManager.getFollowUpsDueToday();

    const today = new Date().toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric"
    });

    let message = `☀️ **Good morning, Hap!**\n📅 ${today}\n\n`;

    message += `🏗️ **Pipeline Snapshot**\n`;
    message += `🔵 Leads: ${stats.leads}\n`;
    message += `📞 Contacted: ${stats.contacted}\n`;
    message += `✍️ Under Contract: ${stats.contracts || 0}\n\n`;

    message += `⏰ **Follow-Ups Due TODAY: ${followUps.length}**\n`;
    followUps.forEach(f => {
        message += `- ${f.address} (${f.seller_name || 'Prospect'}) — 3d+ silent\n`;
    });
    message += `\n`;

    if (hottest) {
        message += `🔥 **Hottest Deal**\n`;
        message += `📍 ${hottest.address} — $${(hottest.profit || 0).toLocaleString()} profit\n\n`;
    }

    message += `💰 **Revenue**\n`;
    message += `Month: $${(revenue.month || 0).toLocaleString()}\n`;
    message += `All Time: $${(revenue.allTime || 0).toLocaleString()}\n\n`;

    if (followUps.length > 0) {
        message += `🎯 **Today's Priority**\n`;
        const p = followUps[0];
        message += `Call ${p.seller_name || 'Prospect'} at ${p.seller_phone || 'No phone'}\n`;
    } else {
        message += `🎯 **Today's Priority**\nNo urgent follow-ups. Focus on finding new leads!\n`;
    }

    await bot.telegram.sendMessage(ownerId, message, { parse_mode: "Markdown" });
}
