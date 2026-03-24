// ============================================================
// OUT THE WAY — Music Agent
// Creates original R&B / soulful rap songs for Nia Brooks
// Generates lyrics via AI, produces audio via kie.ai (Suno V4)
// API: https://api.kie.ai/api/v1/generate
// ============================================================

import fs from "fs";
import path from "path";
import axios from "axios";
import { BaseAgent } from "../baseAgent.js";
import { config, log } from "../../core/config.js";
import { CHARACTERS } from "./types.js";
import type { MusicTrack, AgentEvent } from "./types.js";
import type { MonitoringAgent } from "./monitoringAgent.js";

const MUSIC_DIR = path.join(process.cwd(), "data", "outtheway", "music");

// kie.ai endpoints
const KIE_BASE     = "https://api.kie.ai/api/v1";
const KIE_GENERATE = `${KIE_BASE}/generate`;
const KIE_STATUS   = (taskId: string) => `${KIE_BASE}/generate/${taskId}`;

export class MusicAgent extends BaseAgent {
    private monitor: MonitoringAgent;

    constructor(monitor: MonitoringAgent) {
        super("MusicAgent", "");
        this.monitor = monitor;
    }

    getName(): string { return "MusicAgent"; }

    getSystemPrompt(): string {
        return `You are the Music Agent for "Out the Way" — the creative engine behind Nia Brooks' music career.

NIA BROOKS CHARACTER:
${CHARACTERS.nia.role}
Voice: ${CHARACTERS.nia.voiceTone}
Musical Style: R&B / Soulful rap — think SZA, H.E.R., Jhené Aiko meets Noname and Syd.

SONGWRITING RULES:
- Write in Nia's authentic voice — emotional, poetic, lived-in
- Structure: VERSE 1 → PRE-CHORUS → CHORUS → VERSE 2 → BRIDGE → OUTRO
- Each section clearly labeled
- Lyrics: specific images, real pain, earned joy — never generic
- Themes: love vs. ambition, streets vs. dreams, loyalty, self-discovery

PRODUCTION NOTES (for kie.ai Suno):
- style: concise genre/mood string for Suno (e.g. "R&B soulful trap piano 808s female vocals")
- negativeTags: what to avoid
- bpm, key

Return valid JSON only.`;
    }

    private emit(status: AgentEvent["status"], message: string, output?: string): void {
        this.monitor.report({ agent: "music", status, message, timestamp: "", output });
    }

    async createTrack(
        theme: string,
        mood: MusicTrack["mood"],
        episodeContext?: string
    ): Promise<MusicTrack> {
        this.ensureMusicDir();
        this.emit("active", `Composing track: "${theme}" (${mood})`);
        log(`[music] Writing song — theme: "${theme}", mood: ${mood}`);

        // ── Step 1: Generate lyrics + metadata via AI ────────────
        const songData = await this.generateLyrics(theme, mood, episodeContext);

        const track: MusicTrack = {
            title: songData.title,
            theme: songData.theme,
            mood: songData.mood as MusicTrack["mood"],
            lyrics: songData.lyrics,
            episodeContext,
            createdAt: new Date().toISOString(),
        };

        // ── Step 2: Save lyrics text file ─────────────────────────
        const safeTitle = track.title.toLowerCase().replace(/[^a-z0-9]+/g, "_");
        const lyricsPath = path.join(MUSIC_DIR, `${safeTitle}_lyrics.txt`);
        fs.writeFileSync(lyricsPath, this.formatLyricsFile(track, songData), "utf-8");
        track.lyricsPath = lyricsPath;
        log(`[music] 📝 Lyrics saved: ${lyricsPath}`);

        // ── Step 3: Generate audio via kie.ai Suno V4 ─────────────
        const audioPath = path.join(MUSIC_DIR, `${safeTitle}.mp3`);
        const generatedAudioPath = await this.generateAudio(track, songData, audioPath);
        track.audioPath = generatedAudioPath;

        // ── Step 4: Save full track metadata ──────────────────────
        const metaPath = path.join(MUSIC_DIR, `${safeTitle}_track.json`);
        fs.writeFileSync(metaPath, JSON.stringify({ ...track, ...songData }, null, 2), "utf-8");
        log(`[music] 🎵 Track metadata saved: ${metaPath}`);

        this.emit("completed", `"${track.title}" created`, lyricsPath);
        return track;
    }

    // ──────────────────────────────────────────────────────────
    // AI: Generate full lyrics + production metadata
    // ──────────────────────────────────────────────────────────
    private async generateLyrics(
        theme: string,
        mood: string,
        episodeContext?: string
    ): Promise<any> {
        const prompt = `Write an original song for Nia Brooks for "Out the Way".

Theme: "${theme}"
Mood: ${mood}
${episodeContext ? `Episode context: "${episodeContext}"` : ""}

Return ONLY JSON:
{
  "title": "Song title",
  "theme": "${theme}",
  "mood": "${mood}",
  "bpm": 88,
  "key": "F# minor",
  "sunoStyle": "R&B soulful trap, lo-fi piano, 808s, warm female vocals, emotional",
  "sunoNegativeTags": "Heavy metal, fast EDM, comedy, low quality",
  "lyrics": "Full lyrics with sections labeled: [VERSE 1] [PRE-CHORUS] [CHORUS] [VERSE 2] [BRIDGE] [OUTRO]",
  "vocalNotes": {
    "verse": "Soft, intimate — close mic feel",
    "chorus": "Belted, soaring, raw",
    "bridge": "Spoken word into crescendo"
  },
  "adlibs": ["ad-lib1", "ad-lib2"],
  "moodBoard": "SZA 'Good Days' + Jhené Aiko 'While We're Young'"
}`;

        try {
            const response = await this.ask(prompt);
            const raw = response.content?.trim() ?? "";
            const jsonStr = raw.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
            return JSON.parse(jsonStr);
        } catch (err: any) {
            log(`[music] ❌ Lyric generation failed: ${err.message}`, "error");
            throw err;
        }
    }

    // ──────────────────────────────────────────────────────────
    // KIE.AI (Suno V4) — Music Generation
    // POST https://api.kie.ai/api/v1/generate
    // Polls GET https://api.kie.ai/api/v1/generate/{taskId}
    // ──────────────────────────────────────────────────────────
    private async generateAudio(track: MusicTrack, songData: any, audioPath: string): Promise<string> {
        if (!config.kieAiApiKey) {
            log(`[music] ⚠️  KIE_AI_API_KEY not set — writing audio stub`, "warn");
            this.writeStub(audioPath, {
                title: track.title,
                style: songData.sunoStyle,
                lyrics_preview: track.lyrics.substring(0, 200),
                status: "STUB — add KIE_AI_API_KEY to .env to activate",
                note: "Get your key at https://kie.ai and add it to .env as KIE_AI_API_KEY"
            });
            return audioPath;
        }

        try {
            log(`[music] 🎵 kie.ai: submitting song generation for "${track.title}"...`);

            // 1. Submit generation task
            const createRes = await axios.post(
                KIE_GENERATE,
                {
                    prompt: track.lyrics,           // Full lyrics as prompt
                    customMode: true,               // Use custom lyrics + style
                    instrumental: false,            // We want vocals (Nia sings!)
                    model: "V4",
                    style: songData.sunoStyle ?? "R&B soulful soul trap female vocals warm",
                    title: track.title,
                    negativeTags: songData.sunoNegativeTags ?? "Heavy Metal, Upbeat Drums, Comedy",
                    vocalGender: "f",               // Nia Brooks is female
                    styleWeight: 0.70,
                    weirdnessConstraint: 0.40,      // Keep it grounded / not experimental
                    audioWeight: 0.65,
                },
                {
                    headers: {
                        Authorization: `Bearer ${config.kieAiApiKey}`,
                        "Content-Type": "application/json",
                    },
                    timeout: 30000,
                }
            );

            const taskId = createRes.data?.data?.taskId ?? createRes.data?.taskId;
            if (!taskId) throw new Error(`kie.ai returned no taskId: ${JSON.stringify(createRes.data)}`);
            log(`[music] kie.ai task submitted: ${taskId} — polling for completion...`);

            // 2. Poll until complete (max 10 min)
            const audioUrl = await this.pollKieTask(taskId);

            // 3. Download the generated mp3
            const dlRes = await axios.get(audioUrl, { responseType: "arraybuffer", timeout: 120000 });
            fs.writeFileSync(audioPath, Buffer.from(dlRes.data));
            log(`[music] ✅ kie.ai audio downloaded: ${path.basename(audioPath)}`);
            return audioPath;

        } catch (err: any) {
            const msg = err.response?.data ? JSON.stringify(err.response.data) : err.message;
            log(`[music] ❌ kie.ai error: ${msg}`, "error");
            this.writeStub(audioPath, { title: track.title, error: msg });
            return audioPath;
        }
    }

    /** Poll kie.ai task until completed or failed — max 10 minutes */
    private async pollKieTask(taskId: string): Promise<string> {
        const maxAttempts = 120;  // 120 × 5s = 10 min
        const pollMs = 5000;

        for (let i = 0; i < maxAttempts; i++) {
            await new Promise(r => setTimeout(r, pollMs));

            const statusRes = await axios.get(KIE_STATUS(taskId), {
                headers: { Authorization: `Bearer ${config.kieAiApiKey}` },
                timeout: 15000,
            });

            // kie.ai wraps in .data
            const taskData = statusRes.data?.data ?? statusRes.data;
            const status   = taskData?.status ?? taskData?.state;
            log(`[music] kie.ai ${taskId} — status: ${status} (${i + 1}/${maxAttempts})`);

            if (status === "completed" || status === "SUCCESS" || status === "success") {
                // Try common output field paths
                const audioUrl =
                    taskData?.audioUrl ??
                    taskData?.output?.audioUrl ??
                    taskData?.result?.audioUrl ??
                    (Array.isArray(taskData?.output) ? taskData?.output[0]?.audioUrl : undefined);

                if (!audioUrl) throw new Error(`kie.ai task succeeded but no audioUrl found: ${JSON.stringify(taskData)}`);
                return audioUrl;
            }

            if (status === "failed" || status === "FAILED" || status === "error") {
                throw new Error(`kie.ai task failed: ${JSON.stringify(taskData)}`);
            }
        }

        throw new Error(`kie.ai task ${taskId} timed out after ${(maxAttempts * pollMs) / 1000}s`);
    }

    private formatLyricsFile(track: MusicTrack, data: any): string {
        return [
            `=== OUT THE WAY — NIA BROOKS ===`,
            `Song: "${track.title}"`,
            `Theme: ${track.theme} | Mood: ${track.mood}`,
            `BPM: ${data.bpm} | Key: ${data.key}`,
            `Suno Style: ${data.sunoStyle}`,
            `Mood Board: ${data.moodBoard ?? ""}`,
            ``,
            `─────────────────────────────────`,
            track.lyrics,
            `─────────────────────────────────`,
            ``,
            `VOCAL NOTES:`,
            `  Verse:  ${data.vocalNotes?.verse ?? ""}`,
            `  Chorus: ${data.vocalNotes?.chorus ?? ""}`,
            `  Bridge: ${data.vocalNotes?.bridge ?? ""}`,
            ``,
            `AD-LIBS: ${(data.adlibs ?? []).join(" / ")}`,
        ].join("\n");
    }

    private writeStub(basePath: string, data: object): void {
        const stubPath = basePath.replace(/\.mp3$/, ".audio.json");
        fs.writeFileSync(stubPath, JSON.stringify({ ...data, generatedAt: new Date().toISOString() }, null, 2), "utf-8");
        log(`[music] 📄 Audio stub written: ${path.basename(stubPath)}`);
    }

    private ensureMusicDir(): void {
        if (!fs.existsSync(MUSIC_DIR)) fs.mkdirSync(MUSIC_DIR, { recursive: true });
    }
}
