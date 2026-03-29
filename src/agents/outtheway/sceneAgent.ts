// ============================================================
// OUT THE WAY â€” Scene Agent
// Converts episodes into visual + dialogue prompts per scene
// Ensures consistent character appearance and cinematic tone
// ============================================================

import { BaseAgent } from "../baseAgent.js";
import { log } from "../../core/config.js";
import { CHARACTERS } from "./types.js";
import type { Episode, Scene, AgentEvent } from "./types.js";
import type { MonitoringAgent } from "./monitoringAgent.js";

export class SceneAgent extends BaseAgent {
    private monitor: MonitoringAgent;

    constructor(monitor: MonitoringAgent) {
        super("SceneAgent", "");
        this.monitor = monitor;
    }

    getName(): string { return "SceneAgent"; }

    getSystemPrompt(): string {
        const characterAppearances = Object.values(CHARACTERS)
            .map(c => `â€¢ ${c.name}: ${c.appearance}`)
            .join("\n");

        return `You are the Scene Agent for "Out the Way" â€” a vertical short-form AI drama series.

Your job is to enhance each scene from a story episode with:
1. A detailed AI video generation prompt (vertical 9:16 format, cinematic, ultra-specific)
2. A voice synthesis prompt capturing emotion, pacing, and tone
3. Character appearance notes for visual consistency

CHARACTER APPEARANCE REFERENCE (always keep these consistent):
${characterAppearances}

VISUAL PROMPT RULES:
- Always specify: "vertical 9:16 framing, cinematic, high contrast, urban aesthetic"
- Include lighting (night = neon/street lights, day = natural harsh sun)
- Include shot type (close-up, medium, over-shoulder, dutch angle)
- Include emotion in character body language
- Be hyper-specific â€” every word in the prompt matters for AI generation

DIALOGUE/VOICE RULES:
- Specify speaking character's name, emotional state, pacing (slow/fast/hushed)
- Include any background ambiance (traffic, music, silence)

Return ONLY valid JSON â€” an array of enhanced Scene objects.`;
    }

    private emit(status: AgentEvent["status"], message: string): void {
        this.monitor.report({ agent: "scene", status, message, timestamp: "" });
    }

    async enhanceScenes(episode: Episode): Promise<Scene[]> {
        this.emit("active", `Enhancing ${episode.scenes.length} scenes for episode ${episode.episodeNumber}`);
        log(`[scene] Processing ${episode.scenes.length} scenes for ep ${episode.episodeNumber}`);

        const prompt = `Here is episode ${episode.episodeNumber} of "Out the Way": "${episode.title}"

Synopsis: ${episode.synopsis}

Scenes to enhance:
${JSON.stringify(episode.scenes, null, 2)}

For each scene, enhance or generate:
- "visualPrompt": Ultra-detailed AI video gen prompt (vertical 9:16, cinematic, character consistent)
- "dialoguePrompt": Voice synthesis context (which character, emotion, pacing, ambiance)

Return ONLY a JSON array of the full enhanced scene objects (same structure, just with better prompts). No markdown.`;

        try {
            const response = await this.ask(prompt);
            const rawContent = response.content?.trim() ?? "";
            const jsonStr = rawContent.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
            const enhancedScenes: Scene[] = JSON.parse(jsonStr);

            this.emit("completed", `${enhancedScenes.length} scenes enhanced for episode ${episode.episodeNumber}`);
            log(`[scene] âœ… ${enhancedScenes.length} scenes enhanced`);
            return enhancedScenes;

        } catch (err: any) {
            this.emit("failed", `Scene enhancement failed: ${err.message}`);
            log(`[scene] âŒ Failed: ${err.message}`, "error");
            throw err;
        }
    }
}

