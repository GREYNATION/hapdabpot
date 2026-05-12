import axios from "axios";

/**
 * Scraper Service
 */
export class ScraperService {
  /**
   * Read website content as text
   */
  static async readUrl(url: string) {
    try {
      const response = await axios.get(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        },
        timeout: 15000
      });
      
      return {
        url,
        content: response.data,
        status: response.status
      };
    } catch (error: any) {
      throw new Error(`Scraping failed for ${url}: ${error.message}`);
    }
  }
}
