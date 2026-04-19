import { Property } from "../../property/types.js";
import { ApifyService } from "../../../services/apifyService.js";

/**
 * Florida Property Auction Connector (Apify Managed)
 */
export async function getFloridaCountyData(): Promise<Property[]> {
  await ApifyService.triggerScan("FL", "");
  return []; // Background scan - results arrive via webhook
}
