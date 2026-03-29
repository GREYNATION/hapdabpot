import axios from "axios";
import * as cheerio from "cheerio";

export interface Property {
  title: string;
  price: string;
  address: string;
  link: string;
}

export class PropertyScraper {
  static async scrapeListings(url: string): Promise<Property[]> {
    try {
      const { data } = await axios.get(url, {
        headers: {
          "User-Agent": "Mozilla/5.0"
        }
      });

      const $ = cheerio.load(data);
      const listings: Property[] = [];

      $(".property-card").each((_, el) => {
        listings.push({
          title: $(el).find(".title").text().trim(),
          price: $(el).find(".price").text().trim(),
          address: $(el).find(".address").text().trim(),
          link: $(el).find("a").attr("href") || ""
        });
      });

      return listings;

    } catch (error) {
      console.error("Scraping failed:", error);
      return [];
    }
  }
}