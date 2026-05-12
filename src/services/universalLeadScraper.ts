import axios from 'axios';
import * as cheerio from 'cheerio';
import { log, config } from "../core/config.js";
import { chromium } from 'playwright';
import { useStealth } from 'playwright-stealth';
import { filterAndRankLeads, formatFilteredLeads, filterTopDeals, enrichLeadWithAI, calculateDealScore, scoreListingQuality } from "./leadFilter.js";
import { CrmManager } from "../core/crm.js";
import { logEvent } from "../core/telemetry.js";
import { logScraperError, saveLeadToObsidian } from "./vaultService.js";
import { healthManager } from "./sourceHealth.js";
import { BraveSearch } from "./braveSearch.js";
import { FirecrawlService } from "./firecrawlService.js";

const stealthAxios = axios.create({
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://www.google.com/',
  },
  timeout: 10000
});

// Rate-limit helper: 7.5s between AI calls = max 8 req/min
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

// 🛡️ SAFE GUARD: Wraps any promise with a hard timeout to prevent hanging scraper tasks
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`[timeout] ${label} exceeded ${ms}ms`)), ms)
  );
  return Promise.race([promise, timeout]);
}

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
    { city: "Cleveland", state: "OH", craigslist: "cleveland", county: "cuyahoga" },
    { city: "Cincinnati", state: "OH", craigslist: "cincinnati", county: "hamilton" }
  ],
  virginia: [
    { city: "Richmond", state: "VA", craigslist: "richmond", county: "richmond" },
    { city: "Norfolk", state: "VA", craigslist: "norfolk", county: "norfolk" }
  ],
  brooklyn: [
    { city: "Brooklyn", state: "NY", craigslist: "newyork", county: "kings" }
  ],
  newjersey: [
    { city: "Camden", state: "NJ", craigslist: "southjersey", county: "camden" },
    { city: "Trenton", state: "NJ", craigslist: "cnj", county: "mercer" },
    { city: "Newark", state: "NJ", craigslist: "newjersey", county: "essex" }
  ],
  philadelphia: [
    { city: "Philadelphia", state: "PA", craigslist: "philadelphia", county: "philadelphia" }
  ]
};

import type { Lead } from "../types/lead.js";
export type { Lead };

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
  const lower = String(text || "").toLowerCase();
  return DISTRESS_KEYWORDS.filter(k => (lower ?? "")?.includes(k));
}

function estimateArv(price: number): number {
  return Math.round(price * 1.45);
}

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
      const res = await stealthAxios.get(url);
      const items = (typeof res.data === 'string' ? res.data : String(res.data || "")).match(/<item>([\s\S]*?)<\/item>/g) || [];
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

// Brave Search
export async function searchAuctions(marketInput: any, activeOnly: boolean = false, options: any = {}): Promise<Lead[]> {
  const SOURCE_NAME = 'Brave Search';
  let market = marketInput;
  if (typeof marketInput === 'string') {
    for (const list of Object.values(TARGET_MARKETS)) {
      const found = list.find((m: any) => (m.city || "").toLowerCase() === marketInput.toLowerCase());
      if (found) {
        market = found;
        break;
      }
    }
    if (typeof market === 'string') {
        market = { city: marketInput, state: "OH", craigslist: "cleveland", county: "cuyahoga" };
    }
  }

  const leads: Lead[] = [];
  
  if (!healthManager.isHealthy(SOURCE_NAME)) {
    log(`[scraper] ${SOURCE_NAME} is on cooldown, skipping auction search for ${market.city}`, "warn");
    return leads;
  }

  const queries = [
    `site:auction.com ${market.city} ${market.state} foreclosure`,
    `site:hubzu.com ${market.city} ${market.state}`,
    `site:bid4assets.com ${market.city} ${market.state}`,
    `motivated seller ${market.city} ${market.state} "cash only" OR "as-is" OR "must sell"`
  ];

  for (const query of queries) { 
    try {
      const data = await BraveSearch.search(query, 5);
      const results = data.web?.results || [];
      
      for (const r of results) {
        const distressSignals = scoreDistress((r.title || "") + " " + (r.description || ""));
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
      log(`[scraper] Brave search failed for query "${query}": ${e.message}`, "warn");
      logScraperError("Brave Search / Auctions", e.message);
    }
  }
  return leads;
}

// Exported interfaces and functions
export async function findAuctionDeals(marketInput: any, activeOnly: boolean = true, options: any = {}) {
  return await searchAuctions(marketInput, activeOnly, options);
}

export async function scrapeCuyahogaSheriff(): Promise<Lead[]> {
  const leads: Lead[] = [];
  try {
    const url = "https://cpclerk.co.cuyahoga.oh.us/SheriffSale/";
    const res = await axios.get(url, { timeout: 10000 });
    const $ = cheerio.load(res.data);
    $('table tr').each((i: number, el: any) => {
      const text = ($(el).text() || "").toLowerCase();
      if ((text ?? "")?.includes('cleveland') || (text ?? "")?.includes('cuyahoga')) {
        const address = $(el).find('td').first().text().trim() || "Sheriff Sale Property";
        leads.push({
          address: address,
          city: "Cleveland",
          state: "OH",
          source: "Cuyahoga Sheriff Sale",
          type: "Sheriff Sale",
          url: url,
          distressSignals: ["sheriff sale", "foreclosure"]
        });
      }
    });
  } catch (e: any) {
    log(`[scraper] Cuyahoga Sheriff Sale failed: ${e.message}`, "warn");
  }
  return leads;
}

// 🛡️ Rotating User-Agents to avoid Zillow fingerprint detection
const ZILLOW_USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15',
];

export async function quickZillowSearch(zip: string): Promise<Lead[]> {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
  });

  try {
    const SOURCE_NAME = 'Zillow Stealth';
    if (!healthManager.isHealthy(SOURCE_NAME)) {
      log(`[zillow-stealth] Source is on cooldown, skipping ZIP ${zip}`, "warn");
      return [];
    }

    const ua = ZILLOW_USER_AGENTS[Math.floor(Math.random() * ZILLOW_USER_AGENTS.length)];
    const context = await browser.newContext({
      userAgent: ua,
      viewport: { width: 1280, height: 720 },
      locale: 'en-US',
      timezoneId: 'America/New_York',
    });

    // 🛡️ Mask navigator.webdriver — this is the primary Zillow bot detector
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      // Also mask common automation tells
      (window as any).chrome = { runtime: {} };
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
    });

    const page = await context.newPage();
    const url = `https://www.zillow.com/homes/${zip}_rb/?searchQueryState={"filterState":{"fsba":{"value":true},"fsbo":{"value":true}}}`;

    let lastErr: any;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        log(`[zillow-stealth] Navigating to Zillow for ZIP ${zip} (Attempt ${attempt})...`);
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await page.waitForTimeout(3000);
        try {
          await Promise.race([
            page.waitForSelector('.list-card-addr', { timeout: 5000 }),
            page.waitForSelector('article[data-test="property-card"]', { timeout: 5000 })
          ]);
        } catch (e) {
          log(`🛡️ Zillow blocked the view or no houses found for ${zip}.`, "warn");
        }

        const leads = await page.evaluate(() => {
          const results: any[] = [];
          const cards = document.querySelectorAll('article[data-test="property-card"]');
          cards.forEach(card => {
            const address = card.querySelector('address')?.textContent || "Unknown Address";
            const priceText = card.querySelector('[data-test="property-card-price"]')?.textContent || "0";
            const price = parseInt(priceText.replace(/[$,]/g, '')) || 0;
            const url = (card.querySelector('a[data-test="property-card-link"]') as HTMLAnchorElement)?.href || "";
            const details = card.querySelector('[data-test="property-card-details"]')?.textContent || "";

            if (address !== "Unknown Address") {
              results.push({
                address,
                price,
                url,
                description: details,
                source: "Zillow (Stealth)",
                distressSignals: ["FSBO", "Direct"],
                type: "For Sale By Owner"
              });
            }
          });
          return results;
        });

        healthManager.reportSuccess(SOURCE_NAME);
        return leads || [];
      } catch (err: any) {
        lastErr = err;
        log(`[zillow-stealth] Attempt ${attempt} failed for ${zip}: ${err.message}`, "warn");
        healthManager.reportFailure(SOURCE_NAME, err.message);
        if (attempt < 2) await new Promise(r => setTimeout(r, 5000));
      }
    }
    throw new Error(`Zillow stealth scrape failed: ${lastErr?.message}`);
  } finally {
    await browser.close();
  }
}

export function autoSaveToCRM(leads: Lead[]) {
  leads.forEach(lead => {
    try {
      const dealId = CrmManager.addDeal({
        address: lead.address,
        city: lead.city,
        price: lead.price,
        arv: lead.arv,
        repair_estimate: lead.repairs,
        status: "lead",
        notes: lead.description || lead.source
      });
      saveLeadToObsidian(lead);
      log(`[scraper] Auto-saved lead to CRM & Vault: ${lead.address} (ID: ${dealId})`);
    } catch (err: any) {
      log(`[scraper] Failed to auto-save lead ${lead.address}: ${err.message}`, "error");
    }
  });
}

export async function deepResearchLead(lead: Lead): Promise<Lead> {
  try {
    log(`[research] Running deep AI research for ${lead.address}...`);
    const enrichment = await enrichLeadWithAI(lead);
    return { ...lead, ...enrichment } as Lead;
  } catch (e: any) {
    log(`[research] Deep research failed for ${lead.address}: ${e.message}`, "warn");
    return lead;
  }
}

export async function findMotivatedSellers(
  targetState?: string,
  targetCity?: string,
  targetZips?: string[],
  saveToCRM = true
): Promise<Lead[]> {
  try {
    const allDeals: Lead[] = [];
    let markets: any[] = [];

    if (targetState || targetCity) {
      const stateUpper = targetState?.toUpperCase();
      for (const marketList of Object.values(TARGET_MARKETS)) {
        for (const m of marketList) {
          if (
            (stateUpper && (m.state || "").toUpperCase() === stateUpper) ||
            (targetCity && (m.city || "").toLowerCase()?.includes(targetCity.toLowerCase()))
          ) {
            markets.push(m);
          }
        }
      }
      log(`[scraper] Searching ${markets.length} markets...`);
    }

    const zips = targetZips || [];
    if (zips.length > 0) {
      log(`[scraper] 🕵️‍♂️ Hermes is performing stealth mission for ${zips.length} ZIPs...`);
      for (const zip of zips) {
        // Try Zillow Stealth first
        try {
          if (healthManager.isHealthy('Zillow Stealth')) {
            const results = await withTimeout(quickZillowSearch(zip), 25000, `Zillow ZIP ${zip}`);
            if (results && results.length > 0) {
              allDeals.push(...results);
              healthManager.reportSuccess('Zillow Stealth');
              log(`[scraper] Zillow (Stealth) added ${results.length} leads for ZIP ${zip}`);
              continue; // Success, skip backup
            }
          }
        } catch (e: any) {
          log(`[scraper] Stealth Zillow failed for ${zip}: ${e.message}`, "warn");
          healthManager.reportFailure('Zillow Stealth', e.message);
        }

        // Backup: Firecrawl Search
        try {
          if (healthManager.isHealthy('Firecrawl')) {
            log(`[scraper] 🔄 Rotating to Firecrawl backup for ZIP ${zip}...`);
            const fcResults = await withTimeout(
              FirecrawlService.search(`site:zillow.com ${zip} for sale by owner`, 5),
              30000,
              `Firecrawl Search ZIP ${zip}`
            ) as any;
            
            if (fcResults && fcResults.data) {
              const fcLeads = fcResults.data.map((r: any) => ({
                address: r.title || "Unknown",
                city: targetCity || "",
                state: targetState || "",
                price: 0, 
                source: "Zillow (Firecrawl)",
                type: "For Sale",
                url: r.url,
                description: r.description || r.markdown?.slice(0, 200),
                distressSignals: scoreDistress(((r.description || "") + " " + (r.title || "")).toLowerCase())
              }));
              allDeals.push(...fcLeads);
              log(`[scraper] Firecrawl added ${fcLeads.length} leads for ZIP ${zip}`);
            }
          }
        } catch (fcErr: any) {
          log(`[scraper] Firecrawl backup also failed: ${fcErr.message}`, "error");
        }
      }
    }

    const marketPromises = markets.map(async (market) => {
      try {
        const results = await Promise.allSettled([
          scrapeCraigslist(market),
          searchAuctions(market)
        ]);
        results.forEach(res => {
          if (res.status === "fulfilled") allDeals.push(...(res.value || []));
        });
      } catch (err: any) {
        log(`[scraper] Market scrape failed for ${market?.city || 'unknown'}: ${err?.message}`, "warn");
      }
    });

    const states = markets.map(m => m.state?.toUpperCase());
    if (states.includes("OH")) {
      try {
        if (healthManager.isHealthy('Cuyahoga Sheriff')) {
          const clevelandResults = await withTimeout(scrapeCuyahogaSheriff(), 15000, "Cuyahoga Sheriff Sale");
          if (Array.isArray(clevelandResults)) {
            allDeals.push(...clevelandResults);
            healthManager.reportSuccess('Cuyahoga Sheriff');
          }
        }
      } catch (err: any) {
        log(`[scraper] Cuyahoga Sheriff Sale failed: ${err?.message}`, "warn");
        healthManager.reportFailure('Cuyahoga Sheriff', err.message);
      }
    }

    await Promise.allSettled(marketPromises);

    log(`[scraper] Raw leads: ${allDeals.length} — enriching with heuristics...`);

    const baseEnriched = allDeals
      .filter(lead => {
        if (lead && lead.address && typeof lead.address === 'string') {
          const addr = (lead.address ?? "").toLowerCase();
          if ((addr ?? "")?.includes('cleveland') || (addr ?? "")?.includes('oh') || (addr ?? "")?.includes('cuyahoga')) return true;
          if (targetCity) {
            const cityLower = (targetCity ?? "").toLowerCase();
            if (!(addr ?? "")?.includes(cityLower)) return false;
          }
          return true;
        }
        return false;
      })
      .map(deal => {
        const price = deal.price || 0;
        const arv = deal.arv || (price > 0 ? estimateArv(price) : 0);
        const repairs = deal.repairs || (price > 0 ? estimateRepairs(price) : 0);
        const enriched = { ...deal, arv, repairs };
        enriched.qualityScore = scoreListingQuality(enriched);
        enriched.dealScore = calculateDealScore(enriched);
        return enriched;
      }) as Lead[];

    const finalLeads = (baseEnriched || []).filter(l => l && l.address && (l.address || "").length > 5);

    if (finalLeads.length === 0) {
      log(`[scraper] No leads found to analyze.`);
      return [];
    }

    const qualityLeads = finalLeads.filter(l => (l.distressSignals || []).length >= 1);
    if (saveToCRM && qualityLeads.length > 0) autoSaveToCRM(qualityLeads);

    const topCandidates = qualityLeads
      .sort((a, b) => (b.dealScore || 0) - (a.dealScore || 0))
      .slice(0, 2);

    if (topCandidates.length > 0) {
      log(`[scraper] 🕵️ Running deep research on top candidates...`);
      for (const candidate of topCandidates) {
        const leadIndex = baseEnriched.findIndex(d => d.address === candidate.address);
        if (leadIndex !== -1) {
          const researched = await deepResearchLead(baseEnriched[leadIndex]);
          baseEnriched[leadIndex] = researched;
          baseEnriched[leadIndex].dealScore = calculateDealScore(baseEnriched[leadIndex]);
        }
      }
    }

    return baseEnriched;
  } catch (globalErr: any) {
    log(`[scraper] FATAL error in findMotivatedSellers: ${globalErr.message}`, "error");
    return [];
  }
}

export function formatLeads(leads: Lead[], limit = 5): string {
  if (leads.length === 0) return "No leads found. Try a different market.";
  const top = leads.slice(0, limit);
  let out = `🏡 **${leads.length} leads found**\n\n`;
  top.forEach((l, i) => {
    out += `${i + 1}. **${l.address}**\n`;
    out += `   📍 ${l.city}, ${l.state}\n`;
    out += `   💰 ${l.price ? "$" + l.price.toLocaleString() : "Price N/A"}\n`;
    out += `   🏷️ ${l.source} | ${l.type}\n`;
    if (l.distressSignals?.length) out += `   🚨 ${l.distressSignals.join(", ")}\n`;
    if (l.url) out += `   🔗 ${l.url}\n`;
    out += "\n";
  });
  return out;
}
