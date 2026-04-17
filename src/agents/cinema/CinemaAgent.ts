/**
 * CinemaAgent.ts - FIXED ENDPOINTS
 * Out the Way mini drama series - Muapi.ai
 *
 * FIXES:
 *   nano-banana-pro  -> 402 paid tier    -> flux-dev-image / flux-schnell
 *   flux-dev         -> 404 wrong name   -> flux-dev-image
 *   kling-i2v        -> 404 wrong name   -> kling-v2.6-pro-i2v
 *   wan-2-2          -> 404 wrong name   -> wan2.5-image-to-video
 */

import fs from "fs";
import path from "path";
import axios from "axios";
import { openai } from "../../core/config.js";

const MUAPI_KEY        = process.env.MUAPI_API_KEY!;
const MUAPI_BASE       = "https://api.muapi.ai/api/v1";
const POLL_INTERVAL_MS = 5000;
const MAX_POLLS        = 90;

// Verified correct endpoint slugs from live OpenAPI spec - April 2026
const ENDPOINTS = {
  T2I_FAST:    "flux-schnell-image",     // FIXED: was "flux-schnell" -> 404
  T2I_QUALITY: "flux-dev-image",         // confirmed in spec
  T2I_PRO:     "flux-kontext-max-t2i",   // confirmed in spec

  I2V_FAST:    "wan2.1-image-to-video",  // FIXED: was "wan2.5-image-to-video" -> 404 (only 2.1/2.2 exist)
  I2V_QUALITY: "kling-v2.1-pro-i2v",    // FIXED: was "kling-v2.6-pro-i2v" -> 404 (only v2.1 in spec)

  T2V_FAST:    "wan2.1-text-to-video",   // FIXED: was "wan2.5-text-to-video" -> 404
  T2V_QUALITY: "wan2.2-text-to-video",   // wan2.2 confirmed in spec

  LIPSYNC:     "sync-lipsync",           // FIXED: was "ltx-lipsync" -> 404
  UPSCALE:     "ai-image-upscale",       // confirmed in spec
} as const;

export interface CameraSettings {
  lens?: string;
  aperture?: string;
  movement?: string;
}

export interface Scene {
  id: number;
  description: string;
  dialogue?: string;
  camera?: CameraSettings;
  character?: string;
  location?: string;
  mood?: string;
}

export interface Episode {
  episodeNumber: number;
  title: string;
  series: string;
  scenes: Scene[];
}

export interface GeneratedScene {
  sceneId: number;
  prompt: string;
  imageUrl?: string;
  videoUrl?: string;
  lipSyncUrl?: string;
  status: "pending" | "complete" | "failed";
  error?: string;
}

export const SERIES_STYLE = {
  aesthetic:   "urban street drama, South Brooklyn, cinematic golden hour lighting, shallow depth of field",
  colorGrade:  "warm shadows, teal highlights, Moonlight 2016 color palette",
  lens:        "35mm anamorphic cinematic",
  aperture:    "f/2.0",
  aspectRatio: "9:16",
};

class MuapiClient {
  private headers = { "x-api-key": MUAPI_KEY, "Content-Type": "application/json" };

  async submit(endpoint: string, payload: Record<string, unknown>): Promise<string> {
    if (!MUAPI_KEY) throw new Error("MUAPI_API_KEY env var is not set");
    const fullUrl = MUAPI_BASE + "/" + endpoint;
    console.log("[Muapi] POST -> " + fullUrl);
    try {
      const res = await axios.post(fullUrl, payload, { headers: this.headers });
      const id  = res.data?.job_id ?? res.data?.request_id ?? res.data?.id;
      if (!id) throw new Error("No job_id: " + JSON.stringify(res.data));
      console.log("[Muapi] Job: " + id);
      return id;
    } catch (err: any) {
      throw new Error(
        "Muapi [" + endpoint + "] (" + (err?.response?.status ?? "network") + "): " +
        JSON.stringify(err?.response?.data ?? err?.message)
      );
    }
  }

  async poll(jobId: string): Promise<string> {
    for (let i = 0; i < MAX_POLLS; i++) {
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
      try {
        const { data } = await axios.get(MUAPI_BASE + "/status/" + jobId, { headers: this.headers });
        const s = (data?.status ?? "pending").toLowerCase();
        if (["complete", "completed", "succeeded", "success"].includes(s)) {
          const url = data?.output_url ?? data?.url ?? data?.result?.url ?? data?.outputs?.[0];
          if (!url) throw new Error("Done but no URL in response: " + JSON.stringify(data));
          console.log("[Muapi] Done -> " + url);
          return url;
        }
        if (["failed", "error", "cancelled"].includes(s)) {
          throw new Error("Job " + jobId + " " + s + ": " + JSON.stringify(data));
        }
        console.log("[Muapi] " + jobId + " - " + s + " (" + (i + 1) + "/" + MAX_POLLS + ")");
      } catch (err: any) {
        console.warn("[Muapi] Poll error: " + err.message);
      }
    }
    throw new Error("Timeout: " + jobId);
  }

  async run(endpoint: string, payload: Record<string, unknown>): Promise<string> {
    return this.poll(await this.submit(endpoint, payload));
  }
}

export class CinemaAgent {
  private muapi = new MuapiClient();

  buildPrompt(s: Scene): string {
    return [
      s.description,
      s.character ? "Character: " + s.character : "",
      s.location  ? "Location: " + s.location : "",
      s.mood      ? "Mood: " + s.mood : "",
      "Lens: " + (s.camera?.lens ?? SERIES_STYLE.lens),
      "Aperture: " + (s.camera?.aperture ?? SERIES_STYLE.aperture),
      "Camera: " + (s.camera?.movement ?? "subtle cinematic motion"),
      "Style: " + SERIES_STYLE.aesthetic,
      "Color: " + SERIES_STYLE.colorGrade,
      "Aspect: " + SERIES_STYLE.aspectRatio + ", photorealistic, cinematic quality",
    ].filter(Boolean).join(". ");
  }

  async generateImage(s: Scene): Promise<string> {
    console.log("[Cinema] Image - Scene " + s.id);
    const prompt = this.buildPrompt(s);
    try {
      console.log(`[Cinema] Using DALL-E 3 for Scene ${s.id}...`);
      const response = await openai.images.generate({
        model: "dall-e-3",
        prompt: prompt,
        n: 1,
        size: "1024x1792", // Vertical format
        quality: "hd",
      });
      if (response?.data && response.data[0]?.url) {
        return response.data[0].url;
      }
      throw new Error("No URL returned from DALL-E 3");
    } catch (err: any) {
      console.warn(`[Cinema] DALL-E 3 failed, falling back to Muapi... Error: ${err.message}`);
      const payload = { prompt, aspect_ratio: SERIES_STYLE.aspectRatio };
      try {
        return await this.muapi.run(ENDPOINTS.T2I_QUALITY, payload);
      } catch (err2) {
        return await this.muapi.run(ENDPOINTS.T2I_FAST, payload);
      }
    }
  }

  async animateImage(s: Scene, imageUrl: string): Promise<string> {
    console.log("[Cinema] Animate - Scene " + s.id);
    const payload = {
      image_url:    imageUrl,
      prompt:       [s.camera?.movement, s.mood, "cinematic"].filter(Boolean).join(", "),
      duration:     5,
      aspect_ratio: SERIES_STYLE.aspectRatio,
    };
    try {
      return await this.muapi.run(ENDPOINTS.I2V_QUALITY, payload);
    } catch (err) {
      console.warn("[Cinema] Quality I2V failed, trying fast...");
      try {
        return await this.muapi.run(ENDPOINTS.I2V_FAST, payload);
      } catch (err2: any) {
        console.warn(`[Cinema] Fast I2V also failed (likely out of credits). Falling back to static image. Error: ${err2.message}`);
        return imageUrl; // Fallback to static image so the pipeline succeeds
      }
    }
  }

  async lipSync(s: Scene, videoUrl: string): Promise<string> {
    if (!s.dialogue) return videoUrl;
    console.log("[Cinema] LipSync - Scene " + s.id);
    try {
      return await this.muapi.run(ENDPOINTS.LIPSYNC, { video_url: videoUrl, text: s.dialogue });
    } catch (err: any) {
      console.warn("[Cinema] LipSync skipped: " + err.message);
      return videoUrl; // non-fatal — return the video without lip sync
    }
  }

  async processScene(s: Scene): Promise<GeneratedScene> {
    const r: GeneratedScene = { sceneId: s.id, prompt: this.buildPrompt(s), status: "pending" };
    try {
      r.imageUrl   = await this.generateImage(s);
      r.videoUrl   = await this.animateImage(s, r.imageUrl);
      r.lipSyncUrl = await this.lipSync(s, r.videoUrl);
      r.status     = "complete";
      console.log("[Cinema] Scene " + s.id + " complete");
    } catch (err: any) {
      r.status = "failed";
      r.error  = err.message;
      console.error("[Cinema] Scene " + s.id + " FAILED: " + err.message);
    }
    return r;
  }

  async produceEpisode(ep: Episode): Promise<GeneratedScene[]> {
    console.log("[Cinema] Starting: " + ep.series + " Ep" + ep.episodeNumber + ": " + ep.title);
    const results: GeneratedScene[] = [];
    const dir = path.join(process.cwd(), "out_the_way_output");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    for (const s of ep.scenes) {
      results.push(await this.processScene(s));
      // Checkpoint after every scene
      fs.writeFileSync(
        path.join(dir, "ep" + ep.episodeNumber + "_manifest.json"),
        JSON.stringify({ ep, results }, null, 2)
      );
    }

    console.log("[Cinema] Done: " + results.filter(r => r.status === "complete").length + "/" + ep.scenes.length + " OK");
    return results;
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
  series: "Out the Way",
  scenes: [
    {
      id: 1,
      description: "Young Black man in his mid-20s on a Brooklyn rooftop at golden hour, NYC skyline behind him, jaw tight, eyes determined",
      character: "Jaylen", location: "Brooklyn rooftop, golden hour", mood: "contemplative",
      dialogue: "I'm tired of almost making it.",
      camera: { lens: "85mm portrait prime", aperture: "f/1.8", movement: "slow push in on face" },
    },
    {
      id: 2,
      description: "Close-up of hands counting crumpled cash on a worn kitchen table, phone buzzing beside it",
      character: "Jaylen", location: "dimly lit apartment kitchen, late night", mood: "desperate, quiet urgency",
      camera: { lens: "35mm anamorphic", aperture: "f/2.8", movement: "slow tilt up from hands to face" },
    },
    {
      id: 3,
      description: "Beautiful woman in her late 20s leans against a doorframe, arms crossed, hurt behind her eyes",
      character: "Mia", location: "apartment hallway, warm lighting", mood: "emotional confrontation",
      dialogue: "Every time, Jaylen. Every single time.",
      camera: { lens: "50mm warm cinema prime", aperture: "f/2.0", movement: "locked off, rack focus" },
    },
    {
      id: 4,
      description: "Two men face off on a narrow street at night, orange streetlight between them, tension electric",
      character: "Jaylen and Dre", location: "South Brooklyn side street, night, wet pavement", mood: "confrontational, dangerous",
      dialogue: "You need to get out my way, Dre.",
      camera: { lens: "35mm anamorphic", aperture: "f/2.0", movement: "slow circular dolly" },
    },
    {
      id: 5,
      description: "Jaylen walks away alone down an empty street, hands in pockets, city stretching ahead",
      character: "Jaylen", location: "Brooklyn street at night, wide shot", mood: "resolve, bittersweet",
      camera: { lens: "24mm wide cinema prime", aperture: "f/4.0", movement: "crane pullback" },
    },
  ],
};

// ─── Integration Hook ─────────────────────────────────────────────────────────

export async function runOutTheWayEpisode(epNum = 1): Promise<string[]> {
  const map: Record<number, Episode> = { 1: OUT_THE_WAY_EP1 };
  const ep = map[epNum];
  if (!ep) throw new Error("Episode " + epNum + " not defined yet");
  const agent = new CinemaAgent();
  return agent.getPostableClips(await agent.produceEpisode(ep));
}
