// ============================================================
// Prediction Market Scanner Agent
// Fetches live markets from Polymarket (CLOB API) and applies
// signal filters: liquidity, volume, time, and edge detection
// ============================================================

import axios from "axios";
import OpenAI from "openai";
import { log } from "../core/config.js";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL,
});

// â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export type Market = {
    id: string;
    name: string;
    volume: number;       // 24h volume in USD
    liquidity: number;    // total liquidity in USD
    daysToResolve: number;
    priceChange: number;  // % change in best YES price over 24h
    bestYes: number;      // current best YES price (0â€“100)
    bestNo: number;       // current best NO price (0â€“100)
    url: string;
};

// â”€â”€ Polymarket CLOB API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const POLY_API = "https://gamma-api.polymarket.com";

async function fetchPolymarkets(limit = 100): Promise<Market[]> {
    try {
        const { data } = await axios.get(`${POLY_API}/markets`, {
            params: {
                active: true,
                closed: false,
                limit,
                order: "volume24hr",
                ascending: false,
            },
            timeout: 10_000,
        });

        const raw: any[] = Array.isArray(data) ? data : (data.markets ?? []);

        return raw.map((m: any): Market => {
            const endDate = m.endDate ? new Date(m.endDate) : null;
            const daysToResolve = endDate
                ? Math.max(0, Math.ceil((endDate.getTime() - Date.now()) / 86_400_000))
                : 999;

            const bestYes = parseFloat(m.bestAsk ?? m.outcomePrices?.[0] ?? "50");
            const bestNo  = parseFloat(m.bestBid  ?? m.outcomePrices?.[1] ?? "50");

            // priceChange: use oneDayPriceChange if available, else 0
            const priceChange = parseFloat(m.oneDayPriceChange ?? "0") * 100;

            return {
                id: m.conditionId ?? m.id ?? "",
                name: m.question ?? m.title ?? "Unknown",
                volume: parseFloat(m.volume24hr ?? m.volume ?? "0"),
                liquidity: parseFloat(m.liquidity ?? "0"),
                daysToResolve,
                priceChange,
                bestYes,
                bestNo,
                url: m.url ?? `https://polymarket.com/event/${m.slug ?? ""}`,
            };
        });
    } catch (err: any) {
        log(`[predMarket] âš ï¸  API fetch failed: ${err.message}`, "warn");
        return [];
    }
}

// â”€â”€ Signal Filters â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function liquidityFilter(markets: Market[]): Market[] {
    return markets.filter(m => m.liquidity > 50_000);
}

export function volumeFilter(markets: Market[]): Market[] {
    return markets.filter(m => m.volume > 10_000);
}

export function timeFilter(markets: Market[]): Market[] {
    return markets.filter(m => m.daysToResolve < 14);
}

export function edgeDetection(markets: Market[]): Market[] {
    return markets.filter(m => Math.abs(m.priceChange) > 3);
}

// â”€â”€ Pipeline: run all four filters in sequence â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function runPipeline(markets: Market[]): Market[] {
    let result = liquidityFilter(markets);
    result = volumeFilter(result);
    result = timeFilter(result);
    result = edgeDetection(result);
    return result;
}

// â”€â”€ Main entry point â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function scanMarkets(): Promise<{
    all: Market[];
    filtered: Market[];
}> {
    log("[predMarket] ðŸ” Fetching Polymarket live data...");
    const all = await fetchPolymarkets(200);
    const filtered = runPipeline(all);
    log(`[predMarket] âœ… ${all.length} markets fetched, ${filtered.length} passed all filters`);
    return { all, filtered };
}

// â”€â”€ Format for Telegram â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function formatMarketsReport(markets: Market[]): string {
    if (markets.length === 0) {
        return "ðŸ” No markets matched all filters right now. Try again later or adjust thresholds.";
    }

    const top = markets.slice(0, 8); // cap at 8 for readability
    const lines = top.map((m, i) => {
        const dir = m.priceChange > 0 ? "ðŸ“ˆ" : "ðŸ“‰";
        const urgency = m.daysToResolve <= 3 ? "ðŸ”¥" : m.daysToResolve <= 7 ? "âš¡" : "ðŸ“…";
        return (
            `${i + 1}. ${m.name.slice(0, 60)}${m.name.length > 60 ? "â€¦" : ""}\n` +
            `   ${dir} ${m.priceChange > 0 ? "+" : ""}${m.priceChange.toFixed(1)}% | ` +
            `YES: ${m.bestYes}Â¢ | ` +
            `Vol: $${(m.volume / 1000).toFixed(0)}K | ` +
            `Liq: $${(m.liquidity / 1000).toFixed(0)}K | ` +
            `${urgency} ${m.daysToResolve}d\n` +
            `   ðŸ”— ${m.url}`
        );
    });

    return (
        `ðŸ“Š PREDICTION MARKET SCANNER\n` +
        `â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”\n` +
        `Filters: Liq >$50K | Vol >$10K | <14 days | Edge >3%\n` +
        `Found ${markets.length} signal(s)\n\n` +
        lines.join("\n\n")
    );
}
// â”€â”€ AI Decision Layer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function analyzeWithAI(filteredMarkets: Market[]): Promise<string> {
    if (filteredMarkets.length === 0) {
        return "No filtered markets available for AI analysis.";
    }

    const slim = filteredMarkets.slice(0, 12).map(m => ({
        name: m.name,
        bestYes: m.bestYes,
        bestNo: m.bestNo,
        priceChange: `${m.priceChange > 0 ? "+" : ""}${m.priceChange.toFixed(1)}%`,
        volume: `$${(m.volume / 1000).toFixed(0)}K`,
        liquidity: `$${(m.liquidity / 1000).toFixed(0)}K`,
        daysToResolve: m.daysToResolve,
        url: m.url,
    }));

    try {
        const aiDecision = await openai.chat.completions.create({
            model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content:
                        "You are a professional prediction market trading analyst. " +
                        "Evaluate the markets and identify the single BEST opportunity. " +
                        "Consider: edge (price movement), liquidity depth, time urgency, and implied probability mispricing. " +
                        "Be concise. State which market, whether to buy YES or NO, why, and your confidence level.",
                },
                {
                    role: "user",
                    content:
                        `Analyze these markets and find the best opportunity:\n\n${JSON.stringify(slim, null, 2)}`,
                },
            ],
            max_tokens: 400,
            temperature: 0.3,
        });

        return aiDecision.choices[0]?.message?.content ?? "AI returned no analysis.";
    } catch (err: any) {
        log(`[predMarket] AI analysis failed: ${err.message}`, "warn");
        return `AI analysis unavailable: ${err.message}`;
    }
}

