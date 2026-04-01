import axios from "axios";
import { openai, config, log } from "../core/config.js";

/**
 * Standalone vision agent that calls Groq directly.
 * Bypasses the shared askAI function to ensure multimodal content is properly formatted.
 */
export async function visionAgent(multimodalPrompt: any[]) {
    const systemPrompt = `Analyze this property image and return:

{
  "condition": "good | average | bad",
  "estimated_repairs": number,
  "deal_rating": 1-10,
  "reason": "short explanation"
}`;

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
            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: "openai/gpt-4o", // ✅ FIXED
                    messages: [
                        { role: "system", content: systemPrompt },
                        {
                            role: "user",
                            content: [
                                { type: "text", text: userText },
                                {
                                    type: "image_url",
                                    image_url: imagePart.image_url
                                }
                            ]
                        }
                    ]
                })
            });

            const data = await response.json();
            const result = data.choices?.[0]?.message?.content;
            log(`[visionAgent] Analysis complete. Result length: ${result?.length}`);
            return result || "❌ Model returned no content.";

        } catch (err: any) {
            const isRateLimit = err.status === 429 || err.message?.includes("429") || err.message?.includes("retry");
            if (isRateLimit && attempt < MAX_RETRIES) {
                const wait = 5000 * attempt;
                log(`[visionAgent] Rate limited. Retrying in ${wait / 1000}s... (attempt ${attempt}/${MAX_RETRIES})`);
                await new Promise(r => setTimeout(r, wait));
            } else {
                log(`[visionAgent] Failed: ${err.message}`, "error");
                console.log("⚠️ Vision failed, fallback to text");

                try {
                    const fallbackResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                        method: "POST",
                        headers: {
                            "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            model: "openai/gpt-4o",
                            messages: [
                                { role: "system", content: systemPrompt },
                                { role: "user", content: "Analyze deal based on text only: " + userText }
                            ]
                        })
                    });
                    const fallbackData = await fallbackResponse.json();
                    return fallbackData.choices?.[0]?.message?.content || "❌ Fallback text model returned no content.";
                } catch (fallbackErr: any) {
                    return `❌ Visual analysis and text fallback failed: ${fallbackErr.message}`;
                }
            }
        }
    }

    return "❌ Analysis timed out after multiple retries.";
}
