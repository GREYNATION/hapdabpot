import { getSupabase } from "./supabaseMemory.js";
import { log, config } from "./config.js";
import { PropertyScraper } from "./scraper.js";
import { sendSms } from "../services/outreachService.js";
import { Lead } from "../services/universalLeadScraper.js";
import { Telegraf } from "telegraf";

export interface SupabaseDeal {
    address: string;
    seller?: string;
    owner_name?: string;
    phone?: string;
    arv?: number;
    repairs?: number;
    max_offer?: number;
    motivation_score?: number;
    est_profit?: number;
    status?: string;
    stage?: string;
    source?: string;
    investor_id?: string;
}

export class SupabaseCrm {
    /**
     * Calculate Maximum Allowed Offer (MAO)
     * Formula: (ARV Ã— 70%) - Repairs
     */
    static calculateMaxOffer(arv: number, repairs: number): number {
        return (arv * 0.7) - repairs;
    }

    /**
     * Insert a deal into Supabase
     */
    static async insertDeal(data: SupabaseDeal): Promise<{ success: boolean; error?: string }> {
        try {
            const arv = data.arv || 0;
            const repairs = data.repairs || 0;
            const maxOffer = data.max_offer || this.calculateMaxOffer(arv, repairs);
            const supabase = getSupabase();

            const { error } = await supabase.from("deals").insert({
                address: data.address,
                seller: data.seller || data.owner_name,
                owner_name: data.owner_name || data.seller,
                phone: data.phone,
                arv: arv,
                repairs: repairs,
                max_offer: maxOffer,
                motivation_score: data.motivation_score,
                est_profit: data.est_profit,
                status: data.status || "new",
                source: data.source || "manual",
                investor_id: data.investor_id
            });

            if (error) throw error;

            log(`[supabaseCrm] âœ… Deal saved to Supabase: ${data.address}`);
            return { success: true };
        } catch (err: any) {
            log(`[supabaseCrm] âš ï¸  Failed to insert deal into Supabase: ${err.message}`, "error");
            return { success: false, error: err.message };
        }
    }

    /**
     * Finds deals in a city using the AI scraper
     */
    static async findDeals(city: string): Promise<any[]> {
        log(`[supabaseCrm] ðŸ”  Finding deals in ${city}...`);
        return await PropertyScraper.fetchLatestDeeds(city, 5);
    }

    /**
     * Scans a market, calculates MAO, and saves deals to Supabase
     */
    static async scanMarket(city: string): Promise<number> {
        log(`[supabaseCrm] ðŸ¤– Starting market scan for ${city}...`);
        const leads = await this.findDeals(city);
        let count = 0;

        for (const lead of leads) {
            // Estimate ARV and Repairs if not provided (placeholder logic for automated scans)
            const arv = 150000; // Default placeholder for Camden/Dallas wholesale
            const repairs = 30000;
            
            const result = await this.insertDeal({
                address: lead.address,
                seller: lead.ownerName || "Unknown",
                phone: "N/A",
                arv: arv,
                repairs: repairs
            });

            if (result.success) {
                count++;
                // 3. Trigger Automated Outreach
                await this.contactSeller({
                    address: lead.address,
                    phone: "N/A" // Placeholder until skip trace is integrated
                });
            }
        }

        log(`[supabaseCrm] âœ… Scan complete for ${city}. Saved ${count} deals.`);
        return count;
    }

    /**
     * Automated Outreach: Contact the seller via SMS
     */
    static async contactSeller(deal: { address: string; phone: string }): Promise<void> {
        if (!deal.phone || deal.phone === "N/A" || deal.phone === "Unknown") {
            log(`[supabaseCrm] âš ï¸  Skipping outreach for ${deal.address}: No valid phone number.`, "warn");
            return;
        }

        const message = `Hey, I saw your property at ${deal.address}. Are you open to selling?`;
        
        try {
            log(`[supabaseCrm] ðŸ“± Initiating outreach for ${deal.address}...`);
            await sendSms(deal.phone, message);
            log(`[supabaseCrm] âœ… Outreach SMS sent for ${deal.address}.`);
        } catch (err: any) {
            log(`[supabaseCrm] âš ï¸  Outreach failed for ${deal.address}: ${err.message}`, "error");
        }
    }

    /**
     * Update the status of a deal in Supabase based on the seller's phone number
     */
    static async updateDealStatusByPhone(phone: string, status: string): Promise<{ success: boolean; error?: string }> {
        try {
            const supabase = getSupabase();
            const { error } = await supabase
                .from("deals")
                .update({ status: status })
                .eq("phone", phone);

            if (error) throw error;

            log(`[supabaseCrm] ðŸ“ˆ Status updated to "${status}" for phone: ${phone}`);
            return { success: true };
        } catch (err: any) {
            log(`[supabaseCrm] âš ï¸  Failed to update Supabase deal status: ${err.message}`, "error");
            return { success: false, error: err.message };
        }
    }

    /**
     * Get CRM Statistics from Supabase
     */
    static async getStats(): Promise<{ leads: number; underContract: number; revenue: number }> {
        try {
            const supabase = getSupabase();
            const { data: deals, error } = await supabase.from("deals").select("*");

            if (error) throw error;
            if (!deals) return { leads: 0, underContract: 0, revenue: 0 };

            const leads = deals.length;
            const underContract = deals.filter((d: any) => d.stage === "under_contract").length;
            const revenue = deals
                .filter((d: any) => d.stage === "closed")
                .reduce((sum: number, d: any) => sum + (d.profit || 0), 0);

            return { leads, underContract, revenue };
        } catch (err: any) {
            log(`[supabaseCrm] âš ï¸  Failed to fetch stats: ${err.message}`, "error");
            return { leads: 0, underContract: 0, revenue: 0 };
        }
    }
    /**
     * Get System Status from Supabase Telemetry
     */
    static async getSystemStatus(): Promise<{
        realEstateActive: boolean;
        dealsFoundToday: number;
        highScoreLeads: number;
        tradingActive: boolean;
    }> {
        try {
            const supabase = getSupabase();
            const today = new Date().toISOString().split('T')[0];

            // 1. Deals Found Today
            const { count: dealsCount, error: dealsError } = await supabase
                .from("bot_events")
                .select("*", { count: 'exact', head: true })
                .eq("type", "deal_found")
                .gte("created_at", today);

            if (dealsError) throw dealsError;

            // 2. High Score Leads (Score >= 8)
            const { data: highScores, error: scoresError } = await supabase
                .from("bot_events")
                .select("data")
                .eq("type", "deal_found")
                .gte("created_at", today);

            if (scoresError) throw scoresError;
            
            const highCount = (highScores || []).filter((e: any) => (e.data?.score || 0) >= 8).length;

            return {
                realEstateActive: true,
                dealsFoundToday: dealsCount || 0,
                highScoreLeads: highCount,
                tradingActive: true
            };
        } catch (err: any) {
            log(`[supabaseCrm] ⚠️ Failed to fetch status: ${err.message}`, "error");
            return { realEstateActive: false, dealsFoundToday: 0, highScoreLeads: 0, tradingActive: false };
        }
    }

    /**
     * Step 11 — Request Approval Flow
     * Inserts into pending_actions and sends Telegram message with /approve command
     */
    static async requestApproval(deal: Lead, bot: Telegraf): Promise<void> {
        try {
            const supabase = getSupabase();
            const profit = (deal.arv || 0) - (deal.price || 0) - (deal.repairs || 0);
            const roi = (deal.price || 0) > 0 ? (profit / (deal.price || 0)) * 100 : 0;

            const { data: record, error } = await supabase.from("pending_actions").insert({
                deal_id: deal.address,
                action: "contact_seller",
                payload: deal,
                status: "pending"
            }).select().single();

            if (error) throw error;

            const OWNER_CHAT_ID = Number(config.ownerId);
            const message = `
🏠 **DEAL READY**

📍 ${deal.address}
💰 Profit: $${profit.toLocaleString()}
📊 ROI: ${roi.toFixed(1)}%

Approve contacting seller?

/approve ${record.id}
/reject ${record.id}
            `;

            await bot.telegram.sendMessage(OWNER_CHAT_ID, message, { parse_mode: "Markdown" });
            log(`[supabaseCrm] 📩 Approval requested for deal: ${deal.address}`);
        } catch (err: any) {
            log(`[supabaseCrm] ❌ requestApproval failed: ${err.message}`, "error");
        }
    }

    /**
     * Retrieve a pending action by its ID
     */
    static async getPendingAction(id: number): Promise<any> {
        try {
            const supabase = getSupabase();
            const { data, error } = await supabase.from("pending_actions").select("*").eq("id", id).single();
            if (error) throw error;
            return data;
        } catch (err: any) {
            log(`[supabaseCrm] ❌ getPendingAction failed: ${err.message}`, "error");
            return null;
        }
    }

    /**
     * Update the status of a pending action
     */
    static async updatePendingAction(id: number, status: "approved" | "rejected"): Promise<void> {
        try {
            const supabase = getSupabase();
            const { error } = await supabase.from("pending_actions").update({ status }).eq("id", id);
            if (error) throw error;
            log(`[supabaseCrm] ✅ Action ${id} marked as ${status}`);
        } catch (err: any) {
            log(`[supabaseCrm] ❌ updatePendingAction failed: ${err.message}`, "error");
        }
    }
}
