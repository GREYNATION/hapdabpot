import { FirecrawlService } from './firecrawlService.js';
import OpenAI from 'openai';

export class ResearchService {
  private firecrawl: FirecrawlService;
  private openai: OpenAI;

  constructor() {
    this.firecrawl = new FirecrawlService();
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  /**
   * Finds "outlier" content in a niche using Firecrawl Search
   */
  async findOutlierContent(niche: string) {
    console.log(`ðŸ” Research Hub: Hunting for outliers in ${niche}...`);
    
    // Search for high-engagement viral patterns
    const searchResult = await FirecrawlService.search(`viral top engagement ${niche} instagram reels twitter x trends 2024`);
    
    const prompt = `
      Analyze these search results and identify 3 "proven hooks" or "outlier formats" for the ${niche} niche.
      Focus on content with high view-to-follower ratios or viral patterns.
      
      Results: ${JSON.stringify(searchResult.results)}
      
      Return JSON:
      {
        "outliers": [
          { "hook": "string", "format": "Talking Head | Miro Board | Split Screen", "reason": "string" }
        ]
      }
    `;

    const response = await this.openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" }
    });

    return JSON.parse(response.choices[0]?.message?.content || "{}");
  }
}

