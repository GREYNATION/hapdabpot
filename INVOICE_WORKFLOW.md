# Invoice Workflow System

## Overview
Automated invoicing system that triggers when deals reach "Under Contract" status in the CRM.

## Flow
```
Deal marked "Under Contract" in CRM
        ↓
Bot DMs you: "Deal at 123 Main St ready to invoice — $12,500 fee. Send invoice? [YES] [NO]"
        ↓
You tap YES → Stripe invoice fires automatically
        ↓
Payment collected → CRM updates to "Closed" → revenue logged
```

## Components

### 1. Deal Watcher (`src/core/dealWatcher.ts`)
- Monitors CRM for deals with status "contract"
- Creates invoice data when detected
- Emits invoice ready events

### 2. Stripe Service (`src/services/stripeService.ts`)
- Creates Stripe invoices
- Handles payment webhooks
- Manages customer records

### 3. Invoice Handlers (`src/bot/invoiceHandlers.ts`)
- Sends Telegram confirmation messages
- Handles YES/NO button responses
- Processes Stripe webhooks

### 4. Web Server (`src/webServer.ts`)
- Receives Stripe webhook events
- Health check endpoint
- Stripe configuration test

## Configuration

Add to `.env`:
```env
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
```

## Commands

### Telegram Bot Commands
- `/invoice list` - Show pending invoices
- `/invoice send [dealId]` - Manually send invoice for deal
- `/invoice test` - Create test deal and invoice

### Deal Commands
- `/deal update [id] status=contract` - Mark deal as Under Contract
- `/deal view [id]` - View deal details

## Testing

1. **Create test deal:**
   ```bash
   npm run bot -- /invoice test
   ```

2. **Simulate deal moving to Under Contract:**
   ```bash
   npm run bot -- /deal update 1 status=contract
   ```

3. **Check pending invoices:**
   ```bash
   npm run bot -- /invoice list
   ```

4. **Run workflow test:**
   ```bash
   npx tsx scripts/test-invoice-workflow.ts
   ```

## Stripe Setup

1. Get API keys from https://dashboard.stripe.com/apikeys
2. Set up webhook endpoint in Stripe dashboard:
   - URL: `https://your-domain.com/webhook/stripe`
   - Events: `invoice.paid`, `invoice.payment_failed`

## Architecture Notes

- Invoice amount defaults to deal's `max_offer` or $12,500
- Customer email defaults to `config.agentmailEmail`
- Webhook processing updates deal status to "closed"
- Failed payments log errors but don't update CRM

## Error Handling

- Missing Stripe keys → graceful degradation with warnings
- Webhook verification failures → 400 response
- Payment failures → logged but deal remains in "invoice_sent" status
- Invoice creation failures → logged and user notified