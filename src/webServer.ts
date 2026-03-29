import express, { Request, Response } from 'express';
import { handleStripeWebhook } from './bot/invoiceHandlers.js';
import { log } from './core/config.js';

const app = express();
const PORT = process.env.PORT || 3000;

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

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'Gravity Claw'
  });
});

// Stripe test endpoint
app.get('/test/stripe', (req: Request, res: Response) => {
  const hasStripeKey = !!process.env.STRIPE_SECRET_KEY;
  const hasWebhookSecret = !!process.env.STRIPE_WEBHOOK_SECRET;
  
  res.json({
    stripeConfigured: hasStripeKey,
    webhookConfigured: hasWebhookSecret,
    environment: process.env.NODE_ENV || 'development'
  });
});

export function startWebServer() {
  const server = app.listen(PORT, () => {
    log(`[WebServer] Started on port ${PORT}`);
    log(`[WebServer] Stripe webhook endpoint: POST /webhook/stripe`);
    log(`[WebServer] Health check: GET /health`);
  });
  
  // Also add a basic root for general health
  app.get('/', (req, res) => res.send('Gravity Claw Specialist Agent is Online.'));
  
  return server;
}
