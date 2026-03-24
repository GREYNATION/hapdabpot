// ============================================================
// OUT THE WAY — Story Agent
// Generates full episodes with hook, scenes, and cliffhanger
// Maintains continuity for characters: Jace, Nia, and Rel
// ============================================================

import fs from "fs";
import path from "path";
import { BaseAgent } from "../baseAgent.js";
import { log } from "../../core/config.js";
import { CHARACTERS } from "./types.js";
import type { Episode, Scene, AgentEvent } from "./types.js";
import type { MonitoringAgent } from "./monitoringAgent.js";

const DATA_DIR = path.join(process.cwd(), "data", "outtheway", "episodes");

export class StoryAgent extends BaseAgent {
    private monitor: MonitoringAgent;

    constructor(monitor: MonitoringAgent) {
        super("StoryAgent", "");
        this.monitor = monitor;
    }

    getName(): string { return "StoryAgent"; }

    getSystemPrompt(): string {
        return `You are the Story Agent for "Out the Way" — a vertical short-form AI drama series.

Your job is to generate complete, emotionally driven episodes centered on three characters:

${Object.values(CHARACTERS).map(c =>
    `• ${c.name}: ${c.role}\n  Appearance: ${c.appearance}\n  Personality: ${c.personality}\n  Voice: ${c.voiceTone}`
).join("\n\n")}

EPISODE FORMAT RULES:
- Each episode is a tightly structured story arc of 4–6 scenes
- Hook: A single punchy teaser line (≤ 15 words) — the emotional bait
- Each scene has: location, prose description, 2–4 lines of sharp dialogue, and a visual beat
- Cliffhanger: A final image or line that demands the next episode be watched
- Tone: Real, raw, cinematic. Street-level emotion. Urban Black drama with heart.
- NO generic plots. Every episode should feel lived-in and specific.

You must ALWAYS return valid JSON in exactly the Episode schema format. No markdown wrapping.`;
    }

    private emit(status: AgentEvent["status"], message: string, output?: string): void {
        this.monitor.report({ agent: "story", status, message, timestamp: "", output });
    }

    async generateEpisode(
        episodeNumber: number,
        previousEpisodeSummary?: string,
        userPrompt?: string
    ): Promise<Episode> {
        this.emit("active", `Generating episode ${episodeNumber}...`);
        log(`[story] Starting episode ${episodeNumber} generation`);

        const prompt = `Generate episode ${episodeNumber} of "Out the Way".

${previousEpisodeSummary ? `CONTINUITY NOTE (previous episode summary):\n${previousEpisodeSummary}\n` : "This is the series premiere. Set up the world and introduce the characters naturally."}
${userPrompt ? `\nDIRECTOR'S NOTE: ${userPrompt}` : ""}

Return ONLY a JSON object matching this exact structure (no markdown, no extra text):
{
  "episodeNumber": ${episodeNumber},
  "title": "Episode title",
  "hook": "One-sentence teaser ≤ 15 words",
  "synopsis": "1-paragraph summary of the episode",
  "scenes": [
    {
      "sceneNumber": 1,
      "location": "Location description",
      "description": "What happens in this scene",
      "visualPrompt": "Vertical 9:16 AI video generation prompt, cinematic, detailed",
      "dialoguePrompt": "Voice synthesis context — who is speaking, what emotion, tone",
      "dialogue": [
        { "character": "Jace", "line": "Line of dialogue" }
      ],
      "charactersPresent": ["Jace"],
      "durationSeconds": 4
    }
  ],
  "cliffhanger": "Final line or visual beat description",
  "createdAt": "${new Date().toISOString()}"
}`;

        try {
            const response = await this.ask(prompt);
            const rawContent = response.content?.trim() ?? "";

            // Strip any accidental markdown fences
            const jsonStr = rawContent.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
            const episode: Episode = JSON.parse(jsonStr);
            episode.episodeNumber = episodeNumber;
            episode.createdAt = new Date().toISOString();
            if (previousEpisodeSummary) episode.previousSummary = previousEpisodeSummary;

            // Persist to disk
            this.ensureDataDir();
            const filePath = path.join(DATA_DIR, `ep_${episodeNumber}.json`);
            fs.writeFileSync(filePath, JSON.stringify(episode, null, 2), "utf-8");

            this.emit("completed", `Episode ${episodeNumber} generated: "${episode.title}"`, filePath);
            log(`[story] ✅ Episode ${episodeNumber} saved to ${filePath}`);
            return episode;

        } catch (err: any) {
            this.emit("failed", `Episode generation failed: ${err.message}`);
            log(`[story] ❌ Failed: ${err.message}`, "error");
            throw err;
        }
    }

    /** Load a previously generated episode from disk */
    static loadEpisode(episodeNumber: number): Episode | null {
        const filePath = path.join(DATA_DIR, `ep_${episodeNumber}.json`);
        if (!fs.existsSync(filePath)) return null;
        return JSON.parse(fs.readFileSync(filePath, "utf-8")) as Episode;
    }

    private ensureDataDir(): void {
        if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    }
}
