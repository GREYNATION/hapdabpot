import { Telegraf } from "telegraf";
import { CrmManager } from "../core/crm.js";
import { db } from "../core/memory.js";
import { promptOutreachApproval } from "../services/outreachService.js";

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface ScrapedLead {
    address: string;
    city: string;
    state: string;
    zip: string;
    price: number;
    bedrooms: number;
    bathrooms: number;
    sqft: number;
    daysOnMarket: number;
    estimatedArv: number;
    estimatedRepairs: number;
    mao: number;
    potentialProfit: number;
    source: string;
    url: string;
    motivationSignals: string[];
}

// â”€â”€â”€ Main Scraper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function startLeadAlerts(bot: Telegraf) {
    const OWNER_CHAT_ID = Number(process.env.OWNER_CHAT_ID!);
    const SCAN_HOUR = Number(process.env.LEAD_SCAN_HOUR || 6); // 6 AM default

    console.log(`[leads] Lead alert scan scheduled for ${SCAN_HOUR}:00 AM daily`);

    // Run once on startup (after 30s delay so bot is fully ready)
    setTimeout(async () => {
        console.log("[leads] Running startup lead scan...");
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

// â”€â”€â”€ Core Scan Logic â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function runLeadScan(bot: Telegraf, chatId: number, isStartup: boolean) {
    console.log("[leads] Starting lead scan...");

    const criteria = db.prepare(
        "SELECT * FROM lead_search_criteria WHERE active = 1"
    ).all() as any[];

    if (criteria.length === 0) {
        console.log("[leads] No active search criteria found.");
        return;
    }

    const allLeads: ScrapedLead[] = [];

    for (const criterion of criteria) {
        const leads = await scrapeLeadsForCriteria(criterion);
        allLeads.push(...leads);
    }

    if (allLeads.length === 0) {
        if (!isStartup) {
            await bot.telegram.sendMessage(
                chatId,
                `ðŸ” *Lead Scan Complete*\n\nNo new qualifying leads found today.\nMarkets checked: ${criteria.map(c => c.label).join(", ")}`,
                { parse_mode: "Markdown" }
            );
        }
        return;
    }

    // Sort by potential profit descending
    const sorted = allLeads.sort((a, b) => b.potentialProfit - a.potentialProfit);

    // Save to DB and alert for each
    for (const lead of sorted) {
        const alreadyExists = db.prepare(
            "SELECT id FROM scraped_leads WHERE address = ? AND created_at > date('now', '-7 days')"
        ).get(lead.address);

        if (alreadyExists) continue;

        // Save to scraped_leads
        db.prepare(`
            INSERT INTO scraped_leads 
            (address, source, price, estimated_arv, estimated_repairs, mao, potential_profit, days_on_market, motivation_signals, url, alerted)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
        `).run(
            lead.address,
            lead.source,
            lead.price,
            lead.estimatedArv,
            lead.estimatedRepairs,
            lead.mao,
            lead.potentialProfit,
            lead.daysOnMarket,
            JSON.stringify(lead.motivationSignals),
            lead.url
        );
    }

    // Send summary alert
    await sendLeadAlertSummary(bot, chatId, sorted);
}

// â”€â”€â”€ Brave Search Scraper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function scrapeLeadsForCriteria(criterion: any): Promise<ScrapedLead[]> {
    const leads: ScrapedLead[] = [];

    try {
        const queries = buildSearchQueries(criterion);

        for (const query of queries) {
            const results = await searchBrave(query);
            const parsed = parseSearchResults(results, criterion);
            leads.push(...parsed);
        }
    } catch (err: any) {
        console.error(`[leads] Scrape failed for ${criterion.label}:`, err.message);
    }

    return leads;
}

function buildSearchQueries(criterion: any): string[] {
    const location = criterion.city + " " + criterion.state;
    return [
        `motivated seller ${location} "as-is" price reduced site:zillow.com OR site:realtor.com`,
        `"price reduced" "distressed" "${location}" wholesale real estate`,
        `"${criterion.city}" foreclosure "bank owned" REO property for sale`,
        `"${criterion.city}" "probate" OR "estate sale" house for sale`,
        `cash buyer needed "${criterion.city}" assignment contract`,
    ];
}

async function searchBrave(query: string): Promise<any[]> {
    const BRAVE_API_KEY = process.env.BRAVE_API_KEY;
    if (!BRAVE_API_KEY) {
        console.warn("[leads] BRAVE_API_KEY not set, skipping search");
        return [];
    }

    const response = await fetch(
        `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=10&freshness=pw`,
        {
            headers: {
                "Accept": "application/json",
                "Accept-Encoding": "gzip",
                "X-Subscription-Token": BRAVE_API_KEY,
            },
        }
    );

    if (!response.ok) return [];

    const data = await response.json() as any;
    return data.web?.results || [];
}

function parseSearchResults(results: any[], criterion: any): ScrapedLead[] {
    const leads: ScrapedLead[] = [];

    for (const result of results) {
        const text = `${result.title} ${result.description}`.toLowerCase();

        // Extract price if visible
        const priceMatch = text.match(/\$([0-9,]+)k?/);
        if (!priceMatch) continue;

        let price = parseFloat(priceMatch[1].replace(/,/g, ""));
        if (text.includes("k") && price < 10000) price *= 1000;

        // Skip if price out of range
        if (price > criterion.max_price || price < 10000) continue;

        // Detect motivation signals
        const motivationSignals: string[] = [];
        if (text.includes("price reduced")) motivationSignals.push("Price Reduced");
        if (text.includes("motivated")) motivationSignals.push("Motivated Seller");
        if (text.includes("as-is") || text.includes("as is")) motivationSignals.push("As-Is");
        if (text.includes("foreclosure") || text.includes("bank owned")) motivationSignals.push("Foreclosure");
        if (text.includes("probate") || text.includes("estate")) motivationSignals.push("Probate/Estate");
        if (text.includes("vacant")) motivationSignals.push("Vacant");
        if (text.includes("cash")) motivationSignals.push("Cash Only");

        if (motivationSignals.length === 0) continue; // Only motivated sellers

        // Estimate ARV (conservative: 130% of asking for distressed)
        const estimatedArv = Math.round(price * 1.35);
        const estimatedRepairs = Math.round(price * 0.20); // 20% of price
        const mao = Math.round((estimatedArv * 0.70) - estimatedRepairs);
        const potentialProfit = Math.round(mao - (price * 0.85)); // assume 15% negotiation room

        if (potentialProfit < criterion.min_profit) continue;

        // Extract address from title if possible
        const addressMatch = result.title.match(/(\d+\s+[\w\s]+(?:St|Ave|Rd|Dr|Blvd|Ln|Way|Ct|Pl)[\w\s]*)/i);
        const address = addressMatch
            ? addressMatch[1].trim()
            : `${criterion.city} Lead via ${new URL(result.url || "https://unknown.com").hostname}`;

        leads.push({
            address: `${address}, ${criterion.city}, ${criterion.state}`,
            city: criterion.city,
            state: criterion.state,
            zip: criterion.zip || "",
            price,
            bedrooms: 0,
            bathrooms: 0,
            sqft: 0,
            daysOnMarket: 0,
            estimatedArv,
            estimatedRepairs,
            mao,
            potentialProfit,
            source: new URL(result.url || "https://unknown.com").hostname,
            url: result.url || "",
            motivationSignals,
        });
    }

    return leads;
}

async function sendLeadAlertSummary(bot: Telegraf, chatId: number, leads: ScrapedLead[]) {
    const top5 = leads.slice(0, 5);

    let msg = `ðŸš¨ *${leads.length} New Lead${leads.length > 1 ? "s" : ""} Found!* \n\n`;
    msg += `_Showing top ${top5.length} by profit potential:_ \n\n`;

    for (let i = 0; i < top5.length; i++) {
        const lead = top5[i];
        msg += `*${i + 1}. ${lead.address}*\n`;
        msg += `ðŸ’° Ask: $${lead.price.toLocaleString()} â†’ MAO: $${lead.mao.toLocaleString()}\n`;
        msg += `ðŸ“ˆ Est. Profit: *$${lead.potentialProfit.toLocaleString()}*\n`;
        msg += `ðŸ”¥ Signals: ${lead.motivationSignals.join(", ")}\n`;
        if (lead.url) msg += `ðŸ”— [View Listing](${lead.url})\n`;
        msg += "\n";
    }

    msg += `_Reply with /addlead <number> to add to CRM_ \n`;
    msg += `_Reply /analyze <address> for full MAO breakdown_`;

    await bot.telegram.sendMessage(chatId, msg, {
        parse_mode: "Markdown",
        link_preview_options: { is_disabled: true },
    });

    // Store leads in memory for /addlead command
    db.prepare("DELETE FROM scraped_leads WHERE alerted = 0").run();
    for (const lead of top5) {
        db.prepare(`
            UPDATE scraped_leads SET alerted = 1 
            WHERE address = ? 
            ORDER BY created_at DESC LIMIT 1
        `).run(lead.address);
    }
}

export function registerLeadAlertHandlers(bot: Telegraf) {
    const OWNER_CHAT_ID = Number(process.env.OWNER_CHAT_ID!);

    // /scan â€” trigger manual lead scan
    bot.command("scan", async (ctx) => {
        if (ctx.chat.id !== OWNER_CHAT_ID) return;
        await ctx.reply("ðŸ” Running lead scan now... I'll alert you when I find deals.");
        await runLeadScan(bot, OWNER_CHAT_ID, false);
    });

    // /criteria â€” show active search criteria
    bot.command("criteria", async (ctx) => {
        if (ctx.chat.id !== OWNER_CHAT_ID) return;
        const criteria = db.prepare("SELECT * FROM lead_search_criteria WHERE active = 1").all() as any[];

        let msg = `ðŸ“ *Active Search Criteria*\n\n`;
        criteria.forEach((c, i) => {
            msg += `*${i + 1}. ${c.label}*\n`;
            msg += `ðŸ“ ${c.city}, ${c.state}\n`;
            msg += `ðŸ’µ Max Price: $${c.max_price.toLocaleString()}\n`;
            msg += `ðŸ“ˆ Min Profit: $${c.min_profit.toLocaleString()}\n`;
            msg += `ðŸ“… Max DOM: ${c.max_dom} days\n\n`;
        });
        msg += `_To add markets: /addmarket City State MaxPrice MinProfit_`;

        await ctx.reply(msg, { parse_mode: "Markdown" });
    });

    bot.command("addmarket", async (ctx) => {
        if (ctx.chat.id !== OWNER_CHAT_ID) return;
        const parts = ctx.message.text.split(" ").slice(1);

        if (parts.length < 4) {
            return ctx.reply("Usage: /addmarket <City> <State> <MaxPrice> <MinProfit>\nExample: /addmarket Trenton NJ 120000 12000");
        }

        const [city, state, maxPrice, minProfit] = parts;
        db.prepare(`
            INSERT INTO lead_search_criteria (label, city, state, max_price, min_profit)
            VALUES (?, ?, ?, ?, ?)
        `).run(`${city}, ${state}`, city, state, parseFloat(maxPrice), parseFloat(minProfit));

        await ctx.reply(`âœ… Added ${city}, ${state} to lead scan targets.\nNext scan at ${process.env.LEAD_SCAN_HOUR || 6}:00 AM or run /scan now.`);
    });

    bot.command("addlead", async (ctx) => {
        if (ctx.chat.id !== OWNER_CHAT_ID) return;
        const parts = ctx.message.text.split(" ").slice(1);
        const idx = parseInt(parts[0]) - 1;

        const recentLeads = db.prepare(
            "SELECT * FROM scraped_leads WHERE alerted = 1 ORDER BY created_at DESC LIMIT 5"
        ).all() as any[];

        if (!recentLeads[idx]) {
            return ctx.reply("Lead not found. Run /scan first to get fresh leads.");
        }

        const lead = recentLeads[idx];
        const dealId = (CrmManager as any).addDeal({
            address: lead.address,
            arv: lead.estimated_arv,
            repair_estimate: lead.estimated_repairs,
            profit: lead.potential_profit,
            status: "lead",
        });

        db.prepare("UPDATE scraped_leads SET deal_id = ? WHERE id = ?").run(dealId, lead.id);

        await ctx.reply(
            `âœ… *Added to CRM!*\n\nðŸ“ ${lead.address}\nDeal #${dealId}\nMAO: $${lead.mao.toLocaleString()}\n\nRun /analyze ${lead.address} for full breakdown.`,
            { parse_mode: "Markdown" }
        );

        // EXTRA: Trigger Outreach Approval Prompt
        await promptOutreachApproval(bot, dealId);
    });

    console.log("[leads] Lead alert handlers registered.");
}

