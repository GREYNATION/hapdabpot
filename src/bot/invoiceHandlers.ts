import { Telegraf, Context } from 'telegraf';
import { DealWatcher } from '../core/dealWatcher.js';
import { config, log } from '../core/config.js';

export function setupInvoiceHandlers(bot: Telegraf) {
  // Check for pending invoices every 30 seconds
  setInterval(() => checkPendingInvoices(bot), 30 * 1000);
  
  // Handle invoice confirmation button presses
  bot.on('callback_query', async (ctx: Context) => {
    const callbackQuery = ctx.callbackQuery;
    if (!callbackQuery || !('data' in callbackQuery)) return;
    
    const data = callbackQuery.data;
    
    if (data.startsWith('invoice_yes_')) {
      const dealId = parseInt(data.replace('invoice_yes_', ''));
      await handleInvoiceConfirmation(ctx, dealId, true);
    } else if (data.startsWith('invoice_no_')) {
      const dealId = parseInt(data.replace('invoice_no_', ''));
      await handleInvoiceConfirmation(ctx, dealId, false);
    }
  });
}

async function checkPendingInvoices(bot: Telegraf) {
  const pendingInvoices = (global as any).pendingInvoices || [];
  
  for (const invoice of pendingInvoices) {
    if (invoice.status === 'pending_confirmation') {
      // Send confirmation message to owner
      await sendInvoiceConfirmation(bot, invoice);
      invoice.status = 'confirmation_sent';
    }
  }
}

async function sendInvoiceConfirmation(bot: Telegraf, invoice: any) {
  if (!config.ownerId) {
    log('[InvoiceHandlers] Owner ID not configured', 'error');
    return;
  }
  
  const message = `💰 **Invoice Ready for Confirmation**
  
📍 Property: ${invoice.address}
💵 Amount: $${invoice.amount.toLocaleString()}
🔢 Deal ID: ${invoice.dealId}

Send invoice to client?`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: '✅ Yes, Send Invoice', callback_data: `invoice_yes_${invoice.dealId}` },
        { text: '❌ No, Skip', callback_data: `invoice_no_${invoice.dealId}` }
      ]
    ]
  };

  try {
    await bot.telegram.sendMessage(config.ownerId, message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
    
    log(`[InvoiceHandlers] Sent confirmation for deal ${invoice.dealId} to owner`);
  } catch (error: any) {
    log(`[InvoiceHandlers] Failed to send confirmation: ${error.message}`, 'error');
  }
}

async function handleInvoiceConfirmation(ctx: Context, dealId: number, confirm: boolean) {
  if (!ctx.callbackQuery || !('id' in ctx.callbackQuery)) return;
  
  const callbackId = ctx.callbackQuery.id;
  
  if (confirm) {
    // User confirmed - send invoice
    await ctx.answerCbQuery('Sending invoice...');
    
    const success = await DealWatcher.confirmAndSendInvoice(dealId);
    
    if (success) {
      await ctx.editMessageText('✅ Invoice sent successfully! Payment request delivered to client.');
    } else {
      await ctx.editMessageText('❌ Failed to send invoice. Please check Stripe configuration.');
    }
  } else {
    // User declined
    await ctx.answerCbQuery('Invoice cancelled');
    await ctx.editMessageText('❌ Invoice cancelled. Deal remains in "Under Contract" status.');
  }
  
  // Remove from pending invoices
  const pendingInvoices = (global as any).pendingInvoices || [];
  const index = pendingInvoices.findIndex((inv: any) => inv.dealId === dealId);
  if (index > -1) {
    pendingInvoices.splice(index, 1);
  }
}

// API endpoint for Stripe webhook (to be called from Express server)
export async function handleStripeWebhook(body: string, signature: string): Promise<boolean> {
  const { handleWebhook } = await import('../services/stripeService.js');
  const result = await handleWebhook(body, signature);
  
  if (result && result.type === 'invoice.paid' && result.dealId) {
    // Update deal status to "Closed"
    const { CrmManager } = await import('../core/crm.js');
    
    try {
      CrmManager.updateDeal(result.dealId, { status: 'closed' });
      log(`[InvoiceHandlers] Deal ${result.dealId} marked as Closed after payment`);
      
      // Could also send notification to owner
      return true;
    } catch (error: any) {
      log(`[InvoiceHandlers] Failed to update deal ${result.dealId}: ${error.message}`, 'error');
    }
  }
  
  return false;
}