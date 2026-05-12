import OpenAI from 'openai';
import { getDb } from '../db/index.js';
import { insertGeneratedContent } from '../db/content.js';

export class AutomationService {
  private openai: OpenAI;
  private db = getDb();

  constructor() {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  /**
   * Scrape video content and convert to a high-retention script
   */
  async generateScriptFromVideo(videoUrl: string, niche: string = "Real Estate"): Promise<string> {
    console.log(`🎬 10x Pipeline: Converting ${videoUrl} into ${niche} script...`);
    
    const mockTranscription = "Hey guys, here is how I bought 3 houses with zero money down. Step 1, found a motivated seller. Step 2, used private money. Step 3, refinanced.";

    const prompt = `
      You are a world-class short-form content scriptwriter.
      Convert this transcription into a viral script for the "${niche}" niche.
      Transcription: ${mockTranscription}
      Structure:
      - Hook (First 3 seconds)
      - Value (Core content)
      - CTA (Follow for more)
    `;

    const response = await this.openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
    });

    const script = response.choices[0]?.message?.content || "Failed to generate script.";
    
    insertGeneratedContent(this.db, {
      niche,
      source_url: videoUrl,
      script,
      hook: script.split('\n')[0]
    });

    return script;
  }

  /**
   * Batch Generate 5 Scripts for the "Daily Output" goal
   */
  async batchGenerateScripts(niche: string, count: number = 5): Promise<string[]> {
    console.log(`🏭 Content Factory: Producing ${count} scripts for ${niche}...`);
    
    const scripts: string[] = [];
    for (let i = 0; i < count; i++) {
      const script = await this.generateScriptFromVideo(`batch_source_${i}`, niche);
      scripts.push(script);
    }
    return scripts;
  }

  /**
   * Analyze Sales Transcripts for Objection Handling (Step 5)
   */
  async analyzeSalesTranscripts(transcripts: string[]): Promise<string> {
    console.log(`💰 Conversion Lab: Analyzing ${transcripts.length} sales calls...`);
    
    const prompt = `
      Analyze these sales call transcripts and identify common objections.
      Suggest how to address these objections in the NEXT round of short-form content scripts.
      
      Transcripts: ${transcripts.join("\n\n---\n\n")}
    `;

    const response = await this.openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
    });

    return response.choices[0]?.message?.content || "Analysis failed.";
  }

  /**
   * AI Setter Qualification logic
   */
  async qualifyLead(lead: any, history: string[]): Promise<any> {
    const prompt = `
      You are an elite high-ticket appointment setter.
      Evaluate if this lead is a "Big Fish" business owner or a manual follow-up.
      
      Lead Data: ${JSON.stringify(lead)}
      Chat History: ${history.join("\n")}
      
      Return JSON:
      {
        "qualified": boolean,
        "reasoning": "string",
        "next_step": "string"
      }
    `;

    const response = await this.openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });

    return JSON.parse(response.choices[0]?.message?.content || "{}");
  }
}
