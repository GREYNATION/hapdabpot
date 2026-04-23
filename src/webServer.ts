import "./core/init.js";
import 'dotenv/config';
// webServer.ts — build: 2026-04-05T16:30Z (force redeploy)
import express, { Request, Response } from 'express';
import { handleStripeWebhook } from './bot/invoiceHandlers.js';
import { log } from './core/config.js';
import { CrmManager } from './core/crm.js';
import { SupabaseCrm } from './core/supabaseCrm.js';
import { sendTelegram, sendSms, generateContract, triggerAICall } from './services/outreachService.js';
import { classifyLead } from './services/leadFilter.js';
import { generateVoice, uploadAudioAndGetUrl } from './services/voiceService.js';
import { getDb } from './core/memory.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { aiNegotiate } from './core/negotiation/aiCloser.js';
import { DataIngestionService } from './services/dataIngestionService.js';
import { createLeadsRouter } from './routes/leads.js';
import { CouncilOrchestrator } from './core/orchestrator/councilOrchestrator.js';
import cors from 'cors';
import fs from 'fs';
import { WebSocketServer } from 'ws';
import { getSupabase } from './core/supabase.js';
const orchestrator = new CouncilOrchestrator();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('trust proxy', 1);  // trust first proxy (Railway/Render)
app.use(cors());            // allow Phaser Game UI to communicate with this backend
app.use(express.json());     // parse JSON request bodies
app.use(express.urlencoded({ extended: true }));  // parse form data
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


// Health Check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Supabase Config for Frontend
app.get('/api/config', (req: Request, res: Response) => {
  res.json({
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseKey: process.env.SUPABASE_ANON_KEY
  });
});

// ── Council Command Bridge ──────────────────────────────────────────────────
app.post('/api/command', async (req: Request, res: Response) => {
  const { message, chatId } = req.body;
  if (!message) return res.status(400).json({ success: false, error: 'Message required' });

  log(`[Bridge] Council command received: ${message}`);
  
  // Trigger background orchestrator
  const cid = chatId || 0;
  orchestrator.chat(message, cid).then(() => {
    log(`[Bridge] Council command processed successfully.`);
  }).catch(err => {
    log(`[Bridge] Council command failed: ${err.message}`, "error");
  });

  return res.json({ success: true, message: 'Command accepted for processing.' });
});

import { createAgentRouter } from './routes/agent.js';
import gamificationRouter from './web/routes/gamification.js';

// ── Game API Integration (Modularized via Architectual Plan) ───────────────
app.use('/api', createAgentRouter());
app.use('/api/gamification', gamificationRouter);

// api/voice POST is already handled by uploadAudioAndGetUrl in some places, 
// but we need a specific bridge for the dashboard's manual calls
app.post('/api/voice', async (req: Request, res: Response) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ success: false, error: 'Text required' });

  try {
      const voiceData = await generateVoice(text);
      const audioUrl = voiceData ? await uploadAudioAndGetUrl(voiceData) : "";
      return res.json({ success: true, audioUrl });
  } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
  }
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

// Property Data Ingestion Webhook (Apify/Bright Data)
app.post('/api/webhook/property-data', express.json(), async (req: Request, res: Response) => {
  const apiKey = req.headers['x-api-key'];
  
  if (process.env.SCRAPER_API_KEY && apiKey !== process.env.SCRAPER_API_KEY) {
    log('[WebServer] Unauthorized scraper ingestion attempt', 'error');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const result = await DataIngestionService.processExternalProperties(req.body);
    res.json({ 
      success: true, 
      processed: result.count, 
      deals: result.deals 
    });
  } catch (error: any) {
    log(`[WebServer] Ingestion error: ${error.message}`, 'error');
    res.status(500).json({ error: error.message });
  }
});

// Helper function to send telegram on voice hook
const notifyYou = async (msg: string) => {
  await sendTelegram(msg);
};

// ElevenLabs Audio Streamer Route
app.get('/api/voice/audio', async (req: Request, res: Response) => {
  const text = req.query.text as string;
  if (!text) return res.status(400).send("Missing text");

  try {
    const buffer = await generateVoice(text);
    if (!buffer) {
      log(`[WebServer] Audio generation returned null for: ${text.substring(0, 50)}`, 'error');
      return res.status(500).send("Voice generation failed");
    }

    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': buffer.length
    });
    res.send(buffer);
  } catch (err: any) {
    log(`[WebServer] Audio generation failed: ${err.message}`, 'error');
    res.status(500).send("Voice generation failed");
  }
});

// Twilio Active Voice Call Webhook (Initiation)
app.post('/api/voice/surplus', express.urlencoded({ extended: false }), async (req: Request, res: Response) => {
  const dealId = req.query.dealId || req.body.dealId;
  const intro = "Hi there, I'm just calling about a property you used to own. It looks like there might be some funds available to you. Are you the owner?";
  const voiceData = await generateVoice(intro);
  const audioUrl = voiceData ? await uploadAudioAndGetUrl(voiceData) : "";
  
  const twiml = `
<Response>
  <Play>${audioUrl}</Play>
  <Gather input="speech" action="/api/voice/ai?dealId=${dealId}" speechTimeout="auto" />
</Response>
`;
  res.setHeader("Content-Type", "text/xml");
  res.send(twiml);
});

// Twilio Status Callback Webhook
app.post('/api/voice/status', express.urlencoded({ extended: false }), async (req: Request, res: Response) => {
  const { CallStatus } = req.body;
  const dealId = req.query.dealId;
  
  log(`[Twilio Status] Call Status for Deal ${dealId}: ${CallStatus}`);

  if (dealId) {
    let status = 'Dialed';
    if (CallStatus === 'in-progress') status = 'Answered';
    if (CallStatus === 'no-answer') status = 'No Answer';
    if (CallStatus === 'busy') status = 'Busy';
    if (CallStatus === 'failed') status = 'Failed';
    if (CallStatus === 'completed') {
       // Only update to completed if it wasn't already marked interested/not_interested
       const deal = CrmManager.getDeal(Number(dealId));
       if (deal && !['Interested', 'Not interested'].includes(deal.last_call_status || "")) {
         status = 'Completed';
       } else {
         return res.sendStatus(200);
       }
    }

    try {
      getDb().prepare("UPDATE deals SET last_call_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        .run(status, Number(dealId));

      // Mirror Answered status to Supabase Funnel
      if (status === 'Answered') {
        const deal = CrmManager.getDeal(Number(dealId));
        if (deal) await SupabaseCrm.updateDealStage(deal.address, 'Contacted');
      }
    } catch (err: any) {
      log(`[Twilio Status] getDb() Update Failed: ${err.message}`, "error");
    }
  }

  res.sendStatus(200);
});

// Twilio Conversational Loop Webhook
app.post('/api/voice/ai', express.urlencoded({ extended: false }), async (req: Request, res: Response) => {
  const speech = (req.body.SpeechResult || "").toLowerCase();
  log(`[Twilio Voice] Owner said: "${speech}"`);

  const endCall = async (message: string) => {
    const voiceData = await generateVoice(message);
    const audioUrl = voiceData ? await uploadAudioAndGetUrl(voiceData) : "";
    res.setHeader("Content-Type", "text/xml");
    const responseBody = audioUrl ? `<Play>${audioUrl}</Play><Hangup/>` : `<Say>${message}</Say><Hangup/>`;
    return res.send(`<Response>${responseBody}</Response>`);
  };

  // Detect hangup/empty speech to actively drop out
  if (!speech || speech.trim() === "") {
    log(`[Twilio Voice] Empty speech or hangup detection.`);
    return endCall("Let me know if you need anything else. Goodbye.");
  }

  const intent = classifyLead(speech);
  const dealId = req.query.dealId;

  if (intent === "interested" && dealId) {
    getDb().prepare("UPDATE deals SET last_call_status = 'Interested', status = 'interested', updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .run(Number(dealId));
    
    // Mirror to Supabase Funnel
    const deal = CrmManager.getDeal(Number(dealId));
    if (deal) await SupabaseCrm.updateDealStage(deal.address, 'Interested');
  }

  if (intent === "not_interested") {
    log(`[Twilio Voice] Opt-out detected: "${speech}"`);
    if (dealId) {
      getDb().prepare("UPDATE deals SET last_call_status = 'Not interested', status = 'not_interested', updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        .run(Number(dealId));
      
      const deal = CrmManager.getDeal(Number(dealId));
      if (deal) await SupabaseCrm.updateDealStage(deal.address, 'Not interested');
    }
    return endCall("No problem, have a great day.");
  }

  try {
    const { askAI } = await import('./core/ai.js');
    const aiResponse = await askAI(`
  Conversation so far:
  Owner: ${speech}

  Rules:
  - Speak naturally as a calm, trustworthy assistant
  - Keep sentences short (max 10-15 words)
  - No sales pressure
  - Sound like a helpful person, not a robot
  - No emojis, asterisks, or markdown
  - Respond briefly to what they just said
  `, "You are Claw, a calm and trustworthy assistant helping homeowners recover funds.");

    const aiText = aiResponse.content;
    const voiceData = await generateVoice(aiText);
    const audioUrl = voiceData ? await uploadAudioAndGetUrl(voiceData) : "";

    const twiml = `
<Response>
  ${audioUrl ? `<Play>${audioUrl}</Play>` : `<Say>${aiText}</Say>`}
  <Gather input="speech" action="/api/voice/ai" speechTimeout="auto" />
</Response>
`;

    res.setHeader("Content-Type", "text/xml");
    res.send(twiml);
  } catch (err: any) {
    log(`[Twilio Voice] AI Generation Error: ${err.message}`, "error");
    const fallbackMsg = "I'm sorry, I am having trouble hearing you. Let's talk later. Goodbye.";
    const fallbackUrl = `${process.env.BASE_URL}/api/voice/audio?text=${encodeURIComponent(fallbackMsg)}`;
    res.setHeader("Content-Type", "text/xml");
    res.send(`<Response><Play>${fallbackUrl}</Play><Hangup/></Response>`);
  }
});

// Twilio SMS Webhook — UPGRADED: AI NEGOTIATOR
app.post('/webhook/twilio', express.urlencoded({ extended: false }), async (req: Request, res: Response) => {
  const fromPhone = req.body.From;
  const messageBody = req.body.Body || "";

  log(`[Twilio SMS] Received from ${fromPhone}: "${messageBody}"`);

  try {
    const deal = CrmManager.findLatestDealByPhone(fromPhone);
    if (!deal) {
      log(`[Twilio SMS] No matching deal for phone ${fromPhone}. Skipping.`);
      return res.type('text/xml').send('<Response></Response>');
    }

    // 1. Detect terminal opt-outs
    const leadIntent = classifyLead(messageBody);
    if (leadIntent === "not_interested") {
      CrmManager.updateDeal(deal.id, { status: "not_interested" });
      await SupabaseCrm.updateDealStatusByPhone(fromPhone, "not_interested");
      log(`[Twilio SMS] Deal #${deal.id} marked as Not Interested.`);
      return res.type('text/xml').send('<Response></Response>');
    }

    // 2. Run AI Negotiator
    const aiResponse = await aiNegotiate(messageBody, deal);
    
    // 3. Send AI response back to seller
    await sendSms(fromPhone, aiResponse);
    log(`[Twilio SMS] AI Negotiator response sent: "${aiResponse}"`);

    // 4. Update Deal State based on refined intent
    const finalIntent = classifyLead(aiResponse + " " + messageBody); // Check both for agreement detection
    if (finalIntent === "interested") {
      CrmManager.updateDeal(deal.id, { status: "interested" });
      await SupabaseCrm.updateDealStatusByPhone(fromPhone, "interested");
      await SupabaseCrm.updateDealStage(deal.address, 'Interested');
      
      // Auto-trigger contract if haven't already
      const contract = generateContract(deal);
      log(`[Twilio SMS] Firm agreement detected. Contract generated for ${deal.address}`);
    }

  } catch (err: any) {
    log(`[Twilio SMS] Error in negotiation flow: ${err.message}`, "error");
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

// Configure Static Serving — Stuyza Command Center
const possibleStaticPaths = [
  path.join(process.cwd(), 'src', 'web'),   // ★ Stuyza Command Center
  path.join(__dirname, 'web'),               // Compiled fallback
  path.join(process.cwd(), 'dist', 'web')
];

let staticPathSet = false;
for (const p of possibleStaticPaths) {
  if (fs.existsSync(p)) {
    app.use(express.static(p));
    log(`[WebServer] Serving static assets from: ${p}`);
    staticPathSet = true;
    break;
  }
}
if (!staticPathSet) {
  log('[WebServer] WARNING: Static web directory not found!', 'warn');
}

// Dashboard Stats API
app.get('/api/dashboard/stats', (req: Request, res: Response) => {
  try {
    const totalLeads = getDb().prepare("SELECT COUNT(*) as count FROM scraped_leads").get() as any;
    const surplusDeals = getDb().prepare("SELECT COUNT(*) as count FROM deals").get() as any;
    const callsMade = getDb().prepare("SELECT COUNT(*) as count FROM outreach_logs WHERE type = 'call'").get() as any;
    const interestedLeads = getDb().prepare("SELECT COUNT(*) as count FROM deals WHERE status = 'interested'").get() as any;
    const totalProfit = getDb().prepare("SELECT SUM(profit) as total FROM deals").get() as any;

    res.json({
      totalLeads: totalLeads?.count || 0,
      surplusDeals: surplusDeals?.count || 0,
      callsMade: callsMade?.count || 0,
      interestedLeads: interestedLeads?.count || 0,
      estimatedProfit: totalProfit?.total || 0
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Dashboard Deals API
app.get('/api/dashboard/deals', (req: Request, res: Response) => {
  try {
    const deals = getDb().prepare("SELECT * FROM deals ORDER BY created_at DESC LIMIT 50").all();
    res.json(deals);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Manual Call Trigger API
app.post('/api/dashboard/call', async (req: Request, res: Response) => {
  const { dealId } = req.body;
  try {
    const deal = CrmManager.getDeal(dealId);
    if (!deal) return res.status(404).json({ error: "Deal not found" });

    await triggerAICall(deal);
    res.json({ success: true, message: "Call triggered successfully" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update Deal Outcome API
app.post('/api/dashboard/outcome', async (req: Request, res: Response) => {
  const { dealId, outcome, notes } = req.body;
  try {
    await CrmManager.updateDealOutcome(dealId, outcome, notes);
    res.json({ success: true, message: `Deal marked as ${outcome}` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Fetch AI Insights API
app.get('/api/dashboard/insights', async (req: Request, res: Response) => {
  try {
    const { InsightsAgent } = await import('./agents/insightsAgent.js');
    const insights = await InsightsAgent.generateMarketInsights();
    res.json({ insights });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// List All Buyers API
app.get('/api/dashboard/buyers', (req: Request, res: Response) => {
  try {
    const buyers = CrmManager.listBuyers();
    res.json(buyers);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Match Buyers for Deal API
app.get('/api/dashboard/match-buyers', (req: Request, res: Response) => {
  const { dealId } = req.query;
  try {
    const deal = CrmManager.getDeal(Number(dealId));
    if (!deal) return res.status(404).json({ error: "Deal not found" });

    const matches = CrmManager.findMatchingBuyers(deal);
    res.json(matches);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Alert Matched Buyers API
app.post('/api/dashboard/alert-buyers', async (req: Request, res: Response) => {
  const { dealId } = req.body;
  try {
    await CrmManager.alertMatchedBuyers(dealId);
    res.json({ success: true, message: "Buyer alerts dispatched" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Assign Deal to Buyer API
app.post('/api/dashboard/assign-deal', async (req: Request, res: Response) => {
  const { dealId, buyerId, salePrice } = req.body;
  try {
    await CrmManager.assignToBuyer(dealId, buyerId, Number(salePrice));
    res.json({ success: true, message: "Deal assigned successfully" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Send Contract to Seller API
app.post('/api/dashboard/send-contract', async (req: Request, res: Response) => {
  const { dealId } = req.body;
  try {
    const contractText = await CrmManager.sendContractAction(dealId);
    res.json({ success: true, message: "Contract sent via SMS", contract: contractText });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// lead Capture API for Stuyza Agency is now handled by leadsRouter
// Mounted in startWebServer below

export function startWebServer(bot: any) {
  // Mount modular leads router using new boilerplate pattern
  app.use('/api/leads', createLeadsRouter(getDb(), bot));

  const server = app.listen(PORT, '0.0.0.0', () => {
    log(`[WebServer] Started on port ${PORT} (0.0.0.0)`);
    log(`[WebServer] Stripe webhook endpoint: POST /webhook/stripe`);
    log(`[WebServer] Stuyza leads: POST /api/leads`);
    log(`[WebServer] Health check: GET /health`);
  });

  // ── Unified WebSocket Neural Bridge ───────────────────────────────────────
  const wss = new WebSocketServer({ server });
  
  wss.on('connection', (socket: any) => {
    log('[WebSocket] Dashboard connected to Neural Bridge.');
    socket.send(JSON.stringify({ type: 'status', agent: 'SYSTEM', message: 'BRIDGE_CONNECTED: Neural sync established.' }));
  });

  // Relay logs and handle Heartbeats
  const supabase = getSupabase();
  if (supabase) {
    supabase
      .channel('ops_logs_unified')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ops_logs' }, (payload: any) => {
          const row = payload.new;
          const broadcastMessage = JSON.stringify({
              type: row.type || 'status',
              agent: row.agent || 'SYSTEM',
              message: row.message,
              timestamp: row.timestamp
          });
          
          wss.clients.forEach((client: any) => {
              if (client.readyState === 1) client.send(broadcastMessage);
          });
      })
      .subscribe();
  }

  // ── Periodic Stellar Heartbeat ───────────────────────────────────────────
  setInterval(() => {
    const heartbeat = JSON.stringify({
        type: 'heartbeat',
        agent: 'SYSTEM',
        status: 'online',
        timestamp: new Date().toISOString()
    });
    
    wss.clients.forEach((client: any) => {
        if (client.readyState === 1) client.send(heartbeat);
    });
  }, 5000); 

  return server;
}
