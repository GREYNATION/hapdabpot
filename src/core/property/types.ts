/**
 * Core Property Model for Gravity Claw
 * Standardizes data from T1 aggregators (ATTOM), T2 hybrids, and T3 county scrapers.
 */

export type PropertyDataSource = "county" | "api" | "scraper" | "manual" | "external_webhook";

export interface Property {
  // Primary Identifiers
  address: string;
  city: string;
  state: string;
  zip?: string;
  apn?: string; // Assessor's Parcel Number

  // Financials
  owner?: string;
  assessedValue?: number;
  lastSalePrice?: number;
  equity?: number;
  debt?: number;
  
  // Distressed/Auction Metadata
  auctionPrice?: number;
  auctionDate?: string;
  surplusPotential?: number;

  // Source Metadata
  source: PropertyDataSource;
  sourceId?: string; // Internal ID from source system
  lastScrapedAt?: string;
  
  // Extended Context for AI Agents
  notes?: string;
  tags?: string[];
}

/**
 * Lead extension - includes status and scoring
 */
export interface PropertyLead extends Property {
  leadId: string;
  score: number; // 0-100 ranking
  status: "new" | "analyzing" | "skip_traced" | "outreach" | "hot" | "dead";
  assignmentId?: string; // Match with a buyer
}

/**
 * Match result for buyer-to-lead pairing
 */
export interface PropertyMatch {
  propertyId: string;
  buyerId: string;
  matchScore: number;
  reasoning: string;
}
