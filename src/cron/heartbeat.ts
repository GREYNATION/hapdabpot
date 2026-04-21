import { Telegraf } from "telegraf";
import { log, config } from "../core/config.js";
import { ExecutiveManager } from "../core/executive/executiveManager.js";

export function startHeartbeat(bot: Telegraf) {
    const intervalMinutes = parseInt(process.env.HEARTBEAT_INTERVAL || "30");
    
    log(`[cron] Executive Heartbeat initialized (Interval: ${intervalMinutes}m).`);

    setInterval(async () => {
        try {
            const pulse = await ExecutiveManager.runTriagePulse();
            
            if (pulse) {
                const ownerId = config.ownerId;
                if (ownerId) {
                    await bot.telegram.sendMessage(ownerId, pulse, { parse_mode: "Markdown" });
                    log("[cron] Heartbeat pulse sent to owner.");
                }
            }
        } catch (err: any) {
            log(`[cron] Heartbeat failed: ${err.message}`, "error");
        }
    }, intervalMinutes * 60 * 1000);
}
