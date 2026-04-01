import { getSupabase } from "./supabaseMemory.js";
import { log } from "./config.js";
import { PropertyScraper } from "./scraper.js";
import { sendSms } from "../services/outreachService.js";

export interface SupabaseDeal {
    address: string;
    seller: string;
    phone: string;
    arv: number;
    repairs: number;
    max_offer: number;
    status?: string;
    stage?: string;
    profit?: number;
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
    static async insertDeal(data: {
        address: string;
        seller: string;
        phone: string;
        arv: number;
        repairs: number;
    }): Promise<{ success: boolean; error?: string }> {
        try {
            const maxOffer = this.calculateMaxOffer(data.arv, data.repairs);
            const supabase = getSupabase();

            const { error } = await supabase.from("deals").insert({
                address: data.address,
                seller: data.seller,
                phone: data.phone,
                arv: data.arv,
                repairs: data.repairs,
                max_offer: maxOffer
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
}
