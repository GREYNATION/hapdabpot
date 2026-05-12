import { AutomationService } from '../services/automationService.js';
import { ResearchService } from '../services/researchService.js';

const automation = new AutomationService();
const research = new ResearchService();

export async function runHyperAutomationFlow(flow: string, data: any) {
  switch (flow) {
    case "research_hub":
      // Step 1: Research Hub
      return await research.findOutlierContent(data.niche);

    case "scrape_to_script":
      // Step 2: AI Content Factory
      const script = await automation.generateScriptFromVideo(data.url, data.niche);
      return { script };

    case "batch_production":
      // Step 3: Distribution (5 scripts/day)
      const scripts = await automation.batchGenerateScripts(data.niche, data.count || 5);
      return { scripts };

    case "qualify":
      // Step 5: Conversion (AI Setter)
      const qualification = await automation.qualifyLead(data.lead, data.history);
      return { qualification };

    case "objection_analysis":
      // Step 5: Sales Script Adjustment
      const analysis = await automation.analyzeSalesTranscripts(data.transcripts);
      return { analysis };

    default:
      throw new Error(`Unknown flow: ${flow}`);
  }
}
