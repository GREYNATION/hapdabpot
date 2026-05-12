import { Telegraf } from 'telegraf';
import db from '../hermes_db.js';
import dotenv from 'dotenv';

dotenv.config();

// Replace 'YOUR_BOT_TOKEN' with the one from @BotFather
// Best Practice: Use process.env.TELEGRAM_BOT_TOKEN
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');
const MY_CHAT_ID = process.env.OWNER_CHAT_ID || ''; // Your personal Telegram ID

/**
 * Sends a real-time alert for a newly detected hot lead
 */
export const sendTelegramAlert = async (lead: any) => {
    const message = `
🔥 *HOT DEAL DETECTED* 🔥

📍 *Address:* ${lead.address}
💰 *MAO:* $${lead.mao ? lead.mao.toLocaleString() : 'N/A'}
📈 *Score:* ${lead.score}/100
🏚 *Type:* ${lead.distress_type}

👤 *Owner:* ${lead.owner || 'Unknown'}

🎯 [Open in Obsidian](obsidian://open?vault=gravity-claw&file=01_Hot_Leads/${encodeURIComponent(lead.address)})

*Reply with "Call" to get the script.*
`;

    try {
        await bot.telegram.sendMessage(MY_CHAT_ID, message, { parse_mode: 'Markdown' });
    } catch (err: any) {
        console.error(`[hermes-telegram] Failed to send alert: ${err.message}`);
    }
};

// Start the Bot Commands
bot.start((ctx) => ctx.reply('Hermes Acquisition Engine Online. Waiting for leads...'));

bot.command('leads', (ctx) => {
    try {
        const topLeads = db.prepare("SELECT address, score FROM leads WHERE status = 'NEW' ORDER BY score DESC LIMIT 5").all() as any[];
        
        if (topLeads.length === 0) {
            return ctx.reply("📋 No new leads found in the Hermes database yet.");
        }

        let msg = "📋 *TOP NEW LEADS:*\n";
        topLeads.forEach(l => msg += `- ${l.address} (Score: ${l.score})\n`);
        ctx.reply(msg, { parse_mode: 'Markdown' });
    } catch (err: any) {
        ctx.reply(`❌ Database Error: ${err.message}`);
    }
});

// Launch logic (only if run directly to avoid conflict with main index.ts)
if (import.meta.url.includes(process.argv[1])) {
    console.log("🚀 Hermes Telegram Engine Launching...");
    bot.launch().catch(err => console.error("Failed to launch Hermes bot:", err));
}

export default bot;
