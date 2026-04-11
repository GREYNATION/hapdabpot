import { getCamdenCountyData } from "./connectors/camden.js";
import { getTexasCountyData } from "./connectors/texas.js";
import { getFloridaCountyData } from "./connectors/florida.js";
import { getGeorgiaCountyData } from "./connectors/georgia.js";
import { Property } from "../property/types.js";
import { log } from "../config.js";

/**
 * Universal County Property Aggregator
 * Entry point for harvesting property data from all active connectors.
 */
export async function getAllProperties(): Promise<Property[]> {
  log("[county] Starting global property aggregation...");
  
  try {
    const results = await Promise.allSettled([
      getCamdenCountyData(),
      getTexasCountyData(),
      getFloridaCountyData(),
      getGeorgiaCountyData()
    ]);

    // Filter successful results and flatten the arrays
    const allProperties = results
      .filter((res): res is PromiseFulfilledResult<Property[]> => res.status === "fulfilled")
      .map(res => res.value)
      .flat();

    log(`✅ Aggregation complete. Collected ${allProperties.length} properties from all connectors.`);
    
    return allProperties;
  } catch (err: any) {
    log(`[county] Critical aggregation failure: ${err.message}`, "error");
    return [];
  }
}
