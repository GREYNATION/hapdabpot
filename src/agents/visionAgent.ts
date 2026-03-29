import axios from "axios";
import { openai, config, log } from "../core/config.js";

/**
 * Standalone vision agent that calls Groq directly.
 * Bypasses the shared askAI function to ensure multimodal content is properly formatted.
 */
export async function visionAgent(multimodalPrompt: any[]) {
    const systemPrompt = `You are a visual analysis expert. Examine the provided image carefully and describe exactly what you see. Include:
- Objects, people, text, or diagrams visible
- Layout and structure
- Colors and notable visual elements
- Any labels, titles, or annotations

Be thorough and precise.`;

    // Extract text from the multimodal prompt
    const userText = multimodalPrompt.find(p => p.type === "text")?.text || "Describe this image.";
    const imagePart = multimodalPrompt.find(p => p.type === "image_url");
    
    if (!imagePart) {
        return "âŒ No image data found in the request.";
    }

    log(`[visionAgent] Calling vision model: ${config.visionModel}`);

    const MAX_RETRIES = 3;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const completion = await openai.chat.completions.create({
                model: config.visionModel,
                messages: [
                    { role: "system", content: systemPrompt },
                    {
                        role: "user",
                        content: [
                            { type: "text", text: userText },
                            { type: "image_url", image_url: imagePart.image_url }
                        ]
                    }
                ],
                max_tokens: 1200,
            } as any);

            const result = completion.choices[0]?.message?.content;
            log(`[visionAgent] Analysis complete. Result length: ${result?.length}`);
            return result || "âŒ Model returned no content.";

        } catch (err: any) {
            const isRateLimit = err.status === 429 || err.message?.includes("429") || err.message?.includes("retry");
            if (isRateLimit && attempt < MAX_RETRIES) {
                const wait = 5000 * attempt;
                log(`[visionAgent] Rate limited. Retrying in ${wait / 1000}s... (attempt ${attempt}/${MAX_RETRIES})`);
                await new Promise(r => setTimeout(r, wait));
            } else {
                log(`[visionAgent] Failed: ${err.message}`, "error");
                return `âŒ Visual analysis failed: ${err.message}`;
            }
        }
    }

    return "âŒ Analysis timed out after multiple retries.";
}

