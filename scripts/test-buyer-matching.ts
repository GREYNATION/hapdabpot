import { initDb } from "../src/core/memory.js";
import { CrmManager } from "../src/core/crm.js";
import { db } from "../src/core/memory.js";

async function testBuyerMatching() {
    console.log("🚀 Starting Buyer Matching Test...");
    
    // 1. Initialize DB and run migrations
    initDb();
    
    // 2. Clear test data (optional, but good for repeatable tests)
    db.prepare("DELETE FROM buyers WHERE name LIKE 'Test Buyer%'").run();
    db.prepare("DELETE FROM deals WHERE address = '123 Test St'").run();
    
    // 3. Insert Test Buyers
    db.prepare(`
        INSERT INTO buyers (name, phone, city, budget)
        VALUES 
        ('Test Buyer Houston', '555-0001', 'Houston', 200000),
        ('Test Buyer Dallas', '555-0002', 'Dallas', 150000),
        ('Test Buyer Cheap', '555-0003', 'Houston', 50000)
    `).run();
    
    console.log("✅ Test buyers inserted.");
    
    // 4. Insert Test Deal
    const dealId = CrmManager.addDeal({
        address: '123 Test St',
        arv: 250000,
        repair_estimate: 30000,
        status: 'lead'
    });
    
    // Add city manually for now as addDeal doesn't handle all fields yet
    db.prepare("UPDATE deals SET city = ? WHERE id = ?").run('Houston', dealId);
    
    const deal = CrmManager.getDeal(dealId);
    console.log(`✅ Test deal created: ${deal?.address} in ${deal?.city} (Max Offer: $${deal?.max_offer})`);
    
    // 5. Run Matching Logic
    if (deal) {
        const matches = CrmManager.findMatchingBuyers(deal);
        console.log(`📊 Found ${matches.length} matches:`);
        matches.forEach(m => console.log(`   - ${m.name} (City: ${m.city}, Budget: $${m.budget})`));
        
        if (matches.length === 1 && matches[0].name === 'Test Buyer Houston') {
            console.log("🎯 SUCCESS: Correct matching logic!");
        } else {
            console.log("❌ FAILURE: Matching logic returned incorrect results.");
        }
    }
}

testBuyerMatching().catch(err => console.error("❌ Test failed:", err));
