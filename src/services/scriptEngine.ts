import { ScoredTrend } from "./trendScanner.js";
import { askAI } from "../core/ai.js";
import { log } from "../core/config.js";

export interface ScriptPackage {
    trend: ScoredTrend;
    script: string;
    brollPrompt: string;
    voiceProfile: string; // The selected ElevenLabs voice ID or OpenAI voice name
    cta: string;
}

export class AdaptiveScriptEngine {
    
    // Cache the most recently generated scripts so the HyperFrames Engine can access them
    static lastGeneratedScripts: { [trendId: string]: ScriptPackage } = {};

    /**
     * Generates a fully optimized cinematic script and production metadata based on a viral trend.
     */
    static async generateScript(trend: ScoredTrend): Promise<ScriptPackage | null> {
        log(`[ScriptEngine] 🎬 Generating Adaptive Script for trend: ${trend.title}`);
        
        // Match avatar/voice style to the genre
        let voiceProfile = "alloy";
        let styleGuidelines = "";
        
        switch (trend.genre) {
            case "comedy":
                voiceProfile = "shimmer"; // Snarky, energetic
                styleGuidelines = "Fast-paced, witty, sarcastic, punchy jokes, relatable humor.";
                break;
            case "educational":
                voiceProfile = "onyx"; // Calm, authoritative
                styleGuidelines = "Clear, articulate, mind-blowing facts, structured pacing, intellectual but accessible.";
                break;
            case "conspiracy":
                voiceProfile = "echo"; // Mysterious
                styleGuidelines = "Mysterious, asking questions, dramatic pauses, intense, cliffhangers.";
                break;
            case "motivational":
                voiceProfile = "nova"; // Warm, energetic
                styleGuidelines = "Uplifting, high-energy, direct eye contact feel, inspiring, pushing the viewer to action.";
                break;
            case "drama":
                voiceProfile = "fable"; // Emotional
                styleGuidelines = "Emotional, storytelling, high stakes, tension building.";
                break;
            default:
                voiceProfile = "alloy";
                styleGuidelines = "Engaging, standard TikTok pacing.";
        }

        const prompt = `
            You are a master TikTok/YouTube Shorts scriptwriter. 
            Write a 30-60 second viral script based on this trending topic:
            Topic: ${trend.title}
            Description: ${trend.description}
            Audience: ${trend.targetAudience}
            
            CRITICAL REQUIREMENTS:
            1. Use this exact hook at the very beginning (proven 65% retention boost): "${trend.hookIdea}"
            2. Genre Tone: ${trend.genre.toUpperCase()}. ${styleGuidelines}
            3. Must include a Call to Action (CTA) at the end for passive income (e.g., "Check the link in bio", "Follow for part 2", "Comment your thoughts").
            
            FORMAT REQUIREMENTS:
            Respond ONLY with a valid JSON object matching this exact schema, with no markdown formatting:
            {
                "script": "The spoken words of the script here",
                "cta": "The specific call to action you included",
                "brollPrompt": "A highly detailed, cinematic prompt for MidJourney/Runway ML to generate the background B-roll for this video. Focus on hyper-realistic lighting and action."
            }
        `;

        try {
            const aiResponse = await askAI(prompt, "You are an elite short-form scriptwriter. Return ONLY raw JSON.");
            
            // Clean up the JSON if the model added markdown blocks or conversational text
            let cleanJson = aiResponse.content.replace(/```json/gi, "").replace(/```/g, "").trim();
            const match = cleanJson.match(/\{[\s\S]*\}/);
            if (match) {
                cleanJson = match[0];
            }
            
            // Fix trailing commas if any
            cleanJson = cleanJson.replace(/,\s*([\]}])/g, '$1');

            const parsed = JSON.parse(cleanJson);
            
            const scriptPackage: ScriptPackage = {
                trend,
                script: parsed.script,
                brollPrompt: parsed.brollPrompt,
                voiceProfile: voiceProfile,
                cta: parsed.cta
            };

            // Cache it using the trend title as a rough ID
            this.lastGeneratedScripts[trend.title] = scriptPackage;

            return scriptPackage;
        } catch (err: any) {
            log(`[ScriptEngine] ❌ Script generation failed: ${err.message}`, "error");
            return null;
        }
    }
}
