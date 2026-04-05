import axios from "axios";
import { log } from "../core/config.js";
import { filterAndRankLeads, formatFilteredLeads, filterTopDeals, enrichLeadWithAI, calculateDealScore } from "./leadFilter.js";
import { CrmManager } from "../core/crm.js";
import { logEvent } from "../core/telemetry.js";

// Target markets
export const TARGET_MARKETS = {
  texas: [
    { city: "Houston", state: "TX", craigslist: "houston", county: "harris" },
    { city: "Dallas", state: "TX", craigslist: "dallas", county: "dallas" },
    { city: "San Antonio", state: "TX", craigslist: "sanantonio", county: "bexar" },
    { city: "Austin", state: "TX", craigslist: "austin", county: "travis" }
  ],
  ohio: [
    { city: "Columbus", state: "OH", craigslist: "columbus", county: "franklin" },
    { city: "Cleveland", state: "OH", craigslist: "clevleand", county: "cuyahoga" },
    { city: "Cincinnati", state: "OH", craigslist: "cincinnati", county: "hamilton" }
  ],
  virginia: [
    { city: "Richmond", state: "VA", craigslist: "richmond", county: "richmond" },
    { city: "Norfolk", state: "VA", craigslist: "norfolk", county: "norfolk" }
  ],
  brooklyn: [
    { city: "Brooklyn", state: "NY", craigslist: "newyork", county: "kings" }
  ]
};

export interface Lead {
  address: string;
  city: string;
  state: string;
  price?: number;
  source: string;
  type: string;
  url?: string;
  description?: string;
  postedDate?: string;
  distressSignals: string[];
  qualityScore?: number;
  dealScore?: number;
  maxOffer?: number;
  arv?: number;
  repairs?: number;
  lotSize?: number;
  
  // DQS Components (per user request)
  equityScore?: number;
  motivationScore?: number;
  marketScore?: number;
  conditionScore?: number;
  dataScore?: number;

  // AI Refinement (Step 7)
  aiCondition?: number; // 1-10
  aiUrgency?: "High" | "Medium" | "Low";
  aiSummary?: string; // Summary of seller intent

  // Profit Simulator (Step 10)
  estimated_offer?: number;
  repair_estimate?: number;
  closing_costs?: number;
  assignment_fee?: number;
  profit?: number;
  roi?: number;
  verdict?: "GOOD_DEAL" | "MARGINAL" | "BAD_DEAL";
}

const DISTRESS_KEYWORDS = [
  "motivated", "must sell", "price reduced", "as-is", "as is",
  "cash only", "investor special", "fixer", "needs work", "handyman",
  "foreclosure", "bank owned", "reo", "estate sale", "probate",
  "divorce", "relocating", "behind on payments", "pre-foreclosure",
  "fire damage", "water damage", "distressed", "quick sale", "urgent",
  "absentee owner", "tax delinquency", "inherited", "vacant", "code violation",
  "squatter", "eviction", "tired landlord", "non-paying tenant"
];

function scoreDistress(text: string): string[] {
  const lower = text.toLowerCase();
  return DISTRESS_KEYWORDS.filter(k => lower.includes(k));
}

/**
 * Heuristic: Estimate ARV if missing.
 * Distressed properties typically list at ~60-70% of market value.
 */
function estimateArv(price: number): number {
  return Math.round(price * 1.45); // Conservative "clean" value estimate
}

/**
 * Heuristic: Estimate Repairs if missing.
 * Defaulting to a range based on property price as a proxy for size/condition.
 */
function estimateRepairs(price: number): number {
  if (price < 100000) return 25000;
  if (price < 250000) return 45000;
  return 65000;
}

// Craigslist RSS
async function scrapeCraigslist(market: typeof TARGET_MARKETS.texas[0]): Promise<Lead[]> {
  const leads: Lead[] = [];
  const queries = ["motivated+seller", "as+is+cash", "fixer+upper+investor", "foreclosure+cash"];

  for (const query of queries) {
    try {
      const url = `https://${market.craigslist}.craigslist.org/search/rea?format=rss&srchType=T&query=${query}`;
      const res = await axios.get(url, {
        timeout: 8000,
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }
      });

      const items = res.data.match(/<item>([\s\S]*?)<\/item>/g) || [];
      for (const item of items.slice(0, 8)) {
        const title = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1] || "";
        const link = item.match(/<link>(.*?)<\/link>/)?.[1] || "";
        const desc = item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/)?.[1] || "";
        const date = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || "";
        const priceMatch = (title + desc).match(/\$[\d,]+/);
        const price = priceMatch ? parseInt(priceMatch[0].replace(/[$,]/g, "")) : undefined;

        leads.push({
          address: title,
          city: market.city,
          state: market.state,
          price,
          source: "Craigslist FSBO",
          type: "FSBO",
          url: link,
          description: desc.replace(/<[^>]+>/g, "").slice(0, 200),
          postedDate: date,
          distressSignals: scoreDistress(title + " " + desc)
        });
      }
    } catch (e: any) {
      log(`[scraper] Craigslist ${market.city}/${query} failed: ${e.message}`, "warn");
    }
  }
  return leads;
}

// HUD Home Store
async function scrapeHUD(state: string): Promise<Lead[]> {
  const leads: Lead[] = [];
  try {
    const res = await axios.get("https://www.hudhomestore.gov/HudHomes/GetHomes", {
      params: { state, page: 1, pageSize: 10, sortBy: "ListingPrice", sortOrder: "ASC" },
      timeout: 10000,
      headers: { "User-Agent": "Mozilla/5.0" }
    });

    const homes = res.data?.homes || res.data?.properties || [];
    for (const home of homes) {
      leads.push({
        address: home.streetAddress || home.address || "Unknown",
        city: home.city || "",
        state: home.state || state,
        price: home.listingPrice || home.price,
        source: "HUD Home Store",
        type: "HUD Foreclosure",
        url: `https://www.hudhomestore.gov/Listing/PropertyDetails.aspx?caseNumber=${home.caseNumber}`,
        description: `Case: ${home.caseNumber} | Beds: ${home.beds} | Baths: ${home.baths}`,
        distressSignals: ["foreclosure", "bank owned", "as-is"]
      });
    }
  } catch (e: any) {
    log(`[scraper] HUD ${state} failed: ${e.message}`, "warn");
  }
  return leads;
}

// Brave Search for Auction.com and real listing sites only
async function searchAuctions(market: typeof TARGET_MARKETS.texas[0]): Promise<Lead[]> {
  const leads: Lead[] = [];
  const queries = [
    `site:auction.com ${market.city} ${market.state} foreclosure`,
    `site:hubzu.com ${market.city} ${market.state}`,
    `site:bid4assets.com ${market.city} ${market.state}`,
    `motivated seller ${market.city} ${market.state} "cash only" OR "as-is" OR "must sell"`
  ];

  for (const query of queries) {
    try {
      const res = await axios.get("https://api.search.brave.com/res/v1/web/search", {
        params: { q: query, count: 5 },
        headers: {
          "Accept": "application/json",
          "Accept-Encoding": "gzip",
          "X-Subscription-Token": process.env.BRAVE_API_KEY || ""
        },
        timeout: 8000
      });

      const results = res.data?.web?.results || [];
      for (const r of results) {
        const distressSignals = scoreDistress(r.title + " " + (r.description || ""));
        leads.push({
          address: r.title,
          city: market.city,
          state: market.state,
          source: "Auction.com / Web",
          type: "Foreclosure/Auction",
          url: r.url,
          description: r.description?.slice(0, 200),
          distressSignals
        });
      }
    } catch (e: any) {
      log(`[scraper] Brave search failed: ${e.message}`, "warn");
    }
  }
  return leads;
}

// Auto-save quality leads to CRM
function autoSaveToCRM(leads: Lead[]): number {
  let saved = 0;
  for (const lead of leads) {
    if ((lead.qualityScore || 0) >= 5 && lead.distressSignals.length >= 2) {
      try {
        CrmManager.addDeal({
          address: lead.address,
          arv: 0,
          repair_estimate: 0,
          max_offer: 0,
          profit: 0,
          status: "lead",
          notes: `Source: ${lead.source} | Signals: ${lead.distressSignals.join(", ")} | URL: ${lead.url || "N/A"}`
        });
        saved++;
      } catch (e: any) {
        log(`[scraper] CRM save failed for ${lead.address}: ${e.message}`, "warn");
      }
    }
  }
  if (saved > 0) log(`[scraper] Auto-saved ${saved} leads to CRM`);
  return saved;
}

// Main export
export async function findMotivatedSellers(
  targetState?: string,
  targetCity?: string,
  saveToCRM = true
): Promise<Lead[]> {
  const allDeals: Lead[] = [];

  let markets: any[] = [];

  if (targetState || targetCity) {
    const stateUpper = targetState?.toUpperCase();
    for (const marketList of Object.values(TARGET_MARKETS)) {
      for (const m of marketList) {
        if (
          (stateUpper && m.state === stateUpper) ||
          (targetCity && m.city.toLowerCase().includes(targetCity.toLowerCase()))
        ) {
          markets.push(m);
        }
      }
    }
  } else {
    markets = Object.values(TARGET_MARKETS).flat();
  }

  log(`[scraper] Searching ${markets.length} markets...`);

  // Run all in parallel
  const marketPromises = markets.map(async (market) => {
    const [craigslist, auctions] = await Promise.allSettled([
      scrapeCraigslist(market),
      searchAuctions(market)
    ]);
    if (craigslist.status === "fulfilled") allDeals.push(...craigslist.value);
    if (auctions.status === "fulfilled") allDeals.push(...auctions.value);
  });

  const states = [...new Set(markets.map(m => m.state))];
  const hudPromises = states.map(async (state) => {
    const hudLeads = await scrapeHUD(state);
    allDeals.push(...hudLeads);
  });

  await Promise.allSettled([...marketPromises, ...hudPromises]);

  log(`[scraper] Raw leads: ${allDeals.length} — enriching with heuristics...`);

  // Stage 1: Basic Heuristic Enrichment (ARV/Repairs)
  const baseEnriched = allDeals.map(deal => {
    const price = deal.price || 0;
    const arv = deal.arv || (price > 0 ? estimateArv(price) : 0);
    const repairs = deal.repairs || (price > 0 ? estimateRepairs(price) : 0);
    return { ...deal, arv, repairs };
  });

  // Stage 2: AI Enrichment (Step 7)
  // To be efficient, we only AI-enrich leads that pass a basic scoring threshold
  if (!baseEnriched || baseEnriched.length === 0) {
    log(`[scraper] No leads found to analyze. Skipping AI enrichment.`);
    return [];
  }

  log(`[scraper] Running AI analysis for ${baseEnriched.length} leads...`);
  const enrichedWithAI: Lead[] = [];
  
  // Concurrency-limited parallel enrichment
  const CONCURRENCY = 5;
  for (let i = 0; i < baseEnriched.length; i += CONCURRENCY) {
    const batch = baseEnriched.slice(i, i + CONCURRENCY);
    const enrichedBatch = await Promise.all(batch.map(async (lead) => {
      // Small optimization: Calculate a 'pre-score' to see if it's worth AI-enriching
      // We skip AI if it's clearly junk (No price, no signals)
      const preScore = calculateDealScore(lead);
      if (preScore < 20) return lead; // Don't waste tokens on clearly bad leads

      const aiData = await enrichLeadWithAI(lead);
      const enriched = { ...lead, ...aiData };
      
      // Recalculate score with AI data
      calculateDealScore(enriched); 
      return enriched;
    }));
    enrichedWithAI.push(...enrichedBatch);
  }

  // Filter and rank: Only 80+ "Hot List" and 60-79 "Watchlist"
  const topDeals = filterTopDeals(enrichedWithAI);
  log(`[scraper] Hot deals found: ${topDeals.filter(d => (d.dealScore || 0) >= 80).length}`);

  // Auto-save to CRM
  if (saveToCRM) autoSaveToCRM(topDeals);

  // Telemetry: Log Top Deals
  for (const deal of topDeals) {
    const estProfit = (deal.arv || 0) - (deal.price || 0) - (deal.repairs || 0);
    await logEvent({
      type: "deal_found",
      source: "real_estate_agent",
      message: "High-motivation property found",
      data: {
        address: deal.address,
        score: deal.dealScore || deal.qualityScore || 0,
        est_profit: estProfit
      }
    }).catch(e => log(`[telemetry] Failed to log deal: ${e.message}`, "warn"));
  }

  return allDeals; // Per user request "return allDeals"
}

export { formatFilteredLeads as formatLeads };
