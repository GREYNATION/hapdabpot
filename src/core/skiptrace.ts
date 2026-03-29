import { BaseAgent } from "../agents/baseAgent.js";
import { ResearcherAgent } from "../agents/researcherAgent.js";
import { db } from "./memory.js";
import { log } from "./config.js";

export class SkipTracer {
    private static researcher = new ResearcherAgent();

    /**
     * Attempts to find contact info for a property owner using AI-powered search.
     */
    static async trace(ownerName: string, address: string): Promise<{ phone?: string, email?: string }> {
        const query = `Contact information (phone, email) for property owner ${ownerName} at ${address}`;
        log(`[skiptrace] Starting AI skip trace for: ${ownerName} at ${address}...`);

        try {
            const prompt = `
                I have a real estate lead: ${ownerName} at ${address}.
                Use your web_search tool to find potential contact information (phone numbers, professional emails, or social profiles) for this individual.
                Look for:
                1. Whitepages-style listings.
                2. Professional profiles (LinkedIn, Real Estate licenses).
                3. Business registrations associated with the address.

                CRITICAL: 
                - If you find multiple potential numbers, list the most recent/likely ones.
                - If you find no direct matches, check and report if the owner is an LLC.
                - Return your findings as a concise JSON-like summary in your thought process, but summarize clearly in text.
            `;

            const response = await this.researcher.ask(prompt);
            const content = response.content;

            // Extract potential phone/email using regex from the agent's text response
            const phoneMatch = content.match(/(\+?\d{1,2}\s?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/);
            const emailMatch = content.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);

            const result = {
                phone: phoneMatch ? phoneMatch[0] : undefined,
                email: emailMatch ? emailMatch[0] : undefined
            };

            log(`[skiptrace] Trace result: Phone=${result.phone || 'N/A'}, Email=${result.email || 'N/A'}`);
            return result;

        } catch (error: any) {
            log(`[error] Skip trace failed: ${error.message}`, "error");
            return {};
        }
    }

    /**
     * Updates a deal in the database with skip trace results.
     */
    static async updateLeadWithContact(dealId: number, contact: { phone?: string, email?: string }) {
        if (!contact.phone && !contact.email) return;

        try {
            const stmt = db.prepare(`
                UPDATE deals 
                SET seller_phone = ?, seller_name = coalesce(seller_name, ?)
                WHERE id = ?
            `);
            // Note: We don't have a dedicated email field in the basic schema yet, 
            // but we can store phone for now.
            stmt.run(contact.phone || null, null, dealId);
            log(`[skiptrace] Updated deal ${dealId} with contact info.`);
        } catch (error: any) {
            log(`[error] Failed to update lead in DB: ${error.message}`, "error");
        }
    }
}

