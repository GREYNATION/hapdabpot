// Lead quality filter â€” blocks aggregators, scores real seller listings
import { Lead } from "../types/lead.js";
import { getStrategyContext } from "./vaultService.js";
import { askAI } from "../core/ai.js";
import { config, log } from "../core/config.js";
import { humanize } from "../core/humanizer.js";

// --- Types ----------------------------------------------------------------------

// Domains that are aggregators, directories, or not actual seller listings
export const BLOCKED_DOMAINS = [
  "alignable.com", "realestatewitch.com", "houzeo.com", "homelight.com",
  "realtor.com", "zillow.com", "redfin.com", "trulia.com", "homes.com",
  "movoto.com", "opendoor.com", "offerpad.com", "orchard.com",
  "bankrate.com", "nerdwallet.com", "investopedia.com", "thebalance.com",
  "biggerpockets.com", "connected investors.com", "connectedinvestors.com",
  "linkedin.com", "facebook.com", "twitter.com", "instagram.com",
  "yelp.com", "yellowpages.com", "angieslist.com", "thumbtack.com",
  "google.com", "bing.com", "yahoo.com",
  "wikipedia.org", "reddit.com", "quora.com",
  "snipesproperties.com", "sanantoniotexasnewhomesforsale.com",
  "we-buy-houses", "webuyhouses", "cashforhomes",
  "homevestors.com", "ibuyer.com"
];

// Domains that ARE real listing sources
export const TRUSTED_DOMAINS = [
  "craigslist.org",
  "auction.com",
  "hubzu.com",
  "bid4assets.com",
  "hudhomestore.gov",
  "govdeals.com",
  "propertyshark.com",
  "forsalebyowner.com",
  "fsbo.com"
];

// Keywords that indicate a real property listing vs an article
export const LISTING_SIGNALS = [
  "beds", "bath", "sqft", "lot", "asking", "price", "built", "garage",
  "kitchen", "roof", "yard", "basement", "detached", "multi-family",
  "duplex", "acre", "floors", "probate", "divorce", "death", "estate sale"
];

// Keywords that indicate "noise" (guides, top 10 lists, articles)
export const NOISE_SIGNALS = [
  "best real estate", "how to buy", "guide to", "top 10", "companies that",
  "review", "pros and cons", "vs", "rankings", "directory", "service",
  "near me", "calculator", "blog", "news", "updates"
];

function getDomain(url: string = ""): string {
  try {
    const domain = new URL(url).hostname.replace("www.", "");
    return domain;
  } catch {
    return "";
  }
}

export function scoreListingQuality(lead: Lead): number {
  if (!lead) return 0;
  let score = 3; // Baseline
  const domain = getDomain(lead.url);
  const content = ((lead.address || "") + " " + (lead.description || "")).toLowerCase();

  // 1. Domain Check
  if (BLOCKED_DOMAINS.some(d => (domain ?? "")?.includes(d))) return 0;
  if (TRUSTED_DOMAINS.some(d => (domain ?? "")?.includes(d))) score += 5;

  // 2. Listing Signals (+1 each)
  LISTING_SIGNALS.forEach(s => {
    if ((content ?? "")?.includes(s)) score += 1;
  });

  // 3. Noise Signals (-2 each)
  NOISE_SIGNALS.forEach(s => {
    if ((content ?? "")?.includes(s)) score -= 2;
  });

  // 4. Entity Checks (Simple titles like "10 Best..." are low quality)
  const address = lead.address || "";
  if (address.split(" ").length < 3) score -= 2;
  if (/^(\d+ )?best|top|how to/i.test(address)) score -= 5;
  
  // 5. Seller/Source Check
  const source = lead.source || "";
  if ((source ?? "")?.includes("FSBO")) score += 2;
  if ((source ?? "")?.includes("Direct")) score += 3;

  return score;
}

export function filterAndRankLeads(leads: Lead[], minScore = 3): Lead[] {
  return leads
    .filter(l => !!l.price) // âŒ Price: N/A
    .map(l => ({ ...l, qualityScore: scoreListingQuality(l) }))
    .filter(l => (l.qualityScore || 0) >= minScore)
    .sort((a, b) => (b.qualityScore || 0) - (a.qualityScore || 0));
}

export function calculateDealScore(lead: Lead): number {
  if (!lead) return 0;
  // 1. Equity Score (0â€“30 pts)
  let equityScore = 0;
  if (lead.arv && lead.price && lead.arv > 0) {
    const margin = (lead.arv - lead.price) / lead.arv;
    if (margin >= 0.40) equityScore = 30;       // ðŸ”¥ Huge Spread
    else if (margin >= 0.30) equityScore = 20;  // âœ… Good Equity
    else if (margin >= 0.20) equityScore = 10;  // âš ï¸ Tight but okay
  }

  // 2. Motivation Score (0â€“40 pts)
  let motivationScore = 0;
  const strongSignals = ["probate", "foreclosure", "tax delinquency", "absentee", "vacant", "pre-foreclosure"];
  const mediumSignals = ["motivated", "must sell", "price reduced", "estate sale", "quick sale", "divorce", "as-is", "handyman"];
  
  const signals = lead.distressSignals || [];
  const desc = (lead.description || "").toLowerCase();

  signals.forEach(signal => {
    if (!signal) return;
    const s = String(signal).toLowerCase();
    if (s && strongSignals.some(high => s?.includes(high))) motivationScore += 12;
    else if (s && mediumSignals.some(mid => s?.includes(mid))) motivationScore += 7;
    else if (s) motivationScore += 3;
  });

  // ðŸ§  AI Heuristic: Check description for "Emotional Distress" / Virality
  mediumSignals.forEach(word => {
    if ((desc ?? "")?.includes(word)) motivationScore += 5;
  });
  
  motivationScore = Math.min(40, motivationScore);

  // 3. Condition Score (0â€“15 pts)
  let conditionScore = 0;
  if (lead.repairs !== undefined && lead.price) {
    const repairRatio = lead.repairs / lead.price;
    if (repairRatio < 0.10) conditionScore = 15;      // Cosmetic only
    else if (repairRatio < 0.25) conditionScore = 10; // Moderate repairs
    else if (repairRatio < 0.50) conditionScore = 5;  // Heavy lift
  }

  // 4. Market Score (0â€“15 pts)
  let marketScore = 0;
  const highDemandCities = ["Houston", "Brooklyn", "Columbus", "Cleveland", "Richmond"];
  const city = (lead.city || "").toLowerCase();
  if (highDemandCities.some(c => (city ?? "")?.includes(c.toLowerCase()))) marketScore = 15;
  else marketScore = 10;

  // 5. Data Score (0â€“10 pts)
  let dataScore = 0;
  if (lead.price && lead.price > 0) dataScore += 5;
  if (lead.description && lead.description.length > 50) dataScore += 5;

  // Attach components to lead for transparency
  lead.equityScore = equityScore;
  lead.motivationScore = motivationScore;
  lead.marketScore = marketScore;
  lead.conditionScore = conditionScore;
  lead.dataScore = dataScore;

  const totalScore = equityScore + motivationScore + marketScore + conditionScore + dataScore;
  
  // AI-Driven Boosts (Step 7)
  let aiBoost = 0;
  if (lead.aiUrgency === "High") aiBoost += 15;
  if (lead.aiUrgency === "Medium") aiBoost += 5;
  if (lead.aiCondition !== undefined && lead.aiCondition <= 3) aiBoost += 10; // Heavy distress boost
  
  // 6. Adaptive Strategy Scoring (Obsidian Integration)
  const strategyRaw = getStrategyContext() || "";
  const strategy = strategyRaw.toLowerCase();
  let adaptiveBoost = 0;

  if (strategy.length > 0) {
    // Priority Check (e.g., "prioritize 44105")
    const zipStr = String(lead.zip || "");
    if (zipStr && (strategy ?? "")?.includes(zipStr) && (strategy ?? "")?.includes("prioritize")) {
      adaptiveBoost += 15;
    }
    
    // Ignore Check (e.g., "ignore mobile homes")
    const propertyType = (lead.type || "").toLowerCase();
    if (propertyType && (strategy ?? "")?.includes(propertyType) && (strategy ?? "")?.includes("ignore")) {
      adaptiveBoost -= 50;
    }

    // Keyword Boost (e.g., "love fixers", "love equity")
    const wordsToLove = ["fixer", "equity", "absentee", "motivated", "distress", "probate", "foreclosure"];
    const signalsText = (lead.distressSignals || []).join(" ").toLowerCase();
    const leadText = ((lead.address || "") + " " + (lead.description || "") + " " + (lead.type || "") + " " + signalsText).toLowerCase();
    
    wordsToLove.forEach(word => {
      if ((strategy ?? "")?.includes("love") && (strategy ?? "")?.includes(word) && (leadText ?? "")?.includes(word)) {
        adaptiveBoost += 10;
      }
    });
  }

  const finalScore = Math.max(0, Math.min(100, totalScore + aiBoost + adaptiveBoost));
  lead.dealScore = finalScore;
  
  return finalScore;
}

/**
 * AI Property Analysis: Interprets descriptions to extract intent, condition, and urgency.
 */
export async function enrichLeadWithAI(lead: Lead): Promise<Partial<Lead>> {
  if (!lead.description || lead.description.length < 20) return {};

  const systemPrompt = `You are a Real Estate Wholesaling Expert. 
Analyze the property description and extract structured data.
Rules:
- Infer property condition (1-10 scale where 1=gutted/fire damage, 10=pristine).
- Detect urgency of the seller (High, Medium, Low).
- Summarize seller intent in one brief sentence.
- Identify specific repair needs mentioned (e.g., "new roof", "foundation").

Format as JSON:
{
  "aiCondition": 5,
  "aiUrgency": "High",
  "aiSummary": "Seller needs to close by Friday due to foreclosure",
  "repairs": ["roof", "mold"]
}`;

  const prompt = `Property: ${lead.address}\nDescription: ${lead.description}`;

  try {
    const aiResponse = await askAI(prompt, systemPrompt, { 
      jsonMode: true, 
      model: config.openaiModel 
    });
    
    let analysis: any = {};
    try {
      analysis = typeof aiResponse.content === 'string' ? JSON.parse(aiResponse.content) : aiResponse.content;
    } catch (e) {
      log(`[leadFilter] AI returned invalid JSON: ${aiResponse.content}`, "warn");
      return lead;
    }
    
    // Humanize the AI-generated summary for better presentation
    const summaryToHumanize = analysis.aiSummary || lead.description || "";
    const humanizedSummary = await humanize(summaryToHumanize);

    return {
      aiCondition: analysis.aiCondition,
      aiUrgency: analysis.aiUrgency,
      aiSummary: humanizedSummary || analysis.aiSummary
    };
  } catch (err: any) {
    console.error(`[ai-lead] Enrichment failed: ${err.message}`);
    return {};
  }
}

export function tagDeal(deal: Lead): string {
  const score = deal.dealScore || 0;
  if (score >= 80) return "ðŸ”¥ HOT DEAL";
  if (score >= 60) return "âš ï¸ WATCHLIST";
  return "âŒ FILTERED";
}

export function formatTopDeal(deal: Lead): string {
  const score = deal.dealScore || 0;
  const tag = tagDeal(deal);
  const profitPotential = (deal.arv || 0) - (deal.price || 0) - (deal.repairs || 0);

  const aiSummary = deal.aiSummary ? `\nðŸ¤– **AI Summary:** ${deal.aiSummary}\n` : "";
  const signals = (deal.distressSignals || []).length > 0 ? `\nðŸš¨ **Signals:** ${deal.distressSignals.join(", ")}` : "";

  return `
${tag} (Score: ${score}/100)

ðŸ“ **${deal.address}**
ðŸ’° Price: $${(deal.price || 0).toLocaleString()}
ðŸ“ˆ ARV: $${(deal.arv || 0).toLocaleString()}
ðŸ”§ Repairs: $${(deal.repairs || 0).toLocaleString()}

ðŸ’µ **Max Offer:** $${(deal.maxOffer || 0).toLocaleString()}
ðŸ”¥ **Est Profit:** $${profitPotential.toLocaleString()}
${aiSummary}${signals}

${score >= 80 ? "âœ… **ACTION:** Contact Seller Immediately" : "â³ **ACTION:** Monitor for price drops"}
ðŸ”— [View Listing](${deal.url})
`;
}

/**
 * Step 10 â€” Deal Flipping Calculator (Profit Simulator)
 * This is the decision engine for actual financial feasibility.
 */
export function calculateDeal(deal: Lead): Lead {
  const arv = deal.arv || 0;
  // Use estimated_offer or fall back to current price
  const purchasePrice = deal.estimated_offer || deal.price || 0;
  const repairs = deal.repair_estimate || deal.repairs || 0;
  const closingCosts = deal.closing_costs || arv * 0.02;
  const assignmentFee = deal.assignment_fee || 10000;

  const totalCost = purchasePrice + repairs + closingCosts + assignmentFee;
  const profit = arv - totalCost;

  const roi = totalCost > 0 ? (profit / totalCost) * 100 : 0;

  let verdict: "GOOD_DEAL" | "MARGINAL" | "BAD_DEAL";
  if (profit > 15000 && roi > 20) {
    verdict = "GOOD_DEAL";
  } else if (profit > 5000) {
    verdict = "MARGINAL";
  } else {
    verdict = "BAD_DEAL";
  }

  return {
    ...deal,
    profit,
    roi,
    verdict
  };
}

export function filterTopDeals(leads: Lead[]): Lead[] {
  return leads
    .map(l => {
      const dealScore = calculateDealScore(l);
      // MAO Helper (conservative)
      const maxOffer = (l.arv || 0) * 0.7 - (l.repairs || 0);
      return { ...l, dealScore, maxOffer };
    })
    .filter(l => (l.dealScore || 0) >= 60) // Hard Filter: Ignore anything under 60
    .sort((a, b) => (b.dealScore || 0) - (a.dealScore || 0))
    .slice(0, 8); // Top 3-8 deals per user request
}

export function formatFilteredLeads(leads: Lead[], limit = 5): string {
  if (leads.length === 0) return "No high-quality leads found in the target markets.";

  const topLeads = leads.slice(0, limit);
  let report = `ðŸŽ¯ **Found ${leads.length} quality leads** (out of ${leads.length} initially found)\n\n`;

  topLeads.forEach((lead, i) => {
    const signals = (lead.distressSignals || []).length > 0 
      ? `\nðŸš¨ Signals: ${lead.distressSignals.join(", ")}` 
      : "";
    
    report += `${i + 1}. **${lead.address}**\n` +
              `ðŸ’° Price: ${lead.price ? "$" + lead.price.toLocaleString() : "N/A"}\n` +
              `ðŸ“ Location: ${lead.city}, ${lead.state}\n` +
              `ðŸ—ï¸ Type: ${lead.type} | â­ Score: ${lead.qualityScore}${signals}\n` +
              `ðŸ”— [View Listing](${lead.url})\n\n`;
  });

  if (leads.length > limit) {
    report += `\n*...and ${leads.length - limit} more higher-scoring deals.*`;
  }

  return report;
}

/**
 * Simple Rule-Based NLP for Lead Intent Classification
 */
export function classifyLead(text: string): "interested" | "not_interested" | "unknown" {
  const t = (text || "").toLowerCase();
  if ((t ?? "")?.includes("yes")) return "interested";
  if ((t ?? "")?.includes("not")) return "not_interested";
  return "unknown";
}

