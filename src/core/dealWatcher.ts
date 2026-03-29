import { CrmManager, Deal } from './crm.js';
import { createInvoice } from '../services/stripeService.js';
import { config, log } from './config.js';

interface DealWatcherConfig {
  invoiceAmount: number; // Default invoice amount in dollars
  invoiceEmail: string;  // Email to send invoices to
}

export class DealWatcher {
  private static watchedDeals = new Set<number>();
  private static config: DealWatcherConfig = {
    invoiceAmount: 12500, // $12,500 default
    invoiceEmail: config.agentmailEmail || 'billing@gravityclaw.ai'
  };

  static init() {
    log('[DealWatcher] Initializing deal watcher...');
    // No automatic checks on startup anymore - only on status change
  }

  static async checkDealStatus(dealId: number): Promise<void> {
    const deal = CrmManager.getDeal(dealId);
    if (!deal) return;

    // If deal is "Under Contract" and not already prompted
    if (deal.status === 'contract' && deal.invoice_prompted === 0) {
      log(`[DealWatcher] Deal ${dealId} (${deal.address}) is now Under Contract. Triggering invoice prompt.`);
      await this.handleUnderContractDeal(deal);
    }
  }

  private static async handleUnderContractDeal(deal: Deal): Promise<void> {
    try {
      log(`[DealWatcher] Processing Under Contract deal: ${deal.address}`);
      
      // Calculate invoice amount (use max_offer or default)
      const invoiceAmount = deal.max_offer > 0 ? deal.max_offer : this.config.invoiceAmount;
      
      // Create invoice data
      const invoiceData = {
        dealId: deal.id,
        address: deal.address,
        amount: invoiceAmount,
        customerEmail: this.config.invoiceEmail,
        customerName: deal.assigned_buyer || 'Gravity Claw Client',
        description: `Wholesale fee for property at ${deal.address}`,
      };

      // Store pending invoice in memory for later confirmation
      // This will be used by the Telegram bot to ask for confirmation
      log(`[DealWatcher] Invoice ready for confirmation: $${invoiceAmount} for deal ${deal.id}`);
      
      // Emit event for Telegram bot to pick up
      this.emitInvoiceReady(deal, invoiceAmount);
      
    } catch (error: any) {
      log(`[DealWatcher] Error processing deal ${deal.id}: ${error.message}`, 'error');
    }
  }

  private static emitInvoiceReady(deal: Deal, amount: number): void {
    // Store in a simple in-memory queue for the bot to process
    const invoiceReadyEvent = {
      type: 'INVOICE_READY',
      dealId: deal.id,
      address: deal.address,
      amount,
      timestamp: new Date().toISOString(),
      status: 'pending_confirmation'
    };

    // Store in global variable for bot to access
    (global as any).pendingInvoices = (global as any).pendingInvoices || [];
    (global as any).pendingInvoices.push(invoiceReadyEvent);
    
    // Set persistent flag in database so it doesn't fire again
    CrmManager.updateDeal(deal.id, { invoice_prompted: 1 });
    
    log(`[DealWatcher] Invoice ready event emitted for deal ${deal.id}. Flag persisted.`);
  }

  static async confirmAndSendInvoice(dealId: number): Promise<boolean> {
    const deal = CrmManager.getDeal(dealId);
    if (!deal) {
      log(`[DealWatcher] Deal ${dealId} not found for invoice confirmation`, 'error');
      return false;
    }

    const invoiceAmount = deal.max_offer > 0 ? deal.max_offer : this.config.invoiceAmount;
    
    const invoiceData = {
      dealId: deal.id,
      address: deal.address,
      amount: invoiceAmount,
      customerEmail: this.config.invoiceEmail,
      customerName: deal.assigned_buyer || 'Gravity Claw Client',
      description: `Wholesale fee for property at ${deal.address}`,
    };

    const invoiceId = await createInvoice(invoiceData);
    
    if (invoiceId) {
      log(`[DealWatcher] Invoice ${invoiceId} sent for deal ${dealId}`);
      
      // Update deal with invoice info
      CrmManager.updateDeal(dealId, {
        status: 'invoice_sent',
        // Store invoice ID in profit field temporarily (could add invoice_id column)
        profit: invoiceAmount
      } as any);
      
      return true;
    }
    
    return false;
  }

  static async checkExistingDeals(): Promise<void> {
    // Deprecated for safety - user wants explicit triggers only
    log('[DealWatcher] Manual check of existing deals triggered (skipped per user request)');
  }

  static getConfig(): DealWatcherConfig {
    return this.config;
  }

  static setConfig(newConfig: Partial<DealWatcherConfig>): void {
    this.config = { ...this.config, ...newConfig };
    log('[DealWatcher] Config updated');
  }
}
