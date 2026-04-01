// Lead quality filter — blocks aggregators, scores real seller listings
import { Lead } from "./universalLeadScraper.js";

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
    .map(l => ({ ...l, qualityScore: scoreListingQuality(l) }))
    .filter(l => (l.qualityScore || 0) >= minScore)
    .sort((a, b) => (b.qualityScore || 0) - (a.qualityScore || 0));
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
