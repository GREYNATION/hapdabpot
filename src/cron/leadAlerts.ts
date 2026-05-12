import cron from "node-cron";
import { Telegraf } from "telegraf";
import { CrmManager } from "../core/crm.js";
import { getDb } from "../core/memory.js";
import { promptOutreachApproval } from "../services/outreachService.js";
import { findMotivatedSellers, autoSaveToCRM } from "../services/universalLeadScraper.js";
import { Lead } from "../types/lead.js";
import { formatTopDeal, tagDeal } from "../services/leadFilter.js";
import { log } from "../core/config.js";
import { SupabaseCrm } from "../core/supabaseCrm.js";
import { saveLeadToObsidian } from "../services/vaultService.js";

// â€”â€”â€” Types â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”

interface LeadSearchCriteria {
    id: number;
    label: string;
    city: string;
    state: string;
    zip_codes?: string;
    active: number;
}

// â€”â€”â€” Core Logic â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”

export function startLeadAlerts(bot: Telegraf) {
    const SCAN_HOUR = Number(process.env.LEAD_SCAN_HOUR || 6); // 6 AM default

    log(`[cron] Initializing lead scanners. Scan set for ${SCAN_HOUR}:00 daily.`);

    // ðŸ›¡ï¸ SHIELD: Pre-emptively run a scan if requested via CLI flag (for testing)
    if (process.argv?.includes("--scan-now")) {
        log("[cron] âš¡ CLI trigger detected: Running manual scan now...");
        processDailyLeadScan(bot);
    }

    // Daily at SCAN_HOUR AM
    cron.schedule(`0 ${SCAN_HOUR} * * *`, async () => {
        log(`ðŸ¤– [cron] Starting scheduled ${SCAN_HOUR}:00 AM scan...`);
        await processDailyLeadScan(bot);
    });

    log("[cron] âœ… Daily lead alerts scheduled.");
}

async function processDailyLeadScan(bot: Telegraf) {
    const OWNER_CHAT_ID = Number(process.env.OWNER_CHAT_ID!);
    
    log("[leads] Beginning daily lead aggregation...");

    const criteria = getDb().prepare(
        "SELECT * FROM lead_search_criteria WHERE active = 1"
    ).all() as LeadSearchCriteria[];

    if (criteria.length === 0) {
        log("[leads] No active search criteria found.", "warn");
        return;
    }

    const allRawLeads: Lead[] = [];

    // 1. Collect all raw leads from active criteria
    for (const criterion of criteria) {
        try {
            const zips = criterion.zip_codes ? criterion.zip_codes.split(',').map((z: string) => z.trim()) : [];
            const leads = await findMotivatedSellers(criterion.state, criterion.city, zips, false);
            
            // ðŸ›¡ï¸ SHIELD: Flatten results and remove any nulls/undefineds immediately
            const safeLeads = (leads || [])
                .filter((lead: Lead) => lead !== null && lead !== undefined && lead.address);

            if (safeLeads.length === 0) {
                log(`[leads] âš ï¸ Empty scan result for ${criterion.label} (${criterion.city}, ${criterion.state}). Possible anti-scraping block or no new inventory.`, "warn");
            }

            // ðŸ›¡ï¸ SHIELD: Safely filter for this specific market
            const qualifyingDeals = safeLeads.filter(lead => {
                try {
                    const addr = String(lead.address || "").toLowerCase();
                    if (!addr) return false;

                    const targetCity = (criterion.city || "").toLowerCase();
                    const targetState = (criterion.state || "").toLowerCase();

                    const matchesCity = targetCity ? (addr ?? "")?.includes(targetCity) : false;
                    const matchesState = targetState ? (addr ?? "")?.includes(targetState) : false;
                    
                    const matchesZip = zips.length > 0 
                        ? zips.some((zip: string) => (addr ?? "")?.includes(String(zip).toLowerCase())) 
                        : true;
                    
                    return (matchesCity || matchesState) && matchesZip;
                } catch (err) {
                    log(`[leads] Filter error for lead: ${lead?.address || 'unknown'}`, "warn");
                    return false;
                }
            });

            log(`[leads] ${qualifyingDeals.length} deals passed the filter for ${criterion.label} (${criterion.city}).`);
            allRawLeads.push(...qualifyingDeals);
        } catch (err: any) {
            log(`[leads] Scraper failed for ${criterion.city}: ${err.message}`, "error");
        }
    }

    const qualifyingDeals = allRawLeads;

    if (qualifyingDeals.length === 0) {
        await bot.telegram.sendMessage(
            OWNER_CHAT_ID,
            "ðŸ” *Lead Scan Complete*\n\nNo new qualifying deals found in the target markets.",
            { parse_mode: "Markdown" }
        );
        return;
    }

    // Sort by DQS >= 60 (Hard Filter)
    const validDeals = qualifyingDeals
        .filter(l => (l.dealScore || 0) >= 60)
        .sort((a, b) => (b.dealScore || 0) - (a.dealScore || 0));

    if (validDeals.length === 0) {
        await bot.telegram.sendMessage(
            OWNER_CHAT_ID,
            "ðŸ” *Lead Scan Complete*\n\nNo new qualifying deals found today.",
            { parse_mode: "Markdown" }
        );
        return;
    }

    // Save high-quality deals to scraped_leads index for Telegram /-commands
    for (const lead of validDeals) {
        const alreadyExists = getDb().prepare(
            "SELECT id FROM scraped_leads WHERE address = ? AND created_at > date('now', '-7 days')"
        ).get(lead.address);

        if (alreadyExists) continue;

        getDb().prepare(`
            INSERT INTO scraped_leads 
            (address, source, price, estimated_arv, estimated_repairs, mao, potential_profit, days_on_market, motivation_signals, url, alerted)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        `).run(
            lead.address,
            lead.source,
            lead.price || 0,
            lead.arv || 0,
            lead.repairs || 0,
            lead.maxOffer || 0,
            (lead.arv || 0) - (lead.price || 0) - (lead.repairs || 0),
            0,
            JSON.stringify(lead.distressSignals),
            lead.url
        );

        // Also save to Obsidian Vault for long-term tracking
        saveLeadToObsidian(lead);
    }

    // Send summary alert
    await sendLeadAlertSummary(bot, OWNER_CHAT_ID, validDeals);
}

async function sendLeadAlertSummary(bot: Telegraf, chatId: number, leads: Lead[]) {
    // Top Deals (80+) -> Individual Alerts (max 5)
    const deals = leads.filter(l => (l.dealScore || 0) >= 80);
    // Watchlist (60-79) -> Summary
    const watchlist = leads.filter(l => (l.dealScore || 0) >= 60 && (l.dealScore || 0) < 80);

    if (deals.length > 0) {
        log(`[leads] Found ${deals.length} deals score >= 80. Triggering individual approval requests...`);
        for (const deal of deals.slice(0, 5)) {
            await SupabaseCrm.requestApproval(deal, bot);
        }
    }

    if (watchlist.length > 0) {
        let watchMsg = `ðŸ“‹ **WATCHLIST SUMMARY (${watchlist.length} properties)**\n\n`;
        watchlist.slice(0, 10).forEach((l, i) => {
            watchMsg += `${i+1}. ${l.address} | Score: ${l.dealScore} | $${(l.price || 0).toLocaleString()}\n`;
        });
        watchMsg += `\n_Type /scan to refresh or /addlead <number>_`;
        await bot.telegram.sendMessage(chatId, watchMsg, { parse_mode: "Markdown" });
    }
}

export function registerLeadAlertHandlers(bot: Telegraf) {
    const OWNER_CHAT_ID = Number(process.env.OWNER_CHAT_ID!);

    bot.command("scan", async (ctx) => {
        if (ctx.chat.id !== OWNER_CHAT_ID) return;
        await ctx.reply("ðŸ” Running unified lead scan now... I'll alert you when I find real deals.");
        await processDailyLeadScan(bot);
    });

    bot.command("criteria", async (ctx) => {
        if (ctx.chat.id !== OWNER_CHAT_ID) return;
        const criteria = getDb().prepare("SELECT * FROM lead_search_criteria WHERE active = 1").all() as any[];

        let msg = `ðŸ” *Active Search Criteria*\n\n`;
        criteria.forEach((c, i) => {
            msg += `*${i + 1}. ${c.label}*\n`;
            msg += `ðŸ“ ${c.city}, ${c.state}\n`;
            msg += `ðŸ’° Max Price: $${c.max_price.toLocaleString()}\n`;
            msg += `ðŸ“ˆ Min Profit: $${c.min_profit.toLocaleString()}\n\n`;
        });
        await ctx.reply(msg, { parse_mode: "Markdown" });
    });

    bot.command("addlead", async (ctx) => {
        if (ctx.chat.id !== OWNER_CHAT_ID) return;
        const parts = ctx.message.text.split(" ").slice(1);
        const idx = parseInt(parts[0]) - 1;

        const recentLeads = getDb().prepare(
            "SELECT * FROM scraped_leads WHERE alerted = 1 ORDER BY created_at DESC LIMIT 15"
        ).all() as any[];

        if (!recentLeads[idx]) {
            return ctx.reply("Lead index not found in recent scan results.");
        }

        const lead = recentLeads[idx];
        const dealId = (CrmManager as any).addDeal({
            address: lead.address,
            arv: lead.estimated_arv,
            repair_estimate: lead.estimated_repairs,
            profit: lead.potential_profit,
            status: "lead",
        });

        await ctx.reply(`âœ… *Added to CRM as Deal #${dealId}*\nðŸ“ ${lead.address}`, { parse_mode: "Markdown" });
        await promptOutreachApproval(bot, dealId);
    });

    log("[leads] Lead alert handlers registered.");
}

