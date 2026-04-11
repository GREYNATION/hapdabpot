import { CrmManager } from "../core/crm.js";
import { askAI } from "../core/ai.js";
import { log } from "../core/config.js";

/**
 * InsightsAgent
 * Analyzes deal patterns to identify success and failure drivers.
 */
export class InsightsAgent {
    static async generateMarketInsights(): Promise<string> {
        log("[insights] Generating deal pattern analysis...");

        try {
            // Fetch all deals (up to 100 for context)
            const deals = CrmManager.listDeals(100);

            if (deals.length < 5) {
                return "Not enough deal data yet to identify meaningful patterns. Keep closing deals!";
            }

            // Prepare a distilled version of the deals for the AI
            const dataSet = deals.map(d => ({
                address: d.address,
                city: d.city,
                arv: d.arv,
                profit: d.profit,
                surplus: d.surplus,
                status: d.status,
                outcome: d.outcome,
                last_call: d.last_call_status
            }));

            const prompt = `
            You are the "Clawsense" AI Analyst for a real estate investment firm.
            Analyze the following JSON dataset of recent deals and identify patterns.

            Data:
            ${JSON.stringify(dataSet, null, 2)}

            Tasks:
            1. Identify what characteristics (Price, ARV, Repairs, Location) lead to "Closed" vs "No Response".
            2. Detect any correlations between 'last_call_status' and final 'outcome'.
            3. Provide 3 actionable strategies for increasing the conversion rate.

            Format your response in professional Markdown with bullet points.
            `;

            const response = await askAI(
                prompt, 
                "You are a data scientist specialized in real estate acquisition patterns.",
                {
                    model: "meta-llama/llama-3.1-405b-instruct" // Use a powerful model for analysis via OpenRouter
                }
            );

            log("[insights] AI analysis complete.");
            return response.content;

        } catch (err: any) {
            log(`[insights] Analysis failed: ${err.message}`, "error");
            return "Internal Error: AI was unable to process the deal patterns at this time.";
        }
    }
}
