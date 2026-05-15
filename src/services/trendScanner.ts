import axios from "axios";
import { config, log } from "../core/config.js";
import { askAI } from "../core/ai.js";
import { BraveSearch } from "./braveSearch.js";

export interface TrendData {
    title: string;
    description: string;
    url: string;
    platform: string;
}

export interface ScoredTrend extends TrendData {
    viralityScore: number;
    targetAudience: string;
    hookIdea: string;
    genre: "comedy" | "educational" | "conspiracy" | "motivational" | "drama";
}

/**
 * Trend Scanner Service (Phase 1)
 * Scrapes cross-platform trends and uses AI to predict virality.
 */
export class TrendScannerService {
    
    // Cache the most recent trends so the Script Engine can grab them
    static lastScoredTrends: ScoredTrend[] = [];

    /**
     * 1. Scrapes trends for a specific platform using Brave Search
     */
    static async scrapePlatformTrends(platform: string): Promise<TrendData[]> {
        log(`[TrendScanner] 🔍 Scanning ${platform} for trending topics...`);
        
        const query = `${platform} trending OR viral`;
        
        try {
            const data = await BraveSearch.search(query, 10);
            const results = data.web?.results || [];
            
            if (results.length === 0) {
                log(`[TrendScanner] ⚠️ Zero results for "${query}".`, "warn");
            }
            
            return results.map((r: any) => ({
                title: r.title,
                description: r.description,
                url: r.url,
                platform: platform
            }));
            
        } catch (error: any) {
            log(`[TrendScanner] ❌ Search failed: ${error.message}`, "error");
            return [];
        }
    }

    /**
     * 2. Engagement Prediction Engine: Ranks scraped trends based on viral potential
     */
    static async scoreTrends(trends: TrendData[]): Promise<ScoredTrend[]> {
        log(`[TrendScanner] 🤖 Scoring top 3 trends for virality (to avoid token limits)...`);
        
        if (trends.length === 0) return [];
        
        // Take only top 3 to prevent Groq 8B from cutting off midway
        const trendsToScore = trends.slice(0, 3);

        const prompt = `
            You are a hyper-analytical Viral Growth Expert for TikTok/Shorts.
            Analyze the following recent trending topics and predict their virality.
            
            For each trend, provide:
            1. viralityScore (1-100, where >90 is guaranteed viral)
            2. targetAudience (who cares about this)
            3. hookIdea (a 3-second hook to grab attention)
            4. genre (must be one of: comedy, educational, conspiracy, motivational, drama)

            Return EXACTLY a JSON array of objects with the keys:
            ["title", "description", "url", "platform", "viralityScore", "targetAudience", "hookIdea", "genre"]

            Trends to analyze:
            ${JSON.stringify(trendsToScore, null, 2)}
        `;

        try {
            const aiResponse = await askAI(prompt, "You are an elite viral marketing algorithm. Return ONLY raw JSON array.");
            
            // Clean up markdown formatting if present
            let cleanJson = aiResponse.content.replace(/```json/gi, "").replace(/```/g, "").trim();
            
            // Extract just the array portion in case the AI added conversational text
            const match = cleanJson.match(/\[[\s\S]*\]/);
            if (match) {
                cleanJson = match[0];
            }

            // Fix common trailing comma errors from smaller LLMs
            cleanJson = cleanJson.replace(/,\s*([\]}])/g, '$1');

            const scoredTrends: ScoredTrend[] = JSON.parse(cleanJson);
            
            // Sort by virality score descending
            scoredTrends.sort((a, b) => b.viralityScore - a.viralityScore);
            
            this.lastScoredTrends = scoredTrends;

            return scoredTrends;
        } catch (err: any) {
            log(`[TrendScanner] ❌ AI Scoring failed: ${err.message}`, "error");
            return [];
        }
    }
}
