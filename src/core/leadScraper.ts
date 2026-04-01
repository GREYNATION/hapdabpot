import axios from "axios";
import { log, config } from "./config.js";

// Target markets — wide net
export const TARGET_MARKETS = {
  texas: [
    { city: "Houston", state: "TX", craigslist: "houston", county: "harris" },
    { city: "Dallas", state: "TX", craigslist: "dallas", county: "dallas" },
    { city: "San Antonio", state: "TX", craigslist: "sanantonio", county: "bexar" },
    { city: "Austin", state: "TX", craigslist: "austin", county: "travis" }
  ],
  ohio: [
    { city: "Columbus", state: "OH", craigslist: "columbus", county: "franklin" },
    { city: "Cleveland", state: "OH", craigslist: "cleveland", county: "cuyahoga" },
    { city: "Cincinnati", state: "OH", craigslist: "cincinnati", county: "hamilton" }
  ],
  virginia: [
    { city: "Richmond", state: "VA", craigslist: "richmond", county: "richmond" },
    { city: "Norfolk", state: "VA", craigslist: "norfolk", county: "norfolk" },
    { city: "Virginia Beach", state: "VA", craigslist: "norfolk", county: "virginia-beach" }
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
}

// Distress signal keywords
const DISTRESS_KEYWORDS = [
  "motivated", "must sell", "price reduced", "as-is", "as is",
  "cash only", "investor special", "fixer", "needs work", "handyman",
  "foreclosure", "bank owned", "reo", "estate sale", "probate",
  "divorce", "relocating", "behind on payments", "pre-foreclosure",
  "fire damage", "water damage", "distressed", "quick sale", "urgent"
];

function scoreDistress(text: string): string[] {
  const lower = text.toLowerCase();
  return DISTRESS_KEYWORDS.filter(k => lower.includes(k));
}

// Craigslist FSBO RSS scraper
async function scrapeCraigslist(market: any): Promise<Lead[]> {
  const leads: Lead[] = [];

  try {
    const urls = [
      `https://${market.craigslist}.craigslist.org/search/rea?format=rss&hasPic=0&srchType=T&query=motivated+seller`,
      `https://${market.craigslist}.craigslist.org/search/rea?format=rss&hasPic=0&srchType=T&query=as+is+cash`,
      `https://${market.craigslist}.craigslist.org/search/rea?format=rss&hasPic=0&srchType=T&query=fixer+upper+investor`
    ];

    for (const url of urls) {
      try {
        const res = await axios.get(url, {
          timeout: 8000,
          headers: { "User-Agent": "Mozilla/5.0 (compatible; LeadBot/1.0)" }
        });

        // Parse RSS XML manually
        const items = res.data.match(/<item>([\s\S]*?)<\/item>/g) || [];

        for (const item of items.slice(0, 5)) {
          const title = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1] || "";
          const link = item.match(/<link>(.*?)<\/link>/)?.[1] || "";
          const desc = item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/)?.[1] || "";
          const date = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || "";

          // Extract price
          const priceMatch = (title + desc).match(/\$[\d,]+/);
          const price = priceMatch ? parseInt(priceMatch[0].replace(/[$,]/g, "")) : undefined;

          const distressSignals = scoreDistress(title + " " + desc);

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
            distressSignals
          });
        }
      } catch (e: any) {
        log(`[scraper] Craigslist ${url} failed: ${e.message}`, "warn");
      }
    }
  } catch (e: any) {
    log(`[scraper] Craigslist ${market.city} failed: ${e.message}`, "warn");
  }

  return leads;
}

// HUD Home Store API
async function scrapeHUD(state: string): Promise<Lead[]> {
  const leads: Lead[] = [];

  try {
    const res = await axios.get("https://www.hudhomestore.gov/HudHomes/GetHomes", {
      params: {
        state,
        page: 1,
        pageSize: 10,
        sortBy: "ListingPrice",
        sortOrder: "ASC"
      },
      timeout: 10000,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; LeadBot/1.0)" }
    });

    // Handle standard HUD common structure
    const data = res.data;
    const homes = data?.homes || data?.properties || data?.results || [];

    for (const home of homes) {
      leads.push({
        address: home.streetAddress || home.address || "Unknown",
        city: home.city || "",
        state: home.state || state,
        price: home.listingPrice || home.price,
        source: "HUD Home Store",
        type: "HUD Foreclosure",
        url: `https://www.hudhomestore.gov/Listing/PropertyDetails.aspx?caseNumber=${home.caseNumber}`,
        description: `Case: ${home.caseNumber} | Beds: ${home.beds} | Baths: ${home.baths} | Sqft: ${home.squareFeet}`,
        distressSignals: ["foreclosure", "bank owned", "as-is"]
      });
    }
  } catch (e: any) {
    log(`[scraper] HUD ${state} failed: ${e.message}`, "warn");
  }

  return leads;
}

// Brave Search fallback for Auction.com and other sources
async function searchMotivatedSellers(market: any): Promise<Lead[]> {
  const leads: Lead[] = [];
  const apiKey = config.braveApiKey;

  if (!apiKey) {
    log(`[scraper] Skipping Brave search for ${market.city}: BRAVE_API_KEY is missing.`, "warn");
    return leads;
  }

  const queries = [
    `motivated seller ${market.city} ${market.state} cash offer site:auction.com`,
    `foreclosure ${market.city} ${market.state} site:auction.com`,
    `distressed property ${market.city} ${market.state} investor cash`
  ];

  for (const query of queries) {
    try {
      const res = await axios.get("https://api.search.brave.com/res/v1/web/search", {
        params: { q: query, count: 5 },
        headers: {
          "Accept": "application/json",
          "Accept-Encoding": "gzip",
          "X-Subscription-Token": apiKey
        },
        timeout: 8000
      });

      const results = res.data?.web?.results || [];
      for (const r of results) {
        const distressSignals = scoreDistress(r.title + " " + (r.description || ""));
        if (distressSignals.length > 0) {
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
      }
    } catch (e: any) {
      log(`[scraper] Brave search failed for query '${query}': ${e.message}`, "warn");
    }
  }

  return leads;
}

// Rank leads by distress signal count
function rankLeads(leads: Lead[]): Lead[] {
  return leads
    .filter(l => l.distressSignals.length > 0 || l.type.includes("Foreclosure") || l.type.includes("HUD"))
    .sort((a, b) => b.distressSignals.length - a.distressSignals.length);
}

// Format leads for Telegram
export function formatLeads(leads: Lead[], limit = 5): string {
  if (leads.length === 0) return "No motivated seller leads found right now. Try again shortly.";

  const top = leads.slice(0, limit);
  const lines = top.map((l, i) => {
    const price = l.price ? `$${l.price.toLocaleString()}` : "Price N/A";
    const signals = l.distressSignals.length > 0 ? l.distressSignals.slice(0, 3).join(", ") : "foreclosure";
    return [
      `${i + 1}. ${l.address}`,
      `   ${l.city}, ${l.state} | ${price}`,
      `   Source: ${l.source} | ${l.type}`,
      `   Signals: ${signals}`,
      l.url ? `   ${l.url}` : null
    ].filter(Boolean).join("\n");
  });

  return `Found ${leads.length} leads (top ${limit} shown):\n\n` + lines.join("\n\n");
}

// Main export — search all markets in parallel
export async function findMotivatedSellers(
  targetState?: string,
  targetCity?: string
): Promise<Lead[]> {
  const allLeads: Lead[] = [];

  // Determine which markets to search
  let markets: any[] = [];

  if (targetState || targetCity) {
    const stateUpper = targetState?.toUpperCase();
    for (const [, marketList] of Object.entries(TARGET_MARKETS)) {
      for (const m of marketList) {
        if (
          (stateUpper && m.state === stateUpper) ||
          (targetCity && m.city.toLowerCase().includes(targetCity.toLowerCase()))
        ) {
          markets.push(m);
        }
      }
    }
  }

  // Default: search all markets
  if (markets.length === 0) {
    markets = Object.values(TARGET_MARKETS).flat();
  }

  log(`[scraper] Searching ${markets.length} markets in parallel...`);

  // Run all sources in parallel per market
  const promises = markets.map(async (market) => {
    const [craigslist, brave] = await Promise.allSettled([
      scrapeCraigslist(market),
      searchMotivatedSellers(market)
    ]);

    if (craigslist.status === "fulfilled") allLeads.push(...craigslist.value);
    if (brave.status === "fulfilled") allLeads.push(...brave.value);
  });

  // HUD per state in parallel
  const states = [...new Set(markets.map(m => m.state))];
  const hudPromises = states.map(state => scrapeHUD(state as string));

  await Promise.allSettled([...promises, ...hudPromises.map(async (p) => {
    const result = await p;
    allLeads.push(...result);
  })]);

  log(`[scraper] Total raw leads: ${allLeads.length}`);
  return rankLeads(allLeads);
}
