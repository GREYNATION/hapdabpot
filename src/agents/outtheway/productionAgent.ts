// ============================================================
// OUT THE WAY — Production Agent (UPGRADED v2)
// Real video generation via Runway Gen-3 Alpha Turbo
// Real voice synthesis via ElevenLabs (per character, per line)
// Granular dashboard updates every step
// Character-consistent visual prompts
// ============================================================

import fs from "fs";
import path from "path";
import axios from "axios";
import { BaseAgent } from "../baseAgent.js";
import { config, log } from "../../core/config.js";
import { CHARACTERS } from "./types.js";
import type { Scene, AgentEvent } from "./types.js";
import type { MonitoringAgent } from "./monitoringAgent.js";

const BASE_DIR   = process.env.DATA_DIR ?? path.join(process.cwd(), "data");
const CLIPS_DIR  = path.join(BASE_DIR, "outtheway", "clips");
const OUTPUT_DIR = path.join(BASE_DIR, "outtheway", "output");

// ── Runway API constants ──────────────────────────────────────────────
const RUNWAY_API  = "https://api.dev.runwayml.com/v1";
const RUNWAY_VER  = "2024-11-06";

// ── ElevenLabs voice model ───────────────────────────────────────────
const ELEVEN_MODEL = "eleven_multilingual_v2";

// ── Character voice IDs (set per-character in .env to customize) ─────
// Defaults: Jace=Adam (deep, calm), Nia=Rachel (warm, expressive), Rel=Antoni (fast, energetic)
const VOICE_IDS: Record<string, string> = {
    Jace:       process.env.ELEVENLABS_VOICE_ID_JACE ?? "pNInz6obpg8ndEao7mAl",
    Nia:        process.env.ELEVENLABS_VOICE_ID_NIA  ?? "21m00Tcm4TlvDq8ikWAM",
    Rel:        process.env.ELEVENLABS_VOICE_ID_REL  ?? "AZnzlk1XvdvUeBnXmlld",
    "Dre's Man": process.env.ELEVENLABS_VOICE_ID_DRE ?? "VR6AewLTigWG4xSOukaG",
};
const DEFAULT_VOICE = config.elevenVoiceId ?? "pNInz6obpg8ndEao7mAl";

// ── Visual tone injected into every Runway prompt ────────────────────
const TONE_SUFFIX = [
    "dark, realistic street drama aesthetic",
    "vertical 9:16 framing",
    "cinematic film grain",
    "desaturated warm tones with cold shadow highlights",
    "shallow depth of field",
    "intimate close-up composition",
    "no text overlays, no watermarks"
].join(", ");

// ── Character appearance reference for prompt injection ─────────────
const CHAR_APPEARANCE: Record<string, string> = {
    Jace: CHARACTERS.jace.appearance,
    Nia:  CHARACTERS.nia.appearance,
    Rel:  CHARACTERS.rel.appearance,
};

// ── Voice settings per mood/character ──────────────────────────────
const VOICE_SETTINGS = {
    default: { stability: 0.55, similarity_boost: 0.80, style: 0.30, use_speaker_boost: true },
    Jace:    { stability: 0.65, similarity_boost: 0.82, style: 0.20, use_speaker_boost: true }, // calm, measured
    Nia:     { stability: 0.50, similarity_boost: 0.80, style: 0.45, use_speaker_boost: true }, // emotional, expressive
    Rel:     { stability: 0.40, similarity_boost: 0.75, style: 0.60, use_speaker_boost: true }, // energetic, loose
};

// ── Production manifest entry ───────────────────────────────────────
export interface SceneProductionRecord {
    sceneNumber: number;
    location: string;
    clipPath: string | null;
    clipGenerated: boolean;
    audioPaths: string[];          // One mp3 per dialogue line
    mergedAudioPath: string | null; // Combined scene audio
    runwayTaskId?: string;
    runwayStatus?: string;
    elevenLabsLines: number;
    errorLog: string[];
    producedAt: string;
}

export class ProductionAgent extends BaseAgent {
    private monitor: MonitoringAgent;

    constructor(monitor: MonitoringAgent) {
        super("ProductionAgent", "");
        this.monitor = monitor;
    }

    getName(): string { return "ProductionAgent"; }

    getSystemPrompt(): string {
        return `You are the Production Agent for "Out the Way" — a dark, cinematic street drama series.
You refine visual prompts for Runway Gen-3 Alpha Turbo (vertical 9:16, 5–10s clips).
Always embed character appearance details and lighting specifics for maximum visual consistency.`;
    }

    // ── Dashboard emit helpers ────────────────────────────────────────
    private emit(status: AgentEvent["status"], message: string, output?: string): void {
        this.monitor.report({ agent: "production", status, message, timestamp: "", output });
    }

    private emitScene(sceneNum: number, total: number, step: string): void {
        this.emit("active", `[Scene ${sceneNum}/${total}] ${step}`);
        log(`[production] 🎬 [Scene ${sceneNum}/${total}] ${step}`);
    }

    // ── Main entry: produce all scenes ──────────────────────────────
    async produceScenes(scenes: Scene[], episodeNumber: number): Promise<Scene[]> {
        this.ensureDirs();
        const total = scenes.length;
        this.emit("active", `Starting production — ${total} scenes for episode ${episodeNumber}`);
        log(`[production] ════ Starting Episode ${episodeNumber} Production — ${total} scenes ════`);

        const productionManifest: SceneProductionRecord[] = [];
        const producedScenes: Scene[] = [];

        for (const scene of scenes) {
            const record: SceneProductionRecord = {
                sceneNumber: scene.sceneNumber,
                location: scene.location,
                clipPath: null,
                clipGenerated: false,
                audioPaths: [],
                mergedAudioPath: null,
                elevenLabsLines: 0,
                errorLog: [],
                producedAt: new Date().toISOString(),
            };

            try {
                // ── Step A: Refine prompt with character consistency ──
                this.emitScene(scene.sceneNumber, total, "Refining visual prompt...");
                const refinedScene = await this.refinePromptWithCharacters(scene);

                // ── Step B: Generate video clip via Runway ────────────
                this.emitScene(scene.sceneNumber, total, "Generating video clip via Runway Gen-3...");
                const { clipPath, taskId, runwayStatus } =
                    await this.generateClip(refinedScene, episodeNumber);
                refinedScene.clipPath = clipPath;
                record.clipPath       = clipPath;
                record.clipGenerated  = fs.existsSync(clipPath) && fs.statSync(clipPath).size > 1000;
                record.runwayTaskId   = taskId;
                record.runwayStatus   = runwayStatus;

                // ── Step C: Generate voice per dialogue line ──────────
                if (refinedScene.dialogue.length > 0) {
                    this.emitScene(scene.sceneNumber, total,
                        `Generating ${refinedScene.dialogue.length} voice line(s) via ElevenLabs...`);

                    const { audioPaths, mergedPath } =
                        await this.generateVoiceLines(refinedScene, episodeNumber);

                    refinedScene.audioPath      = mergedPath ?? audioPaths[0] ?? undefined;
                    record.audioPaths           = audioPaths;
                    record.mergedAudioPath      = mergedPath;
                    record.elevenLabsLines      = audioPaths.length;
                } else {
                    this.emitScene(scene.sceneNumber, total, "No dialogue — audio step skipped");
                    log(`[production] Scene ${scene.sceneNumber} has no dialogue — audio skipped`);
                }

                producedScenes.push(refinedScene);
                this.emitScene(scene.sceneNumber, total,
                    `✅ Complete — clip: ${record.clipGenerated ? "real" : "stub"}, audio lines: ${record.elevenLabsLines}`);

            } catch (err: any) {
                record.errorLog.push(err.message);
                this.emit("failed", `[Scene ${scene.sceneNumber}/${total}] FAILED: ${err.message}`);
                log(`[production] ❌ Scene ${scene.sceneNumber} failed: ${err.message}`, "error");
                producedScenes.push(scene);
            }

            productionManifest.push(record);
        }

        // ── Save production manifest ──────────────────────────────────
        const manifestPath = path.join(OUTPUT_DIR, `ep${episodeNumber}_production_manifest.json`);
        fs.writeFileSync(manifestPath, JSON.stringify(productionManifest, null, 2), "utf-8");
        log(`[production] 📋 Production manifest saved: ${manifestPath}`);

        const clipCount   = productionManifest.filter(r => r.clipGenerated).length;
        const audioCount  = productionManifest.reduce((n, r) => n + r.elevenLabsLines, 0);
        const failCount   = productionManifest.filter(r => r.errorLog.length > 0).length;

        this.emit("completed",
            `Production complete — ${clipCount}/${total} real clips, ${audioCount} voice lines, ${failCount} failures`,
            manifestPath
        );

        return producedScenes;
    }

    // ── Prompt Refinement: inject character appearance + tone ─────────
    private async refinePromptWithCharacters(scene: Scene): Promise<Scene> {
        // Build character appearance block for every character in this scene
        const charNotes = scene.charactersPresent
            .map(name => {
                const appearance = CHAR_APPEARANCE[name];
                return appearance ? `• ${name}: ${appearance}` : null;
            })
            .filter(Boolean)
            .join("\n");

        const prompt = `Refine this Runway Gen-3 Alpha Turbo prompt for "Out the Way" Scene ${scene.sceneNumber}.

TONE: Dark, realistic, cinematic street drama. Urban Black storytelling. Never glossy.
SCENE LOCATION: ${scene.location}
CHARACTERS PRESENT: ${scene.charactersPresent.join(", ") || "None"}

${charNotes ? `CHARACTER APPEARANCE (keep exactly consistent):\n${charNotes}` : ""}

ORIGINAL PROMPT:
${scene.visualPrompt}

RULES:
- Vertical 9:16 framing — always
- Close-up / intimate composition — no wide establishing shots unless the scene calls for it
- Lighting must match location: night scenes = neon, street lamp glow, phone glow only
- Character descriptions from above must be embedded
- No logos, text, or watermarks

Return ONLY JSON (no markdown):
{
  "refinedPrompt": "Complete, production-ready Runway prompt with character appearance, lighting, mood, framing",
  "negativePrompt": "blurry, shaky camera, overexposed, text overlay, watermark, low quality, cartoon, unrealistic skin"
}`;

        try {
            const response = await this.ask(prompt);
            const raw = response.content?.trim() ?? "";
            const jsonStr = raw.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
            const ref = JSON.parse(jsonStr);
            // Append global tone suffix to ensure consistency
            scene.visualPrompt = `${ref.refinedPrompt}. ${TONE_SUFFIX}`;
        } catch {
            // Fallback: just append the tone suffix to original
            scene.visualPrompt = `${scene.visualPrompt}. ${TONE_SUFFIX}`;
            log(`[production] ⚠️  Prompt refinement fallback for scene ${scene.sceneNumber}`, "warn");
        }
        return scene;
    }

    // ── RUNWAY GEN-3 ALPHA TURBO — Video Clip Generation ────────────
    // API: https://docs.dev.runwayml.com/api/
    // Model: gen3a_turbo | ratio: "9:16" | duration: 5 or 10
    private async generateClip(
        scene: Scene,
        episodeNumber: number
    ): Promise<{ clipPath: string; taskId?: string; runwayStatus: string }> {
        const clipFilename = `ep${episodeNumber}_scene${scene.sceneNumber}.mp4`;
        const clipPath     = path.join(CLIPS_DIR, clipFilename);

        if (!config.runwayApiKey) {
            log(`[production] ⚠️  RUNWAY_API_KEY missing — stubbing scene ${scene.sceneNumber}`, "warn");
            this.writeStub(clipPath, { reason: "RUNWAY_API_KEY not set", prompt: scene.visualPrompt });
            return { clipPath, runwayStatus: "STUB_NO_KEY" };
        }

        // --- IDEMPOTENCY CHECK ---
        if (fs.existsSync(clipPath) && fs.statSync(clipPath).size > 1000) {
            log(`[production] ⏩ Skipping Runway for Scene ${scene.sceneNumber} — valid clip already exists.`);
            return { clipPath, runwayStatus: "SKIPPED_ALREADY_EXISTS" };
        }

        try {
            log(`[production] 🎬 Runway: submitting scene ${scene.sceneNumber}...`);
            log(`[production] Prompt (${scene.visualPrompt.length} chars): ${scene.visualPrompt.substring(0, 120)}...`);

            // Duration must be integer 2–10 per Runway API
            const duration = Math.min(Math.max(Math.round(scene.durationSeconds), 2), 10);

            const createRes = await axios.post(
                `${RUNWAY_API}/text_to_video`,
                {
                    model: "gen4.5",          // Valid Runway text_to_video models: gen3a_turbo | gen4.5 | veo3 | veo3.1 | veo3.1_fast
                    promptText: scene.visualPrompt.substring(0, 1000), // API max: 1000 chars
                    duration,
                    ratio: "720:1280",     // Vertical 9:16
                    watermark: false,
                },
                {
                    headers: {
                        Authorization: `Bearer ${config.runwayApiKey}`,
                        "X-Runway-Version": RUNWAY_VER,
                        "Content-Type": "application/json",
                    },
                    timeout: 30000,
                }
            );

            const taskId = createRes.data?.id;
            if (!taskId) {
                throw new Error(`Runway returned no task ID: ${JSON.stringify(createRes.data)}`);
            }

            log(`[production] Runway task ${taskId} created — polling...`);
            this.emitScene(scene.sceneNumber, 99,
                `Runway task ${taskId} — waiting for render...`);

            const videoUrl = await this.pollRunwayTask(taskId, scene.sceneNumber);

            log(`[production] Runway complete — downloading clip...`);
            const dlRes = await axios.get(videoUrl, {
                responseType: "arraybuffer",
                timeout: 180000,
                onDownloadProgress: (p) => {
                    if (p.total) {
                        const pct = Math.round((p.loaded / p.total) * 100);
                        if (pct % 25 === 0) log(`[production] Downloading scene ${scene.sceneNumber}: ${pct}%`);
                    }
                }
            });

            fs.writeFileSync(clipPath, Buffer.from(dlRes.data));
            log(`[production] ✅ Scene ${scene.sceneNumber} clip saved: ${clipFilename} (${Math.round(dlRes.data.byteLength / 1024)}KB)`);

            return { clipPath, taskId, runwayStatus: "SUCCEEDED" };

        } catch (err: any) {
            const msg = this.extractError(err);
            log(`[production] ❌ Runway scene ${scene.sceneNumber}: ${msg}`, "error");
            this.writeStub(clipPath, { error: msg, prompt: scene.visualPrompt, scene: scene.sceneNumber });
            return { clipPath, runwayStatus: "FAILED" };
        }
    }

    /** Poll Runway task — handles: PENDING, RUNNING, THROTTLED, SUCCEEDED, FAILED */
    private async pollRunwayTask(taskId: string, sceneNum: number): Promise<string> {
        const MAX_WAIT_MS = 8 * 60 * 1000; // 8 minutes
        const POLL_MS     = 6000;
        const started     = Date.now();
        let   attempt     = 0;

        while (Date.now() - started < MAX_WAIT_MS) {
            await new Promise(r => setTimeout(r, POLL_MS));
            attempt++;

            let statusData: any;
            try {
                const res = await axios.get(`${RUNWAY_API}/tasks/${taskId}`, {
                    headers: {
                        Authorization: `Bearer ${config.runwayApiKey}`,
                        "X-Runway-Version": RUNWAY_VER,
                    },
                    timeout: 15000,
                });
                statusData = res.data;
            } catch (pollErr: any) {
                log(`[production] Poll attempt ${attempt} failed: ${pollErr.message} — retrying`, "warn");
                continue;
            }

            const { status, output, failure, progress } = statusData;
            const elapsed = Math.round((Date.now() - started) / 1000);
            const pctStr  = progress != null ? ` (${Math.round(progress * 100)}%)` : "";
            log(`[production] Runway ${taskId}${pctStr} — ${status} [${elapsed}s elapsed]`);

            if (status === "SUCCEEDED") {
                const url = Array.isArray(output) ? output[0] : output;
                if (!url) throw new Error("Runway SUCCEEDED but no output URL");
                return url;
            }

            if (status === "FAILED") {
                throw new Error(`Runway FAILED: ${failure ?? "no reason given"}`);
            }

            // THROTTLED = rate limited, keep waiting with longer gap
            if (status === "THROTTLED") {
                log(`[production] Runway throttled — waiting 15s...`, "warn");
                await new Promise(r => setTimeout(r, 15000));
            }

            // PENDING / RUNNING = normal, continue polling
        }

        throw new Error(`Runway task ${taskId} timed out after ${MAX_WAIT_MS / 1000}s`);
    }

    // ── ELEVENLABS — Per-character, per-line voice generation ────────
    // Generates one mp3 per dialogue line, then concatenates into scene audio
    private async generateVoiceLines(
        scene: Scene,
        episodeNumber: number
    ): Promise<{ audioPaths: string[]; mergedPath: string | null }> {
        if (!config.elevenKey) {
            log(`[production] ⚠️  ELEVENLABS_API_KEY missing — stubbing scene ${scene.sceneNumber} audio`, "warn");
            const stubPath = path.join(CLIPS_DIR, `ep${episodeNumber}_scene${scene.sceneNumber}.stub.json`);
            this.writeStub(stubPath, { reason: "ELEVENLABS_API_KEY not set", script: scene.dialogue });
            return { audioPaths: [], mergedPath: null };
        }

        const audioPaths: string[] = [];

        for (let i = 0; i < scene.dialogue.length; i++) {
            const line      = scene.dialogue[i];
            const character = line.character;
            const voiceId   = VOICE_IDS[character] ?? DEFAULT_VOICE;
            const settings  = (VOICE_SETTINGS as any)[character] ?? VOICE_SETTINGS.default;
            const lineFile  = `ep${episodeNumber}_sc${scene.sceneNumber}_line${i + 1}_${character.toLowerCase().replace(/\s/g, "_")}.mp3`;
            const linePath  = path.join(CLIPS_DIR, lineFile);

            // --- IDEMPOTENCY CHECK ---
            if (fs.existsSync(linePath) && fs.statSync(linePath).size > 1000) {
                log(`[production] ⏩ Skipping ElevenLabs for ${character} — valid audio already exists.`);
                audioPaths.push(linePath);
                continue;
            }

            log(`[production] 🎙️  ElevenLabs: ${character} — line ${i + 1}/${scene.dialogue.length}: "${line.line.substring(0, 50)}..."`);
            this.emitScene(scene.sceneNumber, 99,
                `Generating voice: ${character} — "${line.line.substring(0, 40)}${line.line.length > 40 ? "..." : ""}"`);

            try {
                // Use standard (non-streaming) endpoint — streaming requires additional plan tier
                const ttsRes = await axios.post(
                    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
                    {
                        text: line.line,
                        model_id: ELEVEN_MODEL,
                        voice_settings: settings,
                    },
                    {
                        headers: {
                            "xi-api-key": config.elevenKey,
                            "Content-Type": "application/json",
                            Accept: "audio/mpeg",
                        },
                        responseType: "arraybuffer",
                        timeout: 45000,
                    }
                );

                fs.writeFileSync(linePath, Buffer.from(ttsRes.data));
                audioPaths.push(linePath);
                log(`[production] ✅ Voice line ${i + 1}: ${character} — ${linePath}`);

                // Brief pause between ElevenLabs calls to avoid rate limits
                if (i < scene.dialogue.length - 1) {
                    await new Promise(r => setTimeout(r, 500));
                }

            } catch (err: any) {
                const msg = this.extractError(err);

                // --- FALLBACK CHECK FOR LIBRARY VOICES ON FREE TIER ---
                if (msg.includes("paid_plan_required") || msg.includes("payment_required")) {
                    log(`[production] ⚠️ Paid plan required for custom voice ${voiceId}. Falling back to default voice.`, "warn");
                    this.emitScene(scene.sceneNumber, 99, `ElevenLabs plan restriction — falling back to default voice.`);
                    
                    try {
                        const fallbackRes = await axios.post(
                            `https://api.elevenlabs.io/v1/text-to-speech/${DEFAULT_VOICE}`,
                            {
                                text: line.line,
                                model_id: ELEVEN_MODEL,
                                voice_settings: VOICE_SETTINGS.default,
                            },
                            {
                                headers: {
                                    "xi-api-key": config.elevenKey,
                                    "Content-Type": "application/json",
                                    Accept: "audio/mpeg",
                                },
                                responseType: "arraybuffer",
                                timeout: 45000,
                            }
                        );
                        
                        fs.writeFileSync(linePath, Buffer.from(fallbackRes.data));
                        audioPaths.push(linePath);
                        log(`[production] ✅ Voice line ${i + 1} (Fallback): ${character} — ${linePath}`);
                        continue;
                    } catch (fallbackErr: any) {
                        const fbMsg = this.extractError(fallbackErr);
                        log(`[production] ❌ ElevenLabs Fallback FAILED for line ${i + 1}: ${fbMsg}`, "error");
                        // Let it fall to stub creation below if fallback fails too
                    }
                }

                log(`[production] ❌ ElevenLabs line ${i + 1} (${character}): ${msg}`, "error");
                this.writeStub(linePath, { character, line: line.line, error: msg });
            }
        }

        // Concatenate audio lines into merged scene audio
        const mergedPath = audioPaths.length > 0
            ? await this.mergeAudioLines(audioPaths, episodeNumber, scene.sceneNumber)
            : null;

        return { audioPaths, mergedPath };
    }

    /**
     * Merge multiple mp3 files into one by concatenating raw bytes.
     * For production quality, this will be upgraded to use ffmpeg concat
     * (the assemblyAgent handles final ffmpeg processing anyway).
     * Simple concat works fine for mp3 segments that are played sequentially.
     */
    private async mergeAudioLines(
        audioPaths: string[],
        episodeNumber: number,
        sceneNumber: number
    ): Promise<string> {
        if (audioPaths.length === 1) return audioPaths[0];

        const mergedFilename = `ep${episodeNumber}_scene${sceneNumber}_merged.mp3`;
        const mergedPath     = path.join(CLIPS_DIR, mergedFilename);

        const buffers = audioPaths
            .filter(p => fs.existsSync(p) && fs.statSync(p).size > 0)
            .map(p => fs.readFileSync(p));

        if (buffers.length === 0) return audioPaths[0];

        fs.writeFileSync(mergedPath, Buffer.concat(buffers));
        log(`[production] 🔗 Merged ${buffers.length} audio lines → ${mergedFilename}`);
        return mergedPath;
    }

    // ── Helpers ───────────────────────────────────────────────────────

    private writeStub(basePath: string, data: object): void {
        const stubPath = basePath.replace(/\.(mp4|mp3)$/, "").concat(".stub.json");
        fs.writeFileSync(stubPath, JSON.stringify({
            ...data,
            stubNote: "This is a stub — real generation failed or API key missing",
            generatedAt: new Date().toISOString()
        }, null, 2), "utf-8");
    }

    private extractError(err: any): string {
        if (err.response?.data instanceof Buffer) {
            return err.response.data.toString("utf-8").substring(0, 500);
        }
        if (err.response?.data) {
            return JSON.stringify(err.response.data).substring(0, 500);
        }
        return err.message ?? "Unknown error";
    }

    private ensureDirs(): void {
        [CLIPS_DIR, OUTPUT_DIR].forEach(d => {
            if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
        });
    }
}
