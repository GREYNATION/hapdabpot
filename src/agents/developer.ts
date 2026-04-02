import { askAI } from "../core/ai.js";
import { config } from "../core/config.js";

/**
 * Developer agent that acts as a COMPOSER.
 * It integrates Stitch UI data, Marketer copy, and the SiteBlueprint structural plan.
 */
export async function developerAgent(stitchUI: any, marketerCopy: any, siteBlueprint: any) {
  const systemPrompt = `
You are the Developer Agent. You are a strict COMPOSER.
Your goal is to integrate visual structure, marketing copy, and a structural blueprint into a complete functional project.

CRITICAL RULES:
1. You MUST NOT "figure out structure". Use the SiteBlueprint provided.
2. You MUST NOT invent copy. Use the Marketer Copy provided.
3. You MUST NOT invent the layout. Use the Stitch UI data as your visual guide.
4. Return a JSON object ONLY.

FORMAT:
{
  "files": [
    { "path": "package.json", "content": "..." },
    { "path": "src/App.js", "content": "..." },
    { "path": "README.md", "content": "..." }
  ]
}

INPUT DATA:
- SiteBlueprint: ${JSON.stringify(siteBlueprint)}
- Marketer Copy: ${JSON.stringify(marketerCopy)}
- Stitch UI Data: ${JSON.stringify(stitchUI)}

RULES:
- No explanations. No markdown.
- Generate a COMPLETE working React/Next.js (or specified technology) project.
- Integrate the Marketer headlines and CTAs into the corresponding components.
- Follow the Blueprint's component list exactly.
- Always include a README.md with launch instructions.
`;

  const response = await askAI("Compose the website code based on the provided data.", systemPrompt, {
    jsonMode: true, model: config.openaiModel || "google/gemini-2.0-flash-001"
  });

  if (!response || !response.content) {
    throw new Error("Developer agent failed to return content.");
  }

  try {
    const parsedResponse = JSON.parse(response.content);
    if (!parsedResponse.files) {
      throw new Error("Developer agent output missing 'files' field.");
    }
    return parsedResponse;
  } catch (err) {
    console.error("❌ COMPOSITION PARSE FAILED:", response.content);
    throw new Error("Developer agent did not return valid JSON");
  }
}

