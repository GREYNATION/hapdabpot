import { Telegraf } from 'telegraf';
import db from '../hermes_db.js';
import { Lead } from '../src/types/lead.js';
import { log } from '../src/core/config.js';

// Use environment variables for security
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || 'YOUR_BOT_TOKEN';
const MY_CHAT_ID = process.env.OWNER_CHAT_ID || 'YOUR_CHAT_ID';

const bot = new Telegraf(BOT_TOKEN);

/**
 * Sends a real-time alert for a newly detected hot lead
 */
export const sendTelegramAlert = async (bot: Telegraf, lead: Lead) => {
    const message = `
🔥 *HERMES HOT DEAL* 🔥

📍 *Address:* ${lead.address}
💰 *MAO:* $${(lead.maxOffer || 0).toLocaleString()}
📈 *Score:* ${lead.dealScore || 0}/100
🏚 *Signals:* ${lead.distressSignals?.join(", ") || "None detected"}

👤 *Owner:* ${lead.owner || "Unknown"}

🎯 [Open in Obsidian](obsidian://open?vault=gravity-claw&file=01_Hot_Leads/${encodeURIComponent(lead.address)})

*Reply with "Call" to get the script.*
`;

    try {
        await bot.telegram.sendMessage(MY_CHAT_ID, message, { parse_mode: 'Markdown' });
    } catch (err: any) {
        log(`[hermes-bot] Failed to send alert: ${err.message}`, "error");
    }
};

/**
 * Hermes Specific Bot Handlers
 */
export function registerHermesHandlers(targetBot: Telegraf) {
    const OWNER_CHAT_ID = Number(process.env.OWNER_CHAT_ID!);

    targetBot.command('leads', (ctx) => {
        if (ctx.chat.id !== OWNER_CHAT_ID) return;
        try {
            const topLeads = db.prepare("SELECT address, score FROM leads WHERE status = 'NEW' ORDER BY score DESC LIMIT 5").all() as any[];
            
            if (topLeads.length === 0) {
                return ctx.reply("📋 No new leads found in the Hermes database yet.");
            }

            let msg = "📋 *HERMES TOP LEADS:*\n";
            topLeads.forEach(l => msg += `- ${l.address} (Score: ${l.score})\n`);
            ctx.reply(msg, { parse_mode: 'Markdown' });
        } catch (err: any) {
            ctx.reply(`❌ Database Error: ${err.message}`);
        }
    });

    // Renamed to /hscan to prevent conflict with core /scan
    targetBot.command('hscan', async (ctx) => {
        if (ctx.chat.id !== OWNER_CHAT_ID) return;
        const target = "Cleveland";
        ctx.reply(`🔎 *Hermes is initiating a Money Pull for ${target}...*\nThis stealth mission may take 60-90 seconds. Stay tuned.`);
        
        try {
            const { findMotivatedSellers } = await import("../src/services/universalLeadScraper.js");
            // Focus on Cleveland Gold Mine
            const leads = await findMotivatedSellers("OH", target, ['44102','44105','44108'], false);
            
            if (leads.length === 0) {
                return ctx.reply(`📋 Mission complete for ${target}. No new distress signals detected.`);
            }

            ctx.reply(`✅ *Target Secured:* Found ${leads.length} new leads in ${target}. Check Obsidian for full briefings.`);
        } catch (err: any) {
            ctx.reply(`❌ *Mission Failed:* ${err.message}`);
        }
    });

    // Handle "Call" reply logic if needed
    targetBot.hears(/call/i, (ctx) => {
        if (ctx.chat.id !== OWNER_CHAT_ID) return;
        ctx.reply("📞 *Cold Call Script:* 'Hi, I'm calling about the property at...' [Full script in Strategy notes]");
    });
}

// If this file is run directly, launch the bot
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
    bot.start((ctx) => ctx.reply('Hermes Acquisition Engine Online. Waiting for leads...'));
    registerHermesHandlers(bot);
    
    console.log("🚀 Hermes Telegram Bot Launching...");
    bot.launch().catch(err => console.error("Failed to launch Hermes bot:", err));
}

export default bot;
