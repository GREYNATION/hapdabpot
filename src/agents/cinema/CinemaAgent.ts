/**
 * CinemaAgent.ts
 * 
 * gravity-claw / hapdabot — "Out the Way" Mini Drama Series
 * Powered by Muapi.ai (Open-Higgsfield-AI engine)
 * 
 * Pipeline:
 *   1. Script → Scene breakdown (Claude/Groq)
 *   2. Scene → Cinematic image frame (Muapi Cinema Studio)
 *   3. Frame → Video clip (Muapi T2V / I2V)
 *   4. Clip → Lip sync (Muapi LipSync)
 *   5. Compiled episode → TikTok/Instagram/YouTube post
 */

import fs from "fs";
import path from "path";
import axios from "axios";

// ─── Config ──────────────────────────────────────────────────────────────────

const MUAPI_KEY   = process.env.MUAPI_API_KEY!;
const MUAPI_BASE  = "https://api.muapi.ai/api/v1";
const POLL_INTERVAL_MS = 4000;   // 4s between status checks
const MAX_POLLS        = 90;     // ~6 min timeout per job

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Scene {
  id: number;
  description: string;       // visual description for image gen
  dialogue?: string;         // spoken line for lip sync
  camera?: CameraSettings;
  character?: string;        // e.g. "Jaylen" | "Mia" | "Dre"
  location?: string;         // e.g. "Brooklyn rooftop at golden hour"
  mood?: string;             // e.g. "tense" | "romantic" | "confrontational"
}

export interface CameraSettings {
  lens?: string;             // e.g. "85mm Portrait Prime"
  sensor?: string;           // e.g. "Full-Frame Cine Digital"
  aperture?: string;         // e.g. "f/1.8"
  movement?: string;         // e.g. "slow push in" | "handheld"
}

export interface Episode {
  episodeNumber: number;
  title: string;
  series: string;
  scenes: Scene[];
}

export interface GeneratedScene {
  sceneId: number;
  imageUrl?: string;
  videoUrl?: string;
  lipSyncUrl?: string;
  prompt: string;
  status: "pending" | "complete" | "failed";
}

export interface MuapiJob {
  jobId: string;
  status: "pending" | "processing" | "complete" | "failed";
  outputUrl?: string;
}

// ─── "Out the Way" Series Config ─────────────────────────────────────────────

export const OUT_THE_WAY_SERIES = "Out the Way";

/**
 * Default visual style for "Out the Way"
 * Street drama set in South Brooklyn/Jersey — raw, cinematic, grounded.
 */
export const SERIES_STYLE = {
  aestheticBase: "urban street drama, golden hour lighting, shallow depth of field",
  colorGrade:    "warm shadows, teal highlights, high contrast — similar to Moonlight (2016)",
  sensor:        "Full-Frame Cine Digital",
  lens:          "35mm Classic Anamorphic",
  aperture:      "f/2.0",
  aspectRatio:   "9:16",   // TikTok/Reels vertical
};

// ─── Muapi Client ─────────────────────────────────────────────────────────────

class MuapiClient {
  private headers = {
    "x-api-key": MUAPI_KEY,
    "Content-Type": "application/json",
  };

  /** Submit a job and return the job ID */
  async submit(endpoint: string, payload: Record<string, unknown>): Promise<string> {
    const url = `${MUAPI_BASE}/${endpoint}`;
    const res = await axios.post(url, payload, { headers: this.headers });
    const jobId = res.data?.job_id ?? res.data?.id;
    if (!jobId) throw new Error(`Muapi submit failed — no job_id. Response: ${JSON.stringify(res.data)}`);
    console.log(`[Muapi] Job submitted → ${endpoint} | ID: ${jobId}`);
    return jobId;
  }

  /** Poll until job completes or times out */
  async poll(jobId: string): Promise<string> {
    for (let i = 0; i < MAX_POLLS; i++) {
      await sleep(POLL_INTERVAL_MS);
      const res = await axios.get(`${MUAPI_BASE}/status/${jobId}`, { headers: this.headers });
      const data = res.data;
      const status: string = data?.status ?? "pending";

      if (status === "complete" || status === "completed" || status === "succeeded") {
        const outputUrl = data?.output_url ?? data?.url ?? data?.result?.url;
        if (!outputUrl) throw new Error(`Job ${jobId} complete but no output_url`);
        console.log(`[Muapi] ✅ Job ${jobId} done → ${outputUrl}`);
        return outputUrl;
      }

      if (status === "failed" || status === "error") {
        throw new Error(`Muapi job ${jobId} failed: ${JSON.stringify(data)}`);
      }

      console.log(`[Muapi] ⏳ Job ${jobId} — status: ${status} (poll ${i + 1}/${MAX_POLLS})`);
    }
    throw new Error(`Muapi job ${jobId} timed out after ${(MAX_POLLS * POLL_INTERVAL_MS) / 1000}s`);
  }

  /** Submit + poll in one call */
  async run(endpoint: string, payload: Record<string, unknown>): Promise<string> {
    const jobId = await this.submit(endpoint, payload);
    return await this.poll(jobId);
  }
}

// ─── Cinema Agent ─────────────────────────────────────────────────────────────

export class CinemaAgent {
  private muapi = new MuapiClient();

  /**
   * Build the full cinematic prompt for a scene, injecting
   * "Out the Way" series style and camera settings.
   */
  buildCinemaPrompt(scene: Scene): string {
    const cam    = scene.camera ?? {};
    const lens   = cam.lens     ?? SERIES_STYLE.lens;
    const sensor = cam.sensor   ?? SERIES_STYLE.sensor;
    const aper   = cam.aperture ?? SERIES_STYLE.aperture;
    const move   = cam.movement ?? "locked off";

    return [
      scene.description,
      scene.location ? `Location: ${scene.location}` : "",
      scene.mood     ? `Mood: ${scene.mood}` : "",
      `Character: ${scene.character ?? "protagonist"}`,
      `Lens: ${lens}, Sensor: ${sensor}, Aperture: ${aper}`,
      `Camera: ${move}`,
      `Style: ${SERIES_STYLE.aestheticBase}`,
      `Color: ${SERIES_STYLE.colorGrade}`,
      `Aspect ratio: ${SERIES_STYLE.aspectRatio}, cinematic quality`,
    ].filter(Boolean).join(". ");
  }

  // ── Step 1: Text → Cinematic Image ────────────────────────────────────────

  async generateSceneImage(scene: Scene): Promise<string> {
    console.log(`\n[CinemaAgent] 🎬 Generating image — Scene ${scene.id}: ${scene.description.slice(0, 60)}...`);

    const prompt = this.buildCinemaPrompt(scene);

    try {
      return await this.muapi.run("nano-banana-pro", {
        prompt,
        aspect_ratio: SERIES_STYLE.aspectRatio,
        quality: "4K",
      });
    } catch (err) {
      console.warn("[CinemaAgent] Nano Banana failed, falling back to flux-dev:", err);
      return await this.muapi.run("flux-dev", {
        prompt,
        aspect_ratio: SERIES_STYLE.aspectRatio,
      });
    }
  }

  // ── Step 2: Image → Video Clip ────────────────────────────────────────────

  async animateScene(scene: Scene, imageUrl: string): Promise<string> {
    console.log(`[CinemaAgent] 🎥 Animating Scene ${scene.id}...`);

    const motionPrompt = scene.camera?.movement
      ? `${scene.camera.movement}, ${scene.mood ?? "dramatic"} energy`
      : "subtle cinematic motion, natural movement";

    try {
      return await this.muapi.run("kling-i2v", {
        image_url: imageUrl,
        prompt: motionPrompt,
        duration: 5,
        aspect_ratio: SERIES_STYLE.aspectRatio,
      });
    } catch (err) {
      console.warn("[CinemaAgent] Kling failed, falling back to wan-2-2:", err);
      return await this.muapi.run("wan-2-2", {
        image_url: imageUrl,
        prompt: motionPrompt,
        duration: 5,
      });
    }
  }

  // ── Step 3: Lip Sync (if dialogue) ────────────────────────────────────────

  async lipSyncScene(scene: Scene, videoUrl: string, audioUrl?: string): Promise<string> {
    if (!scene.dialogue) return videoUrl;

    console.log(`[CinemaAgent] 🎤 Lip sync — Scene ${scene.id}: "${scene.dialogue.slice(0, 50)}..."`);

    return await this.muapi.run("ltx-lipsync", {
      video_url: videoUrl,
      text:      scene.dialogue,
      audio_url: audioUrl,
    });
  }

  // ── Full Scene Pipeline ────────────────────────────────────────────────────

  async processScene(scene: Scene, audioUrl?: string): Promise<GeneratedScene> {
    const result: GeneratedScene = {
      sceneId: scene.id,
      prompt:  this.buildCinemaPrompt(scene),
      status:  "pending",
    };

    try {
      result.imageUrl   = await this.generateSceneImage(scene);
      result.videoUrl   = await this.animateScene(scene, result.imageUrl);
      if (scene.dialogue) {
        result.lipSyncUrl = await this.lipSyncScene(scene, result.videoUrl, audioUrl);
      }
      result.status = "complete";
      console.log(`[CinemaAgent] ✅ Scene ${scene.id} complete`);
    } catch (err) {
      result.status = "failed";
      console.error(`[CinemaAgent] ❌ Scene ${scene.id} failed:`, err);
    }

    return result;
  }

  // ── Full Episode Pipeline ──────────────────────────────────────────────────

  async produceEpisode(episode: Episode): Promise<GeneratedScene[]> {
    console.log(`\n${"═".repeat(60)}`);
    console.log(`[CinemaAgent] 🎬 "${episode.series}" — Ep ${episode.episodeNumber}: "${episode.title}"`);
    console.log(`[CinemaAgent] ${episode.scenes.length} scenes to process`);
    console.log("═".repeat(60));

    const results: GeneratedScene[] = [];

    for (const scene of episode.scenes) {
      const generated = await this.processScene(scene);
      results.push(generated);
      this.saveCheckpoint(episode, results);
    }

    const complete = results.filter(r => r.status === "complete").length;
    console.log(`\n[CinemaAgent] Episode complete: ${complete}/${episode.scenes.length} scenes OK`);

    return results;
  }

  // ── Checkpoint / Manifest ──────────────────────────────────────────────────

  private saveCheckpoint(episode: Episode, results: GeneratedScene[]): void {
    const dir = path.join(process.cwd(), "out_the_way_output");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const file = path.join(dir, `ep${episode.episodeNumber}_manifest.json`);
    fs.writeFileSync(file, JSON.stringify({ episode, results }, null, 2));
    console.log(`[CinemaAgent] 💾 Checkpoint saved → ${file}`);
  }

  getPostableClips(results: GeneratedScene[]): string[] {
    return results
      .filter(r => r.status === "complete")
      .map(r => r.lipSyncUrl ?? r.videoUrl ?? r.imageUrl!)
      .filter(Boolean);
  }
}

// ─── "Out the Way" — Episode 1 ───────────────────────────────────────────────

export const OUT_THE_WAY_EP1: Episode = {
  episodeNumber: 1,
  title: "No Looking Back",
  series: OUT_THE_WAY_SERIES,
  scenes: [
    {
      id: 1,
      description: "Young Black man in his mid-20s stands on a Brooklyn rooftop at golden hour, looking out at the skyline, jaw tight, eyes tired but determined",
      character: "Jaylen",
      location: "Brooklyn rooftop, golden hour, NYC skyline background",
      mood: "contemplative, tension building",
      dialogue: "I'm tired of almost making it.",
      camera: { lens: "85mm Portrait Prime", sensor: "Full-Frame Cine Digital", aperture: "f/1.8", movement: "slow push in on face" },
    },
    {
      id: 2,
      description: "Close-up of hands counting crumpled cash on a worn kitchen table, phone buzzing with unanswered calls beside it",
      character: "Jaylen",
      location: "dimly lit apartment kitchen, late night",
      mood: "desperate, quiet urgency",
      camera: { lens: "35mm Classic Anamorphic", aperture: "f/2.8", movement: "slow tilt up from hands to face" },
    },
    {
      id: 3,
      description: "Beautiful woman in her late-20s leans against a doorframe, arms crossed, hurt behind her eyes, waiting for an answer she already knows",
      character: "Mia",
      location: "apartment hallway, warm practical lighting",
      mood: "emotional confrontation",
      dialogue: "Every time, Jaylen. Every single time.",
      camera: { lens: "50mm Warm Cinema Prime", aperture: "f/2.0", movement: "locked off, slight rack focus" },
    },
    {
      id: 4,
      description: "Two men face off on a narrow street at night, orange streetlight cutting between them, tension electric",
      character: "Jaylen",
      location: "South Brooklyn side street, night, wet pavement reflecting orange light",
      mood: "confrontational, dangerous",
      dialogue: "You need to get out my way, Dre.",
      camera: { lens: "35mm Classic Anamorphic", aperture: "f/2.0", movement: "slow circular dolly around both figures" },
    },
    {
      id: 5,
      description: "Jaylen walks away down an empty street alone, hands in pockets, the city stretching out ahead of him, unsure but moving forward",
      character: "Jaylen",
      location: "Brooklyn street at night, wide establishing shot",
      mood: "resolve, bittersweet",
      camera: { lens: "24mm Wide Cinema Prime", aperture: "f/4.0", movement: "crane pullback as he walks forward" },
    },
  ],
};

// ─── Hapdabot Integration Hook ────────────────────────────────────────────────

export async function runOutTheWayEpisode(episodeNumber = 1): Promise<string[]> {
  const agent = new CinemaAgent();

  const episodeMap: Record<number, Episode> = {
    1: OUT_THE_WAY_EP1,
  };

  const episode = episodeMap[episodeNumber];
  if (!episode) throw new Error(`Episode ${episodeNumber} not defined yet`);

  const results = await agent.produceEpisode(episode);
  return agent.getPostableClips(results);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
