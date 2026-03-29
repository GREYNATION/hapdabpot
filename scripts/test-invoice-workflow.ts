import { CrmManager } from '../src/core/crm.js';
import { DealWatcher } from '../src/core/dealWatcher.js';
import { initDb } from '../src/core/memory.js';

async function testInvoiceWorkflow() {
  console.log('=== Testing Invoice Workflow ===\n');
  
  // Initialize database
  console.log('0. Initializing database...');
  initDb();
  console.log('   ✅ Database initialized');
  
  // 1. Create a test deal
  console.log('\n1. Creating test deal...');
  const dealId = CrmManager.addDeal({
    address: '123 Test Street, Brooklyn, NY 11201',
    seller_name: 'John Doe',
    seller_phone: '555-0123',
    arv: 500000,
    repair_estimate: 50000,
    status: 'lead',
    profit: 0
  });
  
  console.log(`   ✅ Created deal #${dealId}`);
  
  // 2. Simulate deal moving to "Under Contract"
  console.log('\n2. Updating deal to "Under Contract"...');
  CrmManager.updateDeal(dealId, { status: 'contract' });
  console.log(`   ✅ Deal #${dealId} marked as "Under Contract"`);
  
  // 3. Check DealWatcher picks it up
  console.log('\n3. Checking DealWatcher...');
  await DealWatcher.checkDealStatus(dealId);
  
  // 4. Check pending invoices
  console.log('\n4. Checking pending invoices...');
  const pendingInvoices = (global as any).pendingInvoices || [];
  console.log(`   📋 Found ${pendingInvoices.length} pending invoices`);
  
  if (pendingInvoices.length > 0) {
    const invoice = pendingInvoices[0];
    console.log(`   📍 Deal: ${invoice.address}`);
    console.log(`   💵 Amount: $${invoice.amount.toLocaleString()}`);
    console.log(`   ⏰ Timestamp: ${invoice.timestamp}`);
    
    // 5. Simulate invoice confirmation
    console.log('\n5. Simulating invoice confirmation...');
    const success = await DealWatcher.confirmAndSendInvoice(dealId);
    
    if (success) {
      console.log('   ✅ Invoice sent successfully!');
      
      // 6. Check deal status
      const updatedDeal = CrmManager.getDeal(dealId);
      console.log(`   📊 Deal status: ${updatedDeal?.status}`);
    } else {
      console.log('   ❌ Invoice sending failed (check Stripe configuration)');
    }
  }
  
  console.log('\n=== Test Complete ===');
  console.log('Note: For real invoices, configure STRIPE_SECRET_KEY in .env');
}

testInvoiceWorkflow().catch(console.error);