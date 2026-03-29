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

    let message = `â˜€ï¸ **Good morning, Hap!**\nðŸ“… ${today}\n\n`;

    message += `ðŸ—ï¸ **Pipeline Snapshot**\n`;
    message += `ðŸ”µ Leads: ${stats.leads}\n`;
    message += `ðŸ“ž Contacted: ${stats.contacted}\n`;
    message += `âœï¸ Under Contract: ${stats.contract}\n\n`;

    message += `â° **Follow-Ups Due TODAY: ${followUps.length}**\n`;
    followUps.forEach(f => {
        message += `- ${f.address} (${f.seller_name || 'Prospect'}) â€” 3d+ silent\n`;
    });
    message += `\n`;

    if (hottest) {
        message += `ðŸ”¥ **Hottest Deal**\n`;
        message += `ðŸ“ ${hottest.address} â€” $${hottest.profit.toLocaleString()} profit\n\n`;
    }

    message += `ðŸ’µ **Revenue**\n`;
    message += `Month: $${revenue.month.toLocaleString()}\n`;
    message += `All Time: $${revenue.allTime.toLocaleString()}\n\n`;

    if (followUps.length > 0) {
        message += `ðŸŽ¯ **Today's Priority**\n`;
        const p = followUps[0];
        message += `Call ${p.seller_name || 'Prospect'} at ${p.seller_phone || 'No phone'}\n`;
    } else {
        message += `ðŸŽ¯ **Today's Priority**\nNo urgent follow-ups. Focus on finding new leads!\n`;
    }

    await bot.telegram.sendMessage(ownerId, message, { parse_mode: "Markdown" });
}

