import { Property } from "../../property/types.js";
import { PropertyNormalizer } from "../../property/normalize.js";

/**
 * Camden County, NJ Connector
 * Specialized for local auction and tax data.
 */
export async function getCamdenCountyData(): Promise<Property[]> {
  // Placeholder for real fetch logic — currently returns mock data based on provided pattern
  // In production, this would hit the actual Camden County Tax/Assessor API
  const mockRawData = [
    {
      address: "456 Market St",
      city: "Camden",
      state: "NJ",
      owner: "Jane Smith",
      value: "$145,000.00",
      debt: "$80,000"
    },
    {
      address: "789 Broadway",
      city: "Camden",
      state: "NJ",
      owner: "Estate of Robert Brown",
      value: "$210,500",
      debt: "$190,000"
    }
  ];

  return mockRawData.map(p => PropertyNormalizer.fromRawScrape({
    address: p.address,
    city: p.city,
    state: p.state,
    owner: p.owner,
    assessedValue: p.value,
    debt: p.debt
  }, "county"));
}
