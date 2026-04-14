import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import Database from 'better-sqlite3';
import { insertStuyzaLead } from '../db/leads.js';
import { Telegraf } from 'telegraf';
import { log } from '../core/config.js';

export function createLeadsRouter(db: Database.Database, bot: Telegraf) {
  const router = Router();

  // Rate limit: max 5 form submissions per IP per 15 min
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { error: 'Too many submissions. Try again later.' }
  });

  // CORS — allow stuyza.com and localhost dev
  router.use((req, res, next) => {
    const allowed = [
      'https://www.stuyza.com',
      'https://stuyza.com',
      'http://localhost:3000',
      'http://localhost:5500'
    ];
    const origin = req.headers.origin || '';
    if (allowed.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  router.post('/', limiter, async (req: Request, res: Response) => {
    try {
      const { fname, lname, email, phone, biz_type, service, notes } = req.body;

      // Basic validation
      if (!fname || !email) {
        return res.status(400).json({ error: 'Name and email are required.' });
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'Invalid email address.' });
      }

      // Save to DB
      const result = insertStuyzaLead(db, {
        fname, lname, email, phone, biz_type, service, notes,
        source: 'stuyza_landing'
      });

      // Fire Telegram alert — non-blocking, won't crash if it fails
      const OWNER_CHAT_ID = process.env.OWNER_CHAT_ID;
      if (OWNER_CHAT_ID) {
        try {
          const msg = [
            `🔥 *NEW STUYZA LEAD* — #${result.lastInsertRowid}`,
            ``,
            `👤 *${fname} ${lname || ''}*`,
            `📧 ${email}`,
            `📱 ${phone || 'not provided'}`,
            `🏢 ${biz_type || 'not specified'}`,
            `🤖 Interested in: ${service || 'not specified'}`,
            notes ? `📝 Notes: ${notes}` : '',
            ``,
            `⏰ ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })}`,
            ``,
            `Reply /lead_${result.lastInsertRowid} to manage this lead`
          ].filter(Boolean).join('\n');

          await bot.telegram.sendMessage(OWNER_CHAT_ID, msg, {
            parse_mode: 'Markdown'
          });
        } catch (telegramErr) {
          console.error('[TELEGRAM ALERT FAILED]', telegramErr);
        }
      }

      return res.status(200).json({
        success: true,
        message: 'Lead received.',
        id: result.lastInsertRowid
      });

    } catch (err) {
      console.error('[LEADS ROUTE ERROR]', err);
      return res.status(500).json({ error: 'Internal error. Try again.' });
    }
  });

  return router;
}


