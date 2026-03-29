import { CrmManager } from "../src/core/crm.js";
import { initDb } from "../src/core/memory.js";

// Initialize DB
initDb();

console.log("--- CRM Verification Started ---");

// 1. Test Add Deal
console.log("1. Testing Add Deal...");
const id = CrmManager.addDeal({
    address: "123 Main St, Springfield",
    seller_name: "John Doe",
    arv: 200000,
    repair_estimate: 40000
});

const deal = CrmManager.getDeal(id);
if (deal && deal.max_offer === 100000) { // (200000 * 0.7) - 40000 = 100000
    console.log("✅ Add Deal successful. Max Offer: $" + deal.max_offer);
} else {
    console.log("❌ Add Deal failed or calculation incorrect. Value: " + deal?.max_offer);
}

// 2. Test Update Deal
console.log("\n2. Testing Update Deal...");
CrmManager.updateDeal(id, { status: "contract", profit: 15000 });
const updatedDeal = CrmManager.getDeal(id);
if (updatedDeal?.status === "contract" && updatedDeal.profit === 15000) {
    console.log("✅ Update Deal successful.");
} else {
    console.log("❌ Update Deal failed.");
}

// 3. Test List Deals
console.log("\n3. Testing List Deals...");
const list = CrmManager.listDeals();
if (list.length > 0) {
    console.log("✅ List Deals successful. Found " + list.length + " deals.");
} else {
    console.log("❌ List Deals failed.");
}

console.log("\n--- CRM Verification Complete ---");
process.exit(0);
