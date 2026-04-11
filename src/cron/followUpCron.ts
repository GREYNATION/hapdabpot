import cron from "node-cron";
import { CrmManager } from "../core/crm.js";
import { sendSms, sendTelegram } from "../services/outreachService.js";
import { log } from "../core/config.js";
import { Telegraf } from "telegraf";

/**
 * Follow-Up Cron (Check-in Engine)
 * Runs every 6 hours to re-engage leads that haven't responded or moved in 3 days.
 * 
 * Schedule: 0 every 6 hours
 */
export function startFollowUpCron(bot?: Telegraf) {
    log("[cron] Initializing Follow-Up Engine (Every 6h)...");

    cron.schedule("0 */6 * * *", async () => {
        log("[cron] Running Follow-Up check-in...");
        
        try {
            // Get leads untouched for 3 days
            const coldLeads = CrmManager.getColdLeads(3);
            
            if (coldLeads.length === 0) {
                log("[cron] No cold leads found for follow-up.");
                return;
            }

            log(`[cron] Found ${coldLeads.length} cold leads. Initiating check-ins...`);

            for (const lead of coldLeads) {
                if (!lead.seller_phone) continue;

                const message = `Just checking in—are you still open to discussing your property at ${lead.address}?`;
                
                try {
                    await sendSms(lead.seller_phone, message);
                    
                    // Mark as updated so they don't get hit again in 6 hours
                    CrmManager.updateDeal(lead.id, { notes: (lead.notes || "") + "\n[Auto Follow-up sent]" });
                    
                    log(`[cron] Follow-up sent to ${lead.address}`);
                } catch (smsErr: any) {
                    log(`[cron] SMS failed for ${lead.address}: ${smsErr.message}`, "warn");
                }
            }

            if (bot) {
                await sendTelegram(`📉 **Automated Follow-up Complete**\nCheck-ins sent to ${coldLeads.length} cold leads.`);
            }

        } catch (err: any) {
            log(`[cron] Follow-Up Error: ${err.message}`, "error");
        }
    });
}
