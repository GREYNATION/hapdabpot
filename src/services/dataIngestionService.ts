import { Property } from "../core/property/types.js";
import { PropertyNormalizer } from "../core/property/normalize.js";
import { runAutomatedSurplusScan } from "./surplusPipeline.js";
import { log } from "../core/config.js";

/**
 * Data Ingestion Service
 * Handles property data pushed from external sources (Apify, Bright Data, etc.)
 */
export class DataIngestionService {
    /**
     * Processes a batch of raw property data from an external webhook
     */
    static async processExternalProperties(rawData: any[]): Promise<{ count: number; deals: number }> {
        log(`[ingestion] 📥 Received ${rawData.length} records from external scraper.`);

        if (!Array.isArray(rawData)) {
            throw new Error("Invalid payload: expected an array of property objects.");
        }

        // 1. Normalize all incoming data
        const normalizedProperties: Property[] = rawData.map(item => 
            PropertyNormalizer.fromRawScrape(item, "external_webhook")
        );

        log(`[ingestion] ✅ Normalized ${normalizedProperties.length} records.`);

        // 2. Trigger the Surplus Pipeline with the pre-harvested properties
        // We'll update surplusPipeline.ts to accept an optional property list
        const dealsFound = await runAutomatedSurplusScan(normalizedProperties);

        return {
            count: normalizedProperties.length,
            deals: dealsFound || 0
        };
    }
}
