import { Property } from "../../property/types.js";
import { ApifyService } from "../../../services/apifyService.js";

/**
 * Texas Foreclosure Auction Connector (Apify Managed)
 */
export async function getTexasCountyData(): Promise<Property[]> {
  await ApifyService.triggerScan("TX", "");
  return []; // Background scan - results arrive via webhook
}
