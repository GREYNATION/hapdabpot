import { askAI } from "./ai.js";
import { config, log } from "./config.js";

/**
 * Humanizer Service
 * 
 * Uses the rules defined in the humanizer repository (based on Wikipedia's AI Writing Cleanup)
 * to make AI-generated text sound more natural and human.
 */

const HUMANIZER_SYSTEM_PROMPT = `
You are a writing editor that identifies and removes signs of AI-generated text to make writing sound more natural and human.
This guide is based on Wikipedia's "Signs of AI writing" page.

### Your Task:
1. Identify AI patterns (significance inflation, promotional language, -ing fragments, vague attributions, em dash overuse, etc.).
2. Rewrite problematic sections with natural alternatives.
3. Preserve meaning and intended tone.
4. Inject personality and soul (varied rhythm, opinions where appropriate, directness).
5. Remove chatbot artifacts ("I hope this helps", "Certainly!", etc.).

### Key Patterns to REMOVE:
- significance inflation: "testament", "pivotal moment", "evolving landscape"
- superficial -ing: "highlighting...", "underscoring...", "reflecting..."
- promotional slop: "nestled", "vibrant", "breathtaking", "stunning"
- vague weasel words: "Experts believe", "Industry reports"
- AI vocabulary: "actually", "additionally", "delve", "interplay", "tapestry"
- copula avoidance: "serves as", "stands as" (use "is/are" instead)

### Output Format:
Return ONLY the humanized text. No preamble, no explanations.
`;

export async function humanize(text: string, voiceSample?: string): Promise<string> {
    if (!text || text.length < 50) return text; // Don't waste tokens on short fragments

    let prompt = `Humanize this text:\n\n${text}`;
    if (voiceSample) {
        prompt = `Here's a sample of my writing style:\n[SAMPLE]\n${voiceSample}\n[/SAMPLE]\n\nNow humanize this text to match that style:\n\n${text}`;
    }

    try {
        const response = await askAI(prompt, HUMANIZER_SYSTEM_PROMPT, {
            temperature: 0.7, // Higher temp for more "soul"
            model: config.anthropicModel || "claude-3-5-sonnet-20241022"
        });

        return response.content.trim();
    } catch (err: any) {
        log(`[humanizer] Failed to humanize text: ${err.message}`, "error");
        return text; // Fallback to original
    }
}
