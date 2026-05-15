import { Telegraf, Context } from 'telegraf';
import Database from 'better-sqlite3';
import { getStuyzaLeads, getStuyzaLeadStats, updateStuyzaLeadStatus, getStuyzaLeadById } from '../db/leads.js';
import { log } from '../core/config.js';
import { sanitizeHTML } from '../core/telegramUtils.js';

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

    const text = ctx.message.text.replace('/leads', '').trim();

    if (text.length > 3) {
      // If there's a query, treat it as a finding request
      await ctx.reply("🏠 <b>Ops Intelligence Initialized.</b>\nScanning for motivated sellers matching your criteria...", { parse_mode: 'HTML' });
      try {
        const { realEstateAgent } = await import('../agents/realEstateAgent.js');
        const result = await realEstateAgent.handle(text);
        
        if (result.length <= 4096) {
            await ctx.reply(result, { parse_mode: 'HTML' }).catch(() => ctx.reply(result));
        } else {
            const chunks = result.match(/[\s\S]{1,4000}/g) ?? [result];
            for (const chunk of chunks) await ctx.reply(chunk, { parse_mode: 'HTML' }).catch(() => { });
        }
        return;
      } catch (err: any) {
        log(`[bot] Error in autonomous /leads: ${err.message}`, 'error');
        return ctx.reply(`❌ <b>Lead Discovery Failed</b>: <code>${sanitizeHTML(err.message)}</code>`, { parse_mode: 'HTML' });
      }
    }

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
          return `${statusEmoji} <b>/lead_${l.id}</b> ${sanitizeHTML(l.fname)} ${sanitizeHTML(l.lname || '')} — ${sanitizeHTML(l.biz_type || 'Unknown')}\n   ${sanitizeHTML(l.email)} | ${sanitizeHTML(l.service || 'N/A')} | ${date}`;
        }).join('\n\n');

        await ctx.reply(`<b>STUYZA LEADS DASHBOARD</b>\n\n${statLine}\n\n${leadList}\n\n<i>Use /lead_&lt;id&gt; to view full details</i>`, { parse_mode: 'HTML' });
    } catch (err: any) {
        log(`[bot] Error in /leads: ${err.message}`, 'error');
        ctx.reply("❌ <b>Error fetching leads.</b>", { parse_mode: 'HTML' });
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
          `📋 <b>LEAD #${lead.id}</b>`,
          ``,
          `👤 <b>${sanitizeHTML(lead.fname)} ${sanitizeHTML(lead.lname || '')}</b>`,
          `📧 ${sanitizeHTML(lead.email)}`,
          `📱 ${sanitizeHTML(lead.phone || 'not provided')}`,
          `🏢 Business: ${sanitizeHTML(lead.biz_type || 'N/A')}`,
          `🤖 Service: ${sanitizeHTML(lead.service || 'N/A')}`,
          lead.notes ? `📝 ${sanitizeHTML(lead.notes)}` : null,
          `📌 Status: <b>${sanitizeHTML(lead.status)}</b>`,
          `🕐 ${new Date(lead.created_at).toLocaleString('en-US')}`,
          ``,
          `<b>Actions:</b>`,
          `/book_${lead.id} — Mark as Booked`,
          `/close_${lead.id} — Mark as Closed`,
          `/drop_${lead.id} — Mark as Dropped`
        ].filter(Boolean).join('\n');

        ctx.reply(msg, { parse_mode: 'HTML' });
    } catch (err: any) {
        log(`[bot] Error in /lead_${id}: ${err.message}`, 'error');
        ctx.reply("❌ <b>Error fetching lead details.</b>", { parse_mode: 'HTML' });
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
          ctx.reply(`✅ Lead #${id} marked as <b>${status.toUpperCase()}</b>`, { parse_mode: 'HTML' });
      } catch (err: any) {
          log(`[bot] Error updating lead #${id}: ${err.message}`, 'error');
          ctx.reply("❌ <b>Failed to update lead status.</b>", { parse_mode: 'HTML' });
      }
    });
  }

  // /leadstats — quick summary
  bot.command('leadstats', async (ctx) => {
    if (!isOwner(ctx)) return;
    
    try {
        const s = getStuyzaLeadStats(db);
        const convRate = s.total > 0 ? (((s.booked || 0) / s.total) * 100).toFixed(1) : '0';
        ctx.reply(
          `<b>STUYZA PIPELINE STATS</b>\n\n` +
          `🔴 New: ${s.new_leads}\n` +
          `🟡 Booked: ${s.booked}\n` +
          `🟢 Closed: ${s.closed}\n` +
          `📊 Total: ${s.total}\n` +
          `📈 Book rate: ${convRate}%`,
          { parse_mode: 'HTML' }
        );
    } catch (err: any) {
        log(`[bot] Error in /leadstats: ${err.message}`, 'error');
        ctx.reply("❌ <b>Error calculating stats.</b>", { parse_mode: 'HTML' });
    }
  });
}
