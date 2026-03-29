import { Telegraf, Context, Markup } from 'telegraf';
import twilio from 'twilio';
import nodemailer from 'nodemailer';
import { db } from '../core/memory.js';
import { config, log } from '../core/config.js';
import { CrmManager } from '../core/crm.js';

// Outreach Steps config
const OUTREACH_STEPS = [
    { day: 0, type: 'sms', template: "Hi {name}, I'm Hap from GreyNation. I saw your property at {address} and was wondering if you're interested in a cash offer? Let me know!" },
    { day: 3, type: 'sms', template: "Hey {name}, just following up on my previous text about {address}. Still interested in chatting?" },
    { day: 7, type: 'sms', template: "Last try! {name}, if you're looking to sell {address} quickly, I'm here. Have a great day!" }
];

export function startOutreachCron(bot: Telegraf) {
    log("[outreach] Starting outreach follow-up cron (daily check)...");
    
    // Check every hour for follow-ups due
    setInterval(async () => {
        const now = new Date();
        if (now.getMinutes() !== 0) return; // Only run once an hour

        try {
            await processOutreachSteps(bot);
        } catch (err: any) {
            log(`[outreach] Cron error: ${err.message}`, 'error');
        }
    }, 60 * 1000);
}

async function processOutreachSteps(bot: Telegraf) {
    const dueSequences = db.prepare(`
        SELECT * FROM outreach_sequences 
        WHERE status = 'active' 
        AND next_run_at <= CURRENT_TIMESTAMP
    `).all() as any[];

    for (const seq of dueSequences) {
        const deal = CrmManager.getDeal(seq.deal_id);
        if (!deal) {
            stopSequence(seq.id);
            continue;
        }

        const nextStepIdx = seq.current_step + 1;
        if (nextStepIdx >= OUTREACH_STEPS.length) {
            db.prepare("UPDATE outreach_sequences SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(seq.id);
            continue;
        }

        const step = OUTREACH_STEPS[nextStepIdx];
        const content = formatTemplate(step.template, deal);

        try {
            if (step.type === 'sms') {
                await sendSms(deal.seller_phone!, content, deal.id);
            }
            
            // Schedule next step
            const nextStepInPlan = OUTREACH_STEPS[nextStepIdx + 1];
            const nextRun = nextStepInPlan ? 
                new Date(Date.now() + (nextStepInPlan.day - step.day) * 24 * 60 * 60 * 1000).toISOString() : 
                null;

            db.prepare(`
                UPDATE outreach_sequences 
                SET current_step = ?, next_run_at = ?, updated_at = CURRENT_TIMESTAMP 
                WHERE id = ?
            `).run(nextStepIdx, nextRun, seq.id);

            log(`[outreach] Completed step ${nextStepIdx} for deal #${deal.id}`);
        } catch (err: any) {
            log(`[outreach] Failed step ${nextStepIdx} for deal #${deal.id}: ${err.message}`, 'error');
        }
    }
}

function stopSequence(id: number) {
    db.prepare("UPDATE outreach_sequences SET status = 'stopped', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);
}

function formatTemplate(template: string, deal: any): string {
    return template
        .replace(/{name}/g, deal.seller_name || 'there')
        .replace(/{address}/g, deal.address);
}

export async function sendSms(to: string, body: string, dealId: number) {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_PHONE_NUMBER;

    if (!sid || !token || !from) {
        throw new Error("Twilio credentials missing");
    }

    const client = twilio(sid, token);
    
    try {
        const message = await client.messages.create({ body, from, to });
        log(`[outreach] SMS Sent to ${to}: ${message.sid}`);
        
        db.prepare(`
            INSERT INTO outreach_logs (deal_id, type, content, status)
            VALUES (?, 'sms', ?, 'sent')
        `).run(dealId, body);
        
        return message;
    } catch (err: any) {
        db.prepare(`
            INSERT INTO outreach_logs (deal_id, type, content, status)
            VALUES (?, 'sms', ?, 'failed')
        `).run(dealId, body);
        throw err;
    }
}

export async function sendEmail(to: string, subject: string, body: string, dealId: number) {
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: false,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });

    try {
        await transporter.sendMail({
            from: process.env.SMTP_USER,
            to,
            subject,
            text: body
        });
        
        db.prepare(`
            INSERT INTO outreach_logs (deal_id, type, content, status)
            VALUES (?, 'email', ?, 'sent')
        `).run(dealId, body);
        
        log(`[outreach] Email sent to ${to}`);
    } catch (err: any) {
        db.prepare(`
            INSERT INTO outreach_logs (deal_id, type, content, status)
            VALUES (?, 'email', ?, 'failed')
        `).run(dealId, body);
        throw err;
    }
}

export function registerOutreachHandlers(bot: Telegraf) {
    const ownerId = Number(config.ownerId);

    // Initial Approval Flow
    bot.action(/outreach_approve_(\d+)/, async (ctx) => {
        const dealId = parseInt(ctx.match[1]);
        const deal = (CrmManager as any).getDeal(dealId);
        
        if (!deal || !deal.seller_phone) {
            return ctx.answerCbQuery("âŒ Deal or Phone number not found.");
        }

        try {
            const firstStep = OUTREACH_STEPS[0];
            const content = formatTemplate(firstStep.template, deal);
            
            await sendSms(deal.seller_phone, content, dealId);
            
            // Start sequence
            const nextStep = OUTREACH_STEPS[1];
            const nextRun = new Date(Date.now() + nextStep.day * 24 * 60 * 60 * 1000).toISOString();
            
            db.prepare(`
                INSERT INTO outreach_sequences (deal_id, status, current_step, next_run_at)
                VALUES (?, 'active', 0, ?)
            `).run(dealId, nextRun);

            await ctx.editMessageText(`âœ… Initial SMS sent to ${deal.seller_name}! Sequence started.`);
            await ctx.answerCbQuery();
        } catch (err: any) {
            await ctx.reply(`âŒ SMS failed: ${err.message}`);
            await ctx.answerCbQuery();
        }
    });

    bot.action(/outreach_skip_(\d+)/, async (ctx) => {
        const dealId = ctx.match[1];
        await ctx.editMessageText(`â­ï¸ Outreach skipped for deal #${dealId}.`);
        await ctx.answerCbQuery();
    });

    // Command to check outreach status
    bot.command('outreach_status', async (ctx) => {
        if (ctx.from.id !== ownerId) return;
        
        const active = db.prepare("SELECT * FROM outreach_sequences WHERE status = 'active'").all() as any[];
        if (active.length === 0) return ctx.reply("No active outreach sequences.");

        let msg = "ðŸ“ **Active Outreach Sequences**\n\n";
        for (const seq of active) {
            const deal = CrmManager.getDeal(seq.deal_id);
            msg += `ðŸ“ ${deal?.address}\n`;
            msg += `Step: ${seq.current_step + 1}/${OUTREACH_STEPS.length}\n`;
            msg += `Next: ${new Date(seq.next_run_at).toLocaleDateString()}\n\n`;
        }
        await ctx.reply(msg, { parse_mode: 'Markdown' });
    });
}

/**
 * Utility to trigger the "Send SMS?" prompt to owner
 */
export async function promptOutreachApproval(bot: Telegraf, dealId: number) {
    const deal = CrmManager.getDeal(dealId);
    if (!deal) return;

    const ownerId = Number(config.ownerId);
    const keyboard = Markup.inlineKeyboard([
        [
            Markup.button.callback("âœ… YES, Send SMS", `outreach_approve_${dealId}`),
            Markup.button.callback("â­ï¸ SKIP", `outreach_skip_${dealId}`)
        ]
    ]);

    await bot.telegram.sendMessage(ownerId, 
        `ðŸ†• **New Potential Lead**\n\n` +
        `ðŸ“ ${deal.address}\n` +
        `ðŸ‘¤ ${deal.seller_name || 'Unknown'}\n` +
        `ðŸ“± ${deal.seller_phone || 'No phone'}\n\n` +
        `Should I start the SMS outreach sequence?`,
        keyboard
    );
}

