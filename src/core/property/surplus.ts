import { Property } from "./types.js";

/**
 * Surplus Detection Engine
 * Identifies high-value overage opportunities from foreclosure/tax sales.
 */

export interface SurplusDeal extends Property {
  surplus: number;
}

/**
 * Detects if a property has a significant surplus overage (> $10k)
 */
export function detectSurplus(property: Property): SurplusDeal | null {
  if (!property.auctionPrice || !property.debt) return null;

  const surplus = property.auctionPrice - property.debt;

  // Rule: Only process deals with a surplus greater than $10,000
  if (surplus > 10000) {
    return { ...property, surplus };
  }

  return null;
}

/**
 * Formats a surplus deal for the Telegram notification
 */
export function formatSurplusMessage(deal: SurplusDeal): string {
    return `
🏛️ **SURPLUS DEAL FOUND**

📍 **Address**: ${deal.address}
🏙️ **City**: ${deal.city}, ${deal.state}

💰 **Surplus (Overage)**: $${deal.surplus.toLocaleString()}
🏦 **Total Debt**: $${deal.debt?.toLocaleString() || 'Unknown'}
🔨 **Auction Price**: $${deal.auctionPrice?.toLocaleString() || 'Unknown'}

👤 **Owner**: ${deal.owner || 'Unknown'}
📞 **Phone**: ${deal.sourceId || 'Pending SkipTrace'}

⚡ **Status**: AI OUTREACH INITIATED
`;
}
