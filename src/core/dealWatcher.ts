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
    
    // Check for deals that might already be "Under Contract"
    this.checkExistingDeals();
    
    // Set up periodic check (every 5 minutes)
    setInterval(() => this.checkExistingDeals(), 5 * 60 * 1000);
  }

  static async checkDealStatus(dealId: number): Promise<void> {
    const deal = CrmManager.getDeal(dealId);
    if (!deal) return;

    // If deal is "Under Contract" and not already watched
    if (deal.status === 'contract' && !this.watchedDeals.has(dealId)) {
      log(`[DealWatcher] Deal ${dealId} (${deal.address}) is now Under Contract`);
      await this.handleUnderContractDeal(deal);
      this.watchedDeals.add(dealId);
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
    
    log(`[DealWatcher] Invoice ready event emitted for deal ${deal.id}`);
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
    try {
      const deals = CrmManager.listDeals(50);
      const contractDeals = deals.filter(d => d.status === 'contract');
      
      for (const deal of contractDeals) {
        if (!this.watchedDeals.has(deal.id)) {
          await this.handleUnderContractDeal(deal);
          this.watchedDeals.add(deal.id);
        }
      }
    } catch (error: any) {
      log(`[DealWatcher] Error checking existing deals: ${error.message}`, 'error');
    }
  }

  static getConfig(): DealWatcherConfig {
    return this.config;
  }

  static setConfig(newConfig: Partial<DealWatcherConfig>): void {
    this.config = { ...this.config, ...newConfig };
    log('[DealWatcher] Config updated');
  }
}