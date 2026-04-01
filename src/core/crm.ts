import { db } from "./memory.js";

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
    profit: number;
    invoice_prompted: number;
    created_at: string;
    updated_at: string;
}

import { DealWatcher } from "./dealWatcher.js";

export class CrmManager {
    static calculateMaxOffer(arv: number, repairs: number): number {
        // Formula: (ARV Ã— 70%) - Repairs
        return (arv * 0.70) - repairs;
    }

    static addDeal(deal: Partial<Deal>): number {
        const arv = deal.arv || 0;
        const repairs = deal.repair_estimate || 0;
        const maxOffer = this.calculateMaxOffer(arv, repairs);

        const stmt = db.prepare(`
            INSERT INTO deals (address, seller_name, seller_phone, arv, repair_estimate, max_offer, status, assigned_buyer, profit)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            deal.profit || 0
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

        const stmt = db.prepare(`UPDATE deals SET ${fields.join(", ")} WHERE id = ?`);
        const result = stmt.run(...values, id);
        
        // After any update, check if we need to trigger logic (like invoice prompt)
        DealWatcher.checkDealStatus(id).catch(err => {
            console.log(`[crm] Error in checkDealStatus for ${id}: ${err.message}`);
        });

        return result;
    }

    static getDeal(id: number): Deal | undefined {
        const stmt = db.prepare("SELECT * FROM deals WHERE id = ?");
        return stmt.get(id) as Deal | undefined;
    }

    static listDeals(limit = 20): Deal[] {
        const stmt = db.prepare("SELECT * FROM deals ORDER BY updated_at DESC LIMIT ?");
        return stmt.all(limit) as Deal[];
    }

    static findDealsByAddress(query: string): Deal[] {
        const stmt = db.prepare("SELECT * FROM deals WHERE address LIKE ? ORDER BY updated_at DESC");
        return stmt.all(`%${query}%`) as Deal[];
    }

    static findLatestDealByPhone(phone: string): Deal | undefined {
        const stmt = db.prepare("SELECT * FROM deals WHERE seller_phone = ? ORDER BY updated_at DESC LIMIT 1");
        return stmt.get(phone) as Deal | undefined;
    }

    static listBuyers(): any[] {
        return db.prepare("SELECT * FROM buyers ORDER BY name ASC").all();
    }

    static findMatchingBuyers(address: string): any[] {
        const buyers = this.listBuyers();
        const addrLower = address.toLowerCase();
        
        return buyers.filter(buyer => {
            const criteria = (buyer.criteria || '').toLowerCase();
            const keywords = ['brooklyn', 'queens', 'manhattan', 'bronx', 'staten', 'springfield', 'jersey'];
            const foundKeywords = keywords.filter(k => addrLower.includes(k) && criteria.includes(k));
            return foundKeywords.length > 0;
        });
    }

    static getStats() {
        const counts = db.prepare(`
            SELECT status, COUNT(*) as count 
            FROM deals 
            GROUP BY status
        `).all() as { status: string, count: number }[];

        const stats = {
            leads: 0,
            contacted: 0,
            contract: 0
        };

        counts.forEach(c => {
            if (c.status === 'lead') stats.leads = c.count;
            if (c.status === 'contacted') stats.contacted = c.count;
            if (c.status === 'contract') stats.contract = c.count;
        });

        return stats;
    }

    static getHottestDeal(): Deal | undefined {
        const stmt = db.prepare("SELECT * FROM deals ORDER BY profit DESC LIMIT 1");
        return stmt.get() as Deal | undefined;
    }

    static getTotalRevenue(): { month: number, allTime: number } {
        const allTimeResult = db.prepare("SELECT SUM(profit) as total FROM deals WHERE status = 'closed'").get() as { total: number };
        const monthResult = db.prepare("SELECT SUM(profit) as total FROM deals WHERE status = 'closed' AND updated_at > date('now', 'start of month')").get() as { total: number };
        
        return {
            month: monthResult ? monthResult.total || 0 : 0,
            allTime: allTimeResult ? allTimeResult.total || 0 : 0
        };
    }

    static getFollowUpsDueToday(): Deal[] {
        const stmt = db.prepare(`
            SELECT * FROM deals 
            WHERE status != 'closed' 
            AND updated_at < date('now', '-3 days')
            LIMIT 5
        `);
        return stmt.all() as Deal[];
    }
}

