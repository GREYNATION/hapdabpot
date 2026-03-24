import { ResearcherAgent } from '../agents/researcherAgent.js';
import { log } from './config.js';

export interface PropertyLead {
    address: string;
    ownerName: string;
    docDate: string;
    borough: string;
    notes: string;
}

export class PropertyScraper {
    private static researcher = new ResearcherAgent();

    /**
     * Finds recent properties that might be motivated sellers in a given area.
     */
    static async fetchLatestDeeds(location: string = 'Brooklyn', limit: number = 3): Promise<PropertyLead[]> {
        log(`[scraper] Searching for recent property deals in ${location} via AI...`);
        
        const prompt = `
            Find the top ${limit} most recent property transactions or motivated seller leads in ${location}.
            Use your web_search tool to look for:
            1. "Recently sold properties ${location}"
            2. "Motivated seller listings ${location}"
            3. "Notice of Defaults ${location}"

            Extract the following for each:
            - Address
            - Owner Name (if possible, or 'Unknown')
            - Recorded/Listed Date
            - A brief note about the lead (e.g. "Recently Sold", "Foreclosure", "Motivated Seller")

            Return the results as a JSON-like list in your response. Ensure the first line of each result is the Address.
        `;

        try {
            const response = await this.researcher.ask(prompt);
            const content = response.content;

            const leads: PropertyLead[] = [];

            // IMPROVED PARSER: Handle a wider range of address formats and suffixes
            const addressRegex = /\d+\s+[A-Z0-9][a-zA-Z0-9\s.,]+(?:Street|St|Ave|Avenue|Rd|Road|Blvd|Way|Dr|Drive|Ln|Lane|Pl|Place)(?:,\s*[A-Za-z\s]+)?/gi;
            const addressMatches = content.match(addressRegex) || [];
            
            for (const addr of addressMatches) {
                if (leads.length >= limit) break;
                
                const cleanAddr = addr.trim();
                const lead: PropertyLead = {
                    address: cleanAddr,
                    ownerName: "Owner Research Required",
                    docDate: new Date().toISOString().split('T')[0],
                    borough: location,
                    notes: "Discovered via AI Search"
                };
                
                if (!leads.some(l => l.address === cleanAddr)) {
                    leads.push(lead);
                }
            }

            // Fallback: If no regex matches, look for lines starting with a number
            if (leads.length === 0) {
                const lines = content.split('\n');
                for (const line of lines) {
                    if (leads.length >= limit) break;
                    const match = line.match(/^\d+\s+[A-Z0-9].*$/);
                    if (match) {
                        const addr = match[0].trim();
                        if (!leads.some(l => l.address === addr)) {
                            leads.push({
                                address: addr,
                                ownerName: "Owner Research Required",
                                docDate: new Date().toISOString().split('T')[0],
                                borough: location,
                                notes: "Discovered via AI Search (Line Match)"
                            });
                        }
                    }
                }
            }

            log(`[scraper] AI Search found ${leads.length} leads.`);
            return leads;

        } catch (error: any) {
            log(`[error] AI Scraper failed: ${error.message}`, "error");
            return [];
        }
    }
}
