import { getDb } from "./memory.js";
import { log } from "./config.js";

export interface Deal {
    id: number;
    address: string;
    seller_name?: string;
    seller_phone?: string;
    arv: number;
    repair_estimate: number;
    max_offer: number;
    status: string;
    assigned_buyer?: string;
    city?: string;
    profit: number;
    surplus?: number;
    price?: number;
    sale_price?: number;
    buyer_id?: number;
    assignment_fee?: number;
    outcome?: "closed" | "no_response";
    notes?: string;
    last_call_status?: string;
    invoice_prompted: number;
    created_at: string;
    updated_at: string;
}

// import { DealWatcher } from "./dealWatcher.js"; // Removed to resolve circular dependency

export class CrmManager {
    static calculateMaxOffer(arv: number, repairs: number): number {
        // Formula: (ARV Ã— 70%) - Repairs
        return (arv * 0.70) - repairs;
    }

    static isHighValue(deal: Partial<Deal>): boolean {
        const surplus = deal.surplus || 0;
        const arv = deal.arv || 0;
        const price = deal.price || deal.max_offer || 0;
        const repairs = deal.repair_estimate || 0;
        const profit = arv - price - repairs;

        return surplus > 20000 || profit > 30000;
    }

    static addDeal(deal: Partial<Deal>): number {
        const arv = deal.arv || 0;
        const repairs = deal.repair_estimate || 0;
        const maxOffer = this.calculateMaxOffer(arv, repairs);

        const stmt = getDb().prepare(`
            INSERT INTO deals (address, seller_name, seller_phone, arv, repair_estimate, max_offer, status, assigned_buyer, profit, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const info = stmt.run(
            deal.address,
            deal.seller_name || null,
            deal.seller_phone || null,
            arv,
            repairs,
            maxOffer,
            deal.status || "lead",
            deal.assigned_buyer || null,
            deal.profit || 0,
            deal.notes || null
        );
        return info.lastInsertRowid as number;
    }

    static updateDeal(id: number, updates: Partial<Deal>) {
        const currentDeal = this.getDeal(id);
        if (!currentDeal) throw new Error("Deal not found");

        const arv = updates.arv !== undefined ? updates.arv : currentDeal.arv;
        const repairs = updates.repair_estimate !== undefined ? updates.repair_estimate : currentDeal.repair_estimate;
        const maxOffer = this.calculateMaxOffer(arv, repairs);

        const fields = Object.keys(updates)
            .filter(f => f !== "id" && f !== "created_at" && f !== "updated_at")
            .map(f => `${f} = ?`)
            .concat(["max_offer = ?", "updated_at = CURRENT_TIMESTAMP"]);

        const values = Object.keys(updates)
            .filter(f => f !== "id" && f !== "created_at" && f !== "updated_at")
            .map(f => (updates as any)[f])
            .concat([maxOffer]);

        const stmt = getDb().prepare(`UPDATE deals SET ${fields.join(", ")} WHERE id = ?`);
        const result = stmt.run(...values, id);
        
        // After any update, check if we need to trigger logic (like invoice prompt)
        import("./dealWatcher.js").then(({ DealWatcher }) => {
            DealWatcher.checkDealStatus(id).catch(err => {
                log(`[crm] Error in checkDealStatus for ${id}: ${err.message}`, "error");
            });
        }).catch(err => {
            log(`[crm] Failed to load DealWatcher: ${err.message}`, "error");
        });

        return result;
    }

    static getDeal(id: number): Deal | undefined {
        const stmt = getDb().prepare("SELECT * FROM deals WHERE id = ?");
        return stmt.get(id) as Deal | undefined;
    }

    static listDeals(limit = 20): Deal[] {
        const stmt = getDb().prepare("SELECT * FROM deals ORDER BY updated_at DESC LIMIT ?");
        return stmt.all(limit) as Deal[];
    }

    static findDealsByAddress(query: string): Deal[] {
        const stmt = getDb().prepare("SELECT * FROM deals WHERE address LIKE ? ORDER BY updated_at DESC");
        return stmt.all(`%${query}%`) as Deal[];
    }

    static findLatestDealByPhone(phone: string): Deal | undefined {
        const stmt = getDb().prepare("SELECT * FROM deals WHERE seller_phone = ? ORDER BY updated_at DESC LIMIT 1");
        return stmt.get(phone) as Deal | undefined;
    }

    static async updateDealOutcome(id: number, outcome: "closed" | "no_response", notes?: string) {
        const stmt = getDb().prepare("UPDATE deals SET outcome = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?");
        const result = stmt.run(outcome, notes || null, id);

        // Mirror to Supabase if we have a way to track the phone for lookup
        const deal = this.getDeal(id);
        if (deal?.seller_phone) {
            const { SupabaseCrm } = await import("./supabaseCrm.js");
            await SupabaseCrm.updateDealStatusByPhone(deal.seller_phone, outcome);
        }

        return result;
    }

    static listBuyers(): any[] {
        return getDb().prepare("SELECT * FROM buyers ORDER BY name ASC").all();
    }

    static findMatchingBuyers(deal: Deal): any[] {
        const buyers = this.listBuyers();
        return buyers.filter(b => {
             // Parse Buy Box JSON
             let buyBox = { maxPrice: 0 };
             try { buyBox = JSON.parse(b.buy_box || '{}'); } catch(e) {}

             const cityMatch = !deal.city || b.city?.toLowerCase() === deal.city?.toLowerCase();
             const priceMatch = (buyBox.maxPrice || b.budget || 0) >= (deal.max_offer || 0);
             
             return cityMatch && priceMatch;
        });
    }

    static async alertMatchedBuyers(dealId: number): Promise<void> {
        const deal = this.getDeal(dealId);
        if (!deal) throw new Error("Deal not found");

        const matched = this.findMatchingBuyers(deal);
        if (matched.length === 0) {
            log(`[crm] No matching buyers found for ${deal.address}`);
            return;
        }

        const { sendSms } = await import("../services/outreachService.js");

        for (const buyer of matched) {
            if (!buyer.phone) continue;
            
            const message = `
🔥 OFF-MARKET DEAL

${deal.address}
Price: $${(deal.max_offer || 0).toLocaleString()}
ARV: $${(deal.arv || 0).toLocaleString()}

Reply FAST if interested. This will move quickly.
`;
            try {
                await sendSms(buyer.phone, message);
                log(`[crm] Alerted buyer ${buyer.name} about ${deal.address}`);
            } catch (err: any) {
                log(`[crm] Failed to alert buyer ${buyer.name}: ${err.message}`, "error");
            }
        }
    }

    static async assignToBuyer(dealId: number, buyerId: number, salePrice: number) {
        const deal = this.getDeal(dealId);
        if (!deal) throw new Error("Deal not found");

        const buyer = getDb().prepare("SELECT * FROM buyers WHERE id = ?").get(buyerId) as any;
        if (!buyer) throw new Error("Buyer not found");

        const assignmentFee = salePrice - (deal.max_offer || 0);
        
        getDb().prepare(`
            UPDATE deals 
            SET status = 'assigned', 
                assigned_buyer = ?, 
                buyer_id = ?, 
                sale_price = ?, 
                assignment_fee = ?,
                profit = ?, -- Final realized profit
                updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        `).run(buyer.name, buyerId, salePrice, assignmentFee, assignmentFee, dealId);

        log(`[crm] DEAL ASSIGNED: ${deal.address} to ${buyer.name} for $${salePrice.toLocaleString()} (Profit: $${assignmentFee.toLocaleString()})`);
        
        // Mirror to Supabase if possible
        try {
            const { SupabaseCrm } = await import("./supabaseCrm.js");
            await SupabaseCrm.updateDealStage(deal.address, 'Assigned');
        } catch (e) {}
    }

    static async sendContractAction(dealId: number): Promise<string> {
        const deal = this.getDeal(dealId);
        if (!deal) throw new Error("Deal not found");

        const { generateContract, sendSms } = await import("../services/outreachService.js");
        const contractText = generateContract(deal);
        
        const phone = deal.seller_phone;
        if (!phone) throw new Error("No seller phone found for contract dispatch.");

        // Dispatch Contract
        await sendSms(phone, `Claw here. Based on our discussion, here is the recovery agreement for ${deal.address}:\n\n${contractText}`);
        
        // Update Status
        getDb().prepare("UPDATE deals SET status = 'contract', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(dealId);
        
        // Mirror to Supabase
        try {
            const { SupabaseCrm } = await import("./supabaseCrm.js");
            await SupabaseCrm.updateDealStage(deal.address, 'Contract');
        } catch (e) {}

        log(`[crm] Legal Contract dispatched to ${phone} for ${deal.address}`);
        return contractText;
    }

    static getStats() {
        const counts = getDb().prepare(`
            SELECT status, COUNT(*) as count 
            FROM deals 
            GROUP BY status
        `).all() as { status: string, count: number }[];

        const stats = {
            leads: 0,
            contacted: 0,
            interested: 0,
            contracts: 0,
            closed: 0
        };

        counts.forEach(c => {
            const s = (c.status || '').toLowerCase();
            if (s === 'lead') stats.leads += c.count;
            if (s === 'contacted') stats.contacted += c.count;
            if (s === 'interested') stats.interested += c.count;
            if (s === 'contract') stats.contracts += c.count;
            if (s === 'closed') stats.closed += c.count;
        });

        return stats;
    }

    /**
     * Get leads that haven't been touched in 3 days
     */
    static getColdLeads(days = 3): Deal[] {
        const stmt = getDb().prepare(`
            SELECT * FROM deals 
            WHERE status IN ('lead', 'contacted')
            AND updated_at < date('now', ?)
            ORDER BY updated_at ASC
        `);
        return stmt.all(`-${days} days`) as Deal[];
    }

    static getHottestDeal(): Deal | undefined {
        return getDb().prepare("SELECT * FROM deals WHERE status != 'closed' ORDER BY profit DESC LIMIT 1").get() as Deal | undefined;
    }

    static getTotalRevenue() {
        const month = getDb().prepare("SELECT SUM(profit) as total FROM deals WHERE status = 'closed' AND updated_at > date('now', '-30 days')").get() as any;
        const allTime = getDb().prepare("SELECT SUM(profit) as total FROM deals WHERE status = 'closed'").get() as any;
        return {
            month: month?.total || 0,
            allTime: allTime?.total || 0
        };
    }

    static getFollowUpsDueToday(): Deal[] {
        return this.getColdLeads(3);
    }
}

