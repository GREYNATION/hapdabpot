// Lead quality filter — blocks aggregators, scores real seller listings
import { Lead } from "./universalLeadScraper.js";
import { askAI } from "../core/ai.js";
import { config } from "../core/config.js";

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
  "duplex", "acre", "floors"
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
  let score = 3; // Baseline
  const domain = getDomain(lead.url);
  const content = (lead.address + " " + (lead.description || "")).toLowerCase();

  // 1. Domain Check
  if (BLOCKED_DOMAINS.some(d => domain.includes(d))) return 0;
  if (TRUSTED_DOMAINS.some(d => domain.includes(d))) score += 5;

  // 2. Listing Signals (+1 each)
  LISTING_SIGNALS.forEach(s => {
    if (content.includes(s)) score += 1;
  });

  // 3. Noise Signals (-2 each)
  NOISE_SIGNALS.forEach(s => {
    if (content.includes(s)) score -= 2;
  });

  // 4. Entity Checks (Simple titles like "10 Best..." are low quality)
  if (lead.address.split(" ").length < 3) score -= 2;
  if (/^(\d+ )?best|top|how to/i.test(lead.address)) score -= 5;
  
  // 5. Seller/Source Check
  if (lead.source.includes("FSBO")) score += 2;
  if (lead.source.includes("Direct")) score += 3;

  return score;
}

export function filterAndRankLeads(leads: Lead[], minScore = 3): Lead[] {
  return leads
    .filter(l => !!l.price) // ❌ Price: N/A
    .map(l => ({ ...l, qualityScore: scoreListingQuality(l) }))
    .filter(l => (l.qualityScore || 0) >= minScore)
    .sort((a, b) => (b.qualityScore || 0) - (a.qualityScore || 0));
}

export function calculateDealScore(lead: Lead): number {
  // 1. Equity Score (0–30 pts)
  let equityScore = 0;
  if (lead.arv && lead.price && lead.arv > 0) {
    const margin = (lead.arv - lead.price) / lead.arv;
    if (margin >= 0.40) equityScore = 30;       // 🔥 Huge Spread
    else if (margin >= 0.30) equityScore = 20;  // ✅ Good Equity
    else if (margin >= 0.20) equityScore = 10;  // ⚠️ Tight but okay
  }

  // 2. Motivation Score (0–30 pts)
  let motivationScore = 0;
  const strongSignals = ["probate", "foreclosure", "tax delinquency", "absentee", "vacant", "pre-foreclosure"];
  const mediumSignals = ["motivated", "must sell", "price reduced", "estate sale", "quick sale"];
  
  lead.distressSignals.forEach(signal => {
    const s = signal.toLowerCase();
    if (strongSignals.some(high => s.includes(high))) motivationScore += 10;
    else if (mediumSignals.some(mid => s.includes(mid))) motivationScore += 5;
    else motivationScore += 2;
  });
  motivationScore = Math.min(30, motivationScore);

  // 3. Condition Score (0–15 pts)
  let conditionScore = 0;
  if (lead.repairs !== undefined && lead.price) {
    const repairRatio = lead.repairs / lead.price;
    if (repairRatio < 0.10) conditionScore = 15;      // Cosmetic only
    else if (repairRatio < 0.25) conditionScore = 10; // Moderate repairs
    else if (repairRatio < 0.50) conditionScore = 5;  // Heavy lift
  }

  // 4. Market Score (0–15 pts)
  let marketScore = 0;
  const highDemandCities = ["Houston", "Brooklyn", "Columbus", "Cleveland", "Richmond"];
  if (highDemandCities.some(c => (lead.city || "").includes(c))) marketScore = 15;
  else marketScore = 10;

  // 5. Data Score (0–10 pts)
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
  
  const finalScore = Math.min(100, totalScore + aiBoost);
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
    
    const analysis = JSON.parse(aiResponse.content);
    return {
      aiCondition: analysis.aiCondition,
      aiUrgency: analysis.aiUrgency,
      aiSummary: analysis.aiSummary
    };
  } catch (err: any) {
    console.error(`[ai-lead] Enrichment failed: ${err.message}`);
    return {};
  }
}

export function tagDeal(deal: Lead): string {
  const score = deal.dealScore || 0;
  if (score >= 80) return "🔥 HOT DEAL";
  if (score >= 60) return "⚠️ WATCHLIST";
  return "❌ FILTERED";
}

export function formatTopDeal(deal: Lead): string {
  const score = deal.dealScore || 0;
  const tag = tagDeal(deal);
  const profitPotential = (deal.arv || 0) - (deal.price || 0) - (deal.repairs || 0);

  const aiSummary = deal.aiSummary ? `\n🤖 **AI Summary:** ${deal.aiSummary}\n` : "";
  const signals = deal.distressSignals.length > 0 ? `\n🚨 **Signals:** ${deal.distressSignals.join(", ")}` : "";

  return `
${tag} (Score: ${score}/100)

📍 **${deal.address}**
💰 Price: $${(deal.price || 0).toLocaleString()}
📈 ARV: $${(deal.arv || 0).toLocaleString()}
🔧 Repairs: $${(deal.repairs || 0).toLocaleString()}

💵 **Max Offer:** $${(deal.maxOffer || 0).toLocaleString()}
🔥 **Est Profit:** $${profitPotential.toLocaleString()}
${aiSummary}${signals}

${score >= 80 ? "✅ **ACTION:** Contact Seller Immediately" : "⏳ **ACTION:** Monitor for price drops"}
🔗 [View Listing](${deal.url})
`;
}

/**
 * Step 10 — Deal Flipping Calculator (Profit Simulator)
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
  let report = `🎯 **Found ${leads.length} quality leads** (out of ${leads.length} initially found)\n\n`;

  topLeads.forEach((lead, i) => {
    const signals = lead.distressSignals.length > 0 
      ? `\n🚨 Signals: ${lead.distressSignals.join(", ")}` 
      : "";
    
    report += `${i + 1}. **${lead.address}**\n` +
              `💰 Price: ${lead.price ? "$" + lead.price.toLocaleString() : "N/A"}\n` +
              `📍 Location: ${lead.city}, ${lead.state}\n` +
              `🏗️ Type: ${lead.type} | ⭐ Score: ${lead.qualityScore}${signals}\n` +
              `🔗 [View Listing](${lead.url})\n\n`;
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
  const t = text.toLowerCase();
  if (t.includes("yes")) return "interested";
  if (t.includes("not")) return "not_interested";
  return "unknown";
}
