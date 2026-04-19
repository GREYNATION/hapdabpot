import { Property } from "../../property/types.js";
import { ApifyService } from "../../../services/apifyService.js";

/**
 * Georgia County Surplus Connector (Apify Managed)
 */
export async function getGeorgiaCountyData(): Promise<Property[]> {
  await ApifyService.triggerScan("GA", "");
  return []; // Background scan - results arrive via webhook
}
