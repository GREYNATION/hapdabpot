// webServer.ts — build: 2026-04-05T16:30Z (force redeploy)
import express, { Request, Response } from 'express';
import { handleStripeWebhook } from './bot/invoiceHandlers.js';
import { log } from './core/config.js';
import { CrmManager } from './core/crm.js';
import { SupabaseCrm } from './core/supabaseCrm.js';


const app = express();
const PORT = parseInt(process.env.PORT || '8080', 10);


// FORCED TIKTOK VERIFICATION ROUTE — must be first, before any middleware
app.get('/terms/tiktokoM7VyFDCYlZw3544ZTa2qHS1JJP2e7xK.txt', (req: Request, res: Response) => {
  res.header('Content-Type', 'text/plain');
  res.send('tiktok-developers-site-verification=oM7VyFDCYlZw3544ZTa2qHS1JJP2e7xK');
});

// TikTok Domain Verification — .well-known format
app.get('/.well-known/tiktok-developers-site-verification=CoXgVUDwGj2vZPuC0jcBXnGzEoK6U7S6', (req: Request, res: Response) => {
  res.type('text/plain');
  res.send('tiktok-developers-site-verification=CoXgVUDwGj2vZPuC0jcBXnGzEoK6U7S6');
});

app.get('/.well-known/tiktok-developers-site-verification=6LvBP52Do7yabEUnreGHiI2z0STbzzVg', (req: Request, res: Response) => {
  res.type('text/plain');
  res.send('tiktok-developers-site-verification=6LvBP52Do7yabEUnreGHiI2z0STbzzVg');
});



app.get('/tiktoktb0A46sOsuyilGqaJlvS0lxVQSxCxUVX.txt', (req: Request, res: Response) => {
  res.type('text/plain').send('tiktok-developers-site-verification=tb0A46sOsuyilGqaJlvS0lxVQSxCxUVX');
});

app.get('/tiktoktb0A46sOsuyilGgaJIvS0lxVQSxCxUVX.txt', (req: Request, res: Response) => {
  res.type('text/plain').send('tiktok-developers-site-verification=tb0A46sOsuyilGgaJIvS0lxVQSxCxUVX');
});


app.get('/privacy/tiktokoM7VyFDCYlZw3544ZTa2qHS1JJP2e7xK.txt', (req: Request, res: Response) => {
  res.type('text/plain');
  res.send('tiktok-developers-site-verification=oM7VyFDCYlZw3544ZTa2qHS1JJP2e7xK');
});

app.get('/privacy/tiktokqN2tmKapR4HunWyltzyn4ylBvJMCUs9y.txt', (req: Request, res: Response) => {
  res.type('text/plain').send('tiktok-developers-site-verification=qN2tmKapR4HunWyltzyn4ylBvJMCUs9y');
});


// Diagnostic: confirms Railway is serving the latest build
app.get('/test-me', (req: Request, res: Response) => {
  res.send('The server is updated! Build: ' + new Date().toISOString());
});

// Stripe webhook endpoint needs raw body
app.post('/webhook/stripe', express.raw({ type: 'application/json' }), async (req: Request, res: Response) => {
  try {
    const signature = req.headers['stripe-signature'] as string;

    if (!signature) {
      log('[WebServer] Missing Stripe signature', 'error');
      return res.status(400).json({ error: 'Missing signature' });
    }

    const body = req.body.toString();
    const success = await handleStripeWebhook(body, signature);

    if (success) {
      log('[WebServer] Stripe webhook processed successfully');
      res.json({ received: true });
    } else {
      log('[WebServer] Stripe webhook processing failed', 'error');
      res.status(400).json({ error: 'Webhook processing failed' });
    }
  } catch (error: any) {
    log(`[WebServer] Stripe webhook error: ${error.message}`, 'error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Twilio SMS Webhook
app.post('/webhook/twilio', express.urlencoded({ extended: false }), async (req: Request, res: Response) => {
  const fromPhone = req.body.From;
  const messageBody = req.body.Body?.toLowerCase() || "";

  log(`[Twilio] Received SMS from ${fromPhone}: ${messageBody}`);

  if (messageBody.includes("yes")) {
    try {
      // 1. Update SQLite
      const deal = CrmManager.findLatestDealByPhone(fromPhone);
      if (deal) {
        CrmManager.updateDeal(deal.id, { status: "negotiating" });
        log(`[Twilio] Deal #${deal.id} moved to "negotiating" in local CRM.`);
      }

      // 2. Update Supabase
      await SupabaseCrm.updateDealStatusByPhone(fromPhone, "negotiating");

      log(`[Twilio] Outreach success! Automation moved lead to "negotiating".`);
    } catch (err: any) {
      log(`[Twilio] Failed to auto-update deal stage: ${err.message}`, "error");
    }
  }

  // Twilio requires a TwiML response
  res.type('text/xml').send('<Response></Response>');
});

app.get("/terms", (req: Request, res: Response) => {
  res.send('tiktok-developers-site-verification=6LvBP52Do7yabEUnreGHiI2z0STbzzVg');
});

app.get("/api/auth/callback/tiktok", (req: Request, res: Response) => {
  res.send('Login Successful! You can now return to the bot.');
});

app.get("/privacy", (req: Request, res: Response) => {
  res.send("<h1>Privacy Policy</h1><p>HAPDA_BOT does not share your data.</p>");
});

app.get("/tiktokIfxgUQYQCixpunReOoWQpEWQnqhTD32r.txt", (req: Request, res: Response) => {
  res.send("tiktok-developers-site-verification=IFxgUOYQCixpunRe0oWOpEW0nqhTD32r");
});


export function startWebServer() {
  const server = app.listen(PORT, '0.0.0.0', () => {
    log(`[WebServer] Started on port ${PORT} (0.0.0.0)`);
    log(`[WebServer] Stripe webhook endpoint: POST /webhook/stripe`);
    log(`[WebServer] Health check: GET /health`);
  });

  // Also add a basic root for general health
  app.get('/', (req, res) => res.send('Gravity Claw Specialist Agent is Online.'));

  return server;
}
