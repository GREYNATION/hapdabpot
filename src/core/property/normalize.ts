import { Property, PropertyDataSource } from "./types.js";

/**
 * Normalization Service for County Data Engine
 * Cleans and formats raw data from various sources into the Property model.
 */

export class PropertyNormalizer {
  /**
   * Normalize raw dollar strings e.g. "$123,456.00" -> 123456
   */
  static parseCurrency(val: any): number | undefined {
    if (typeof val === "number") return val;
    if (!val || typeof val !== "string") return undefined;
    
    const cleaned = val.replace(/[$,\s]/g, "");
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? undefined : parsed;
  }

  /**
   * Basic Address Standardizer (Upper Case + Clean whitespace)
   */
  static normalizeAddress(address: string): string {
    return address.toUpperCase().replace(/\s+/g, " ").trim();
  }

  /**
   * Map raw scraped data to the Property model
   */
  static fromRawScrape(raw: any, source: PropertyDataSource): Property {
    return {
      address: this.normalizeAddress(raw.address || raw.PropertyAddress || ""),
      city: (raw.city || raw.City || "Unknown").trim(),
      state: (raw.state || raw.State || "").trim().toUpperCase(),
      zip: raw.zip || raw.ZipCode,
      
      owner: (raw.owner || raw.OwnerName || "Unknown Owner").trim(),
      assessedValue: this.parseCurrency(raw.assessedValue || raw.assessed_value || raw.AssessedValue),
      lastSalePrice: this.parseCurrency(raw.lastSalePrice || raw.last_sale_price || raw.LastSalePrice),
      
      debt: this.parseCurrency(raw.debt || raw.TotalDebt || raw.total_debt),
      auctionPrice: this.parseCurrency(raw.auctionPrice || raw.auction_price || raw.AuctionPrice),
      
      source,
      lastScrapedAt: new Date().toISOString(),
    };
  }
}
