import { Telegraf, Context } from 'telegraf';
import Database from 'better-sqlite3';
import { getStuyzaLeads, getStuyzaLeadStats, updateStuyzaLeadStatus, getStuyzaLeadById } from '../db/leads.js';
import { log } from '../core/config.js';

export interface StuyzaLead {
  id: number;
  fname: string;
  lname?: string;
  email: string;
  phone?: string;
  biz_type?: string;
  service?: string;
  notes?: string;
  status: string;
  created_at: string;
}

export function registerLeadCommands(bot: Telegraf, db: Database.Database) {
  const OWNER_CHAT_ID = process.env.OWNER_CHAT_ID;

  function isOwner(ctx: Context): boolean {
    return String(ctx.from?.id) === String(OWNER_CHAT_ID);
  }

  // /leads — show last 10 leads
  bot.command('leads', async (ctx) => {
    if (!isOwner(ctx)) return;

    try {
        const stats = getStuyzaLeadStats(db);
        const leads = getStuyzaLeads(db, 10) as StuyzaLead[];

        if (!leads.length) {
          return ctx.reply('No leads yet. Get that landing page live! 🚀');
        }

        const statLine = `📊 Total: ${stats.total} | 🆕 New: ${stats.new_leads} | 📅 Booked: ${stats.booked} | ✅ Closed: ${stats.closed}`;

        const leadList = (leads as any[]).map((l: any) => {
          const date = new Date(l.created_at).toLocaleDateString('en-US');
          const statusEmoji = l.status === 'new' ? '🔴' : l.status === 'booked' ? '🟡' : '🟢';
          return `${statusEmoji} */lead_${l.id}* ${l.fname} ${l.lname || ''} — ${l.biz_type || 'Unknown'}\n   ${l.email} | ${l.service || 'N/A'} | ${date}`;
        }).join('\n\n');

        await ctx.replyWithMarkdown(`*STUYZA LEADS DASHBOARD*\n\n${statLine}\n\n${leadList}\n\n_Use /lead_<id> to view full details_`);
    } catch (err: any) {
        log(`[bot] Error in /leads: ${err.message}`, 'error');
        ctx.reply("❌ Error fetching leads.");
    }
  });

  // /lead_<id> — view single lead details
  bot.hears(/^\/lead_(\d+)$/, async (ctx) => {
    if (!isOwner(ctx)) return;
    const id = parseInt((ctx.match as RegExpMatchArray)[1]);
    
    try {
        const lead = getStuyzaLeadById(db, id) as StuyzaLead;

        if (!lead) return ctx.reply(`Lead #${id} not found.`);

        const msg = [
          `📋 *LEAD #${lead.id}*`,
          ``,
          `👤 **${lead.fname} ${lead.lname || ''}**`,
          `📧 ${lead.email}`,
          `📱 ${lead.phone || 'not provided'}`,
          `🏢 Business: ${lead.biz_type || 'N/A'}`,
          `🤖 Service: ${lead.service || 'N/A'}`,
          lead.notes ? `📝 ${lead.notes}` : null,
          `📌 Status: *${lead.status}*`,
          `🕐 ${new Date(lead.created_at).toLocaleString('en-US')}`,
          ``,
          `**Actions:**`,
          `/book_${lead.id} — Mark as Booked`,
          `/close_${lead.id} — Mark as Closed`,
          `/drop_${lead.id} — Mark as Dropped`
        ].filter(Boolean).join('\n');

        ctx.replyWithMarkdown(msg);
    } catch (err: any) {
        log(`[bot] Error in /lead_${id}: ${err.message}`, 'error');
        ctx.reply("❌ Error fetching lead details.");
    }
  });

  // Status update commands
  const statusActions = [
      { action: 'book', status: 'booked' },
      { action: 'close', status: 'closed' },
      { action: 'drop', status: 'dropped' }
  ];

  for (const { action, status } of statusActions) {
    bot.hears(new RegExp(`^\\/${action}_(\\d+)$`), async (ctx) => {
      if (!isOwner(ctx)) return;
      const id = parseInt((ctx.match as RegExpMatchArray)[1]);
      
      try {
          updateStuyzaLeadStatus(db, id, status);
          ctx.reply(`✅ Lead #${id} marked as *${status.toUpperCase()}*`, { parse_mode: 'Markdown' });
      } catch (err: any) {
          log(`[bot] Error updating lead #${id}: ${err.message}`, 'error');
          ctx.reply("❌ Failed to update lead status.");
      }
    });
  }

  // /leadstats — quick summary
  bot.command('leadstats', async (ctx) => {
    if (!isOwner(ctx)) return;
    
    try {
        const s = getStuyzaLeadStats(db);
        const convRate = s.total > 0 ? (((s.booked || 0) / s.total) * 100).toFixed(1) : '0';
        ctx.replyWithMarkdown(
          `*STUYZA PIPELINE STATS*\n\n` +
          `🔴 New: ${s.new_leads}\n` +
          `🟡 Booked: ${s.booked}\n` +
          `🟢 Closed: ${s.closed}\n` +
          `📊 Total: ${s.total}\n` +
          `📈 Book rate: ${convRate}%`
        );
    } catch (err: any) {
        log(`[bot] Error in /leadstats: ${err.message}`, 'error');
        ctx.reply("❌ Error calculating stats.");
    }
  });
}
