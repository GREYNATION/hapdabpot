import { Telegraf } from "telegraf";
import { CrmManager } from "../core/crm.js";
import { getDb } from "../core/memory.js";
import { promptOutreachApproval } from "../services/outreachService.js";
import { findMotivatedSellers, Lead } from "../services/universalLeadScraper.js";
import { formatTopDeal, tagDeal } from "../services/leadFilter.js";
import { log } from "../core/config.js";
import { SupabaseCrm } from "../core/supabaseCrm.js";

// ——— Types ——————————————————————————————————————————————————————————————————————

export function startLeadAlerts(bot: Telegraf) {
    const OWNER_CHAT_ID = Number(process.env.OWNER_CHAT_ID!);
    const SCAN_HOUR = Number(process.env.LEAD_SCAN_HOUR || 6); // 6 AM default

    log(`[leads] Lead alert scan scheduled for ${SCAN_HOUR}:00 AM daily`);

    // Run once on startup (after 30s delay)
    setTimeout(async () => {
        log("[leads] Running startup lead scan...");
        await runLeadScan(bot, OWNER_CHAT_ID, true);
    }, 30000);

    // Then run daily at SCAN_HOUR
    setInterval(async () => {
        const now = new Date();
        if (now.getHours() === SCAN_HOUR && now.getMinutes() === 0) {
            await runLeadScan(bot, OWNER_CHAT_ID, false);
        }
    }, 60 * 1000);
}

// ——— Core Scan Logic ————————————————————————————————————————————————————————————

async function runLeadScan(bot: Telegraf, chatId: number, isStartup: boolean) {
    log("[leads] Starting unified lead scan...");

    const criteria = getDb().prepare(
        "SELECT * FROM lead_search_criteria WHERE active = 1"
    ).all() as any[];

    if (criteria.length === 0) {
        log("[leads] No active search criteria found.", "warn");
        return;
    }

    const allLeads: Lead[] = [];

    // Use unified scraper for all criteria
    for (const criterion of criteria) {
        const leads = await findMotivatedSellers(criterion.state, criterion.city, false);
        allLeads.push(...leads);
    }

    // Filter by DQS >= 60 (Hard Filter per user request)
    const validDeals = allLeads
        .filter(l => (l.dealScore || 0) >= 60)
        .sort((a, b) => (b.dealScore || 0) - (a.dealScore || 0));

    if (validDeals.length === 0) {
        if (!isStartup) {
            await bot.telegram.sendMessage(
                chatId,
                "🔍 *Lead Scan Complete*\n\nNo new qualifying deals found today.",
                { parse_mode: "Markdown" }
            );
        }
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
    }

    // Send summary alert
    await sendLeadAlertSummary(bot, chatId, validDeals);
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
        let watchMsg = `📋 **WATCHLIST SUMMARY (${watchlist.length} properties)**\n\n`;
        watchlist.slice(0, 10).forEach((l, i) => {
            watchMsg += `${i+1}. ${l.address} | Score: ${l.dealScore} | $${(l.price || 0).toLocaleString()}\n`;
        });
        watchMsg += `\n_Type /scan to refresh or /addlead <number>_`;
        await bot.telegram.sendMessage(chatId, watchMsg);
    }
}

export function registerLeadAlertHandlers(bot: Telegraf) {
    const OWNER_CHAT_ID = Number(process.env.OWNER_CHAT_ID!);

    bot.command("scan", async (ctx) => {
        if (ctx.chat.id !== OWNER_CHAT_ID) return;
        await ctx.reply("🔍 Running unified lead scan now... I'll alert you when I find real deals.");
        await runLeadScan(bot, OWNER_CHAT_ID, false);
    });

    bot.command("criteria", async (ctx) => {
        if (ctx.chat.id !== OWNER_CHAT_ID) return;
        const criteria = getDb().prepare("SELECT * FROM lead_search_criteria WHERE active = 1").all() as any[];

        let msg = `🔍 *Active Search Criteria*\n\n`;
        criteria.forEach((c, i) => {
            msg += `*${i + 1}. ${c.label}*\n`;
            msg += `📍 ${c.city}, ${c.state}\n`;
            msg += `💰 Max Price: $${c.max_price.toLocaleString()}\n`;
            msg += `📈 Min Profit: $${c.min_profit.toLocaleString()}\n\n`;
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

        await ctx.reply(`✅ *Added to CRM as Deal #${dealId}*\n📍 ${lead.address}`, { parse_mode: "Markdown" });
        await promptOutreachApproval(bot, dealId);
    });

    log("[leads] Lead alert handlers registered.");
}
