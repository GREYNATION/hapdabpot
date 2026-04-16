/**
 * StuyzaVideoAgent.ts
 * TypeScript bridge to OpenMontage video production system
 *
 * Provides an interface between HapdaBot (TypeScript) and OpenMontage (Python)
 * for agentic video production.
 */

import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";
import { log, openai, config } from "../../core/config.js";
import { askAI } from "../../core/ai.js";

const execAsync = promisify(exec);

const OPENMONTAGE_DIR = path.join(process.cwd(), "src", "agents", "stuyza", "openmontage");

// ─── Multi-Scene Props Builder ────────────────────────────────────────────────

interface SceneBeat {
  title: string;
  imagePrompt: string;
  duration: number;
}

/**
 * Generates an ElevenLabs voiceover for the scene beats,
 * saves it to outputPath, and returns the file:// URI on success.
 */
async function generateNarration(
  beats: SceneBeat[],
  outputPath: string
): Promise<string | null> {
  const apiKey = process.env.ELEVEN_API_KEY || config.elevenKey;
  const voiceId = config.elevenVoiceId || "pNInz6obpgmqnzPCWZZf"; // Adam

  if (!apiKey) {
    log("[StuyzaVideoAgent] ElevenLabs key not set — skipping narration.", "warn");
    return null;
  }

  // Build a natural-sounding narration from beat titles
  const narration = beats
    .map((b, i) => {
      const clean = b.title.replace(/^TIP\s*\d+[:.]/i, "").trim();
      return `Tip ${i + 1}. ${clean}.`;
    })
    .join(" ");

  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": apiKey,
        },
        body: JSON.stringify({
          text: narration,
          model_id: "eleven_multilingual_v2",
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      log(`[StuyzaVideoAgent] ElevenLabs error: ${err}`, "warn");
      return null;
    }

    const buf = await res.arrayBuffer();
    fs.writeFileSync(outputPath, Buffer.from(buf));
    log(`[StuyzaVideoAgent] ✅ Narration saved to ${outputPath}`);
    return `file:///${outputPath.replace(/\\/g, "/")}`;
  } catch (e: any) {
    log(`[StuyzaVideoAgent] Narration failed: ${e.message}`, "warn");
    return null;
  }
}

/**
 * Builds a rich CinematicRendererProps from a prompt.
 * 1. AI splits the prompt into scene beats (tips, points, etc.)
 * 2. DALL-E 3 generates a cinematic image per beat
 * 3. ElevenLabs narrates each tip as a single voiceover track
 * 4. Scenes: intro title → [image + title] × N → outro CTA
 * Falls back gracefully if AI/images/narration fail.
 */
async function buildCinematicProps(
  prompt: string,
  assetPath: string,
  duration: number,
  pipeline: string = "stuyza-social",
  onProgress?: (msg: string) => Promise<void>
): Promise<object> {
  const isVertical = pipeline === "stuyza-social";
  // ── Step 1: AI Scene Planning ──────────────────────────────────────────────
  await onProgress?.("🧠 Planning scenes...");
  let beats: SceneBeat[] = [];
  try {
    const res = await askAI(
      `You are a social media video director. Break this prompt into 3-5 punchy video scenes:

Prompt: "${prompt}"

Return ONLY a JSON array. Each element must have:
- "title": short display text, max 8 words, ALL CAPS (e.g. "TIP 1: PRICE IT RIGHT")
- "imagePrompt": vivid DALL-E prompt, photorealistic, cinematic lighting, no text/watermarks
- "duration": seconds for this scene (3-5)

Example: [{"title":"TIP 1: PRICE IT RIGHT","imagePrompt":"Real estate agent presenting home, golden hour, wide angle, dramatic sky","duration":4}]

Return ONLY valid JSON array, no markdown fences.`,
      "You are a professional social media video director."
    );
    const clean = res.content.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    beats = JSON.parse(clean);
  } catch (e: any) {
    log(`[StuyzaVideoAgent] AI scene planning failed: ${e.message}`, "warn");
  }

  // ── Fallback: single title card ────────────────────────────────────────────
  if (!Array.isArray(beats) || beats.length === 0) {
    return {
      scenes: [{ kind: "title", id: "title-0", startSeconds: 0,
        durationSeconds: duration || 15, text: prompt.substring(0, 120),
        accent: "#86d8ff", intensity: 1 }],
      titleFontSize: 78, titleWidth: 1320, signalLineCount: 18,
    };
  }

  // ── Step 2: Generate Images with DALL-E 3 ─────────────────────────────────
  const scenes: object[] = [];
  let t = 0;

  // Opening title (2s)
  scenes.push({ kind: "title", id: "intro", startSeconds: t, durationSeconds: 2,
    text: prompt.replace(/^.*?:/,"").trim().toUpperCase().substring(0, 60),
    accent: "#86d8ff", intensity: 1.3 });
  t += 2;

  for (let i = 0; i < beats.length; i++) {
    const beat = beats[i];
    const beatDur = Math.min(5, Math.max(3, beat.duration || 4));

    // Try DALL-E 3
    let imageSrc: string | null = null;
    try {
      const imgRes = await openai.images.generate({
        model: "dall-e-3",
        prompt: `${beat.imagePrompt}. Cinematic, dramatic lighting, no text, no watermarks, photorealistic.`,
        n: 1,
        size: isVertical ? "1024x1792" : "1792x1024",
        quality: "standard",
      });
      const url = imgRes.data?.[0]?.url;
      if (url) {
        const buf = await fetch(url).then(r => r.arrayBuffer());
        const imgPath = path.join(assetPath, `scene-${i}.png`);
        fs.writeFileSync(imgPath, Buffer.from(buf));
        imageSrc = `file:///${imgPath.replace(/\\/g, "/")}`;
        log(`[StuyzaVideoAgent] ✅ Image ${i + 1}/${beats.length} generated`);
        await onProgress?.(`📸 Generating images... (${i + 1}/${beats.length})`);
      }
    } catch (imgErr: any) {
      log(`[StuyzaVideoAgent] Image gen failed for beat ${i}: ${imgErr.message}`, "warn");
    }

    // Image scene (if we got one)
    if (imageSrc) {
      scenes.push({ kind: "image", id: `img-${i}`, startSeconds: t,
        durationSeconds: beatDur, src: imageSrc,
        tone: "neutral", fadeInFrames: 12, fadeOutFrames: 8 });
      t += beatDur;
    }

    // Title card for this beat (2.5s after image, or full duration if no image)
    scenes.push({ kind: "title", id: `title-${i}`, startSeconds: t,
      durationSeconds: imageSrc ? 2.5 : beatDur,
      text: beat.title, accent: "#86d8ff", intensity: 0.85 });
    t += imageSrc ? 2.5 : beatDur;
  }

  // Outro CTA (2.5s)
  scenes.push({ kind: "title", id: "outro", startSeconds: t, durationSeconds: 2.5,
    text: "FOLLOW FOR MORE TIPS 🔥", accent: "#f5a623", intensity: 1.6 });

  // ── Step 3: ElevenLabs Narration ─────────────────────────────────────────
  await onProgress?.("🎙️ Generating voiceover...");
  const audioPath = path.join(assetPath, "narration.mp3");
  const narrationSrc = await generateNarration(beats, audioPath);

  return {
    scenes,
    vertical: isVertical,
    titleFontSize: isVertical ? 64 : 72,
    titleWidth: isVertical ? 900 : 1280,
    signalLineCount: 14,
    ...(narrationSrc ? {
      soundtrack: {
        src: narrationSrc,
        volume: 1,
        fadeInSeconds: 0.3,
        fadeOutSeconds: 1.0,
      }
    } : {}),
  };
}


export interface VideoProductionRequest {
  prompt: string;
  pipeline?: "stuyza-explainer" | "stuyza-cinematic" | "stuyza-social" | "animated-explainer" | "cinematic" | "documentary-montage";
  duration?: number;
  referenceVideo?: string;
  outputName?: string;
  /** Optional progress callback — called at each production stage */
  onProgress?: (msg: string) => Promise<void>;
}

export interface VideoProductionResult {
  status: "success" | "error" | "in_progress";
  videoUrl?: string;
  outputPath?: string;
  cost?: number;
  message?: string;
  error?: string;
  stages?: string[];
}

/**
 * StuyzaVideoAgent - Agentic video production for Stuyza Productions
 *
 * Wraps OpenMontage pipelines to create:
 * - Real estate explainers
 * - Cinematic drama series
 * - Social media clips
 */
export class StuyzaVideoAgent {
  private pipeline: string;
  private outputDir: string;

  constructor(pipeline: string = "stuyza-explainer") {
    this.pipeline = pipeline;
    this.outputDir = path.join(process.cwd(), "data", "stuyza-productions");

    // Ensure output directory exists
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * Main entry point: Produce a video from a text prompt
   */
  async produce(request: VideoProductionRequest): Promise<VideoProductionResult> {
    const pipeline = request.pipeline || this.pipeline;
    const outputName = request.outputName || `stuyza-${Date.now()}`;

    log(`[StuyzaVideoAgent] Starting production: ${pipeline}`);
    log(`[StuyzaVideoAgent] Prompt: ${request.prompt}`);

    try {
      // Step 1: Run preflight to check capabilities
      const capabilities = await this.checkCapabilities();
      log(`[StuyzaVideoAgent] Available tools: ${JSON.stringify(capabilities)}`);

      // Step 2: Generate the production script
      const productionScript = await this.generateProductionScript(request);

      // Step 3: Execute the pipeline
      const result = await this.executePipeline(pipeline, productionScript, outputName, request.onProgress);

      return {
        status: "success",
        videoUrl: result.videoUrl,
        outputPath: result.outputPath,
        cost: result.cost,
        message: `✅ Video produced successfully!\n🎬 Pipeline: ${pipeline}\n💰 Estimated cost: $${result.cost?.toFixed(2) || "unknown"}`,
        stages: result.stages,
      };
    } catch (error: any) {
      log(`[StuyzaVideoAgent] Production failed: ${error.message}`, "error");
      return {
        status: "error",
        error: error.message,
        message: `❌ Production failed: ${error.message}`,
      };
    }
  }

  /**
   * Check available tools and capabilities
   */
  private async checkCapabilities(): Promise<any> {
    try {
      const pythonScript = `
import sys
sys.path.insert(0, '${OPENMONTAGE_DIR}')
from tools.tool_registry import registry
import json
registry.discover()
print(json.dumps(registry.support_envelope(), indent=2))
      `;

      const { stdout } = await execAsync(`python -c "${pythonScript.replace(/"/g, '\\"')}"`, {
        cwd: OPENMONTAGE_DIR,
        timeout: 30000,
      });

      return JSON.parse(stdout);
    } catch (error: any) {
      log(`[StuyzaVideoAgent] Capability check failed: ${error.message}`, "warn");
      return { available: false };
    }
  }

  /**
   * Generate a production script from the user's prompt
   */
  private async generateProductionScript(request: VideoProductionRequest): Promise<any> {
    log(`[StuyzaVideoAgent] Enhancing prompt with AI...`);
    
    const aiResponse = await askAI(
      `Generate a structured video script JSON for: "${request.prompt}". 
       Pipeline: ${request.pipeline}. 
       Return ONLY JSON with "script", "scenes", and "visual_style" keys.`,
      "You are a professional video producer for Stuyza Productions."
    );

    let enhancedData = { script: request.prompt, scenes: [] };
    try {
      enhancedData = JSON.parse(aiResponse.content);
    } catch (e) {
      log(`[StuyzaVideoAgent] AI enhancement failed, using raw prompt.`, "warn");
    }

    // Create a production script JSON
    const script = {
      version: "1.0",
      pipeline: request.pipeline,
      prompt: request.prompt,
      duration: request.duration || 60,
      enhanced_data: enhancedData,
      reference_video: request.referenceVideo,
      stages: {
        research: { enabled: true },
        script: { enabled: true },
        scene_plan: { enabled: true },
        assets: { enabled: true },
        edit: { enabled: true },
        compose: { enabled: true },
      },
      output: {
        name: request.outputName || `stuyza-${Date.now()}`,
        format: "mp4",
        resolution: "1080p",
      },
    };

    return script;
  }

  /**
   * Execute the cinematic production pipeline
   */
  private async executePipeline(
    pipeline: string,
    script: any,
    outputName: string,
    onProgress?: (msg: string) => Promise<void>
  ): Promise<{ videoUrl?: string; outputPath?: string; cost?: number; stages?: string[] }> {
    const projectDir = path.join(process.cwd(), "projects", outputName);
    const renderPath = path.join(projectDir, "renders");
    const assetPath = path.join(projectDir, "assets", "images");

    if (!fs.existsSync(renderPath)) fs.mkdirSync(renderPath, { recursive: true });
    if (!fs.existsSync(assetPath)) fs.mkdirSync(assetPath, { recursive: true });

    // Build rich multi-scene CinematicRendererProps (AI scenes + DALL-E images)
    log(`[StuyzaVideoAgent] Building multi-scene props for: ${outputName}`);
    const cinematicProps = await buildCinematicProps(
      script.prompt as string,
      assetPath,
      script.duration as number || 15,
      pipeline,
      onProgress
    );

    const propsPath = path.join(projectDir, "props.json");
    fs.writeFileSync(propsPath, JSON.stringify(cinematicProps, null, 2));

    log(`[StuyzaVideoAgent] Starting Remotion render for: ${outputName}`);
    await onProgress?.("🎬 Rendering video...");

    try {
      // Execute Remotion render — composition must match Root.tsx id="CinematicRenderer"
      const composerDir = path.join(process.cwd(), "src/agents/stuyza/openmontage/remotion-composer");
      const outputFilePath = path.join(renderPath, "final.mp4");

      const renderCmd = `npx -y remotion render src/index.tsx CinematicRenderer ${outputFilePath} --props ${propsPath} --codec h264`;
      
      log(`[StuyzaVideoAgent] Executing: ${renderCmd} in ${composerDir}`);
      try {
        await execAsync(renderCmd, { cwd: composerDir });
      } catch (childErr: any) {
        log(`[StuyzaVideoAgent] Child process error: ${childErr.stdout || childErr.stderr || childErr.message}`, "error");
        throw childErr;
      }

      return {
        videoUrl: `file://${outputFilePath}`,
        outputPath: outputFilePath,
        cost: 0.05, // Estimated neural compute cost
        stages: ["research", "script", "scene_plan", "assets", "edit", "compose"],
      };
    } catch (err: any) {
      log(`[StuyzaVideoAgent] Rendering failed: ${err.message}`, "error");
      throw new Error(`Cinematic rendering engine failed: ${err.message}`);
    }
  }

  /**
   * Get available pipelines
   */
  getAvailablePipelines(): string[] {
    const pipelineDir = path.join(OPENMONTAGE_DIR, "pipeline_defs");

    if (!fs.existsSync(pipelineDir)) {
      return ["stuyza-explainer", "stuyza-cinematic", "stuyza-social"];
    }

    try {
      const files = fs.readdirSync(pipelineDir);
      return files
        .filter((f) => f.endsWith(".yaml"))
        .map((f) => f.replace(".yaml", ""));
    } catch {
      return ["stuyza-explainer", "stuyza-cinematic", "stuyza-social"];
    }
  }

  /**
   * Analyze a reference video
   */
  async analyzeReferenceVideo(videoUrl: string): Promise<any> {
    log(`[StuyzaVideoAgent] Analyzing reference video: ${videoUrl}`);

    // TODO: Implement video analysis using OpenMontage tools
    return {
      style: "cinematic",
      pacing: "fast",
      duration: 60,
      key_elements: ["hook", "problem", "solution", "cta"],
    };
  }
}

/**
 * Factory function for quick video production
 */
export async function produceVideo(
  prompt: string,
  pipeline?: string,
  onProgress?: (msg: string) => Promise<void>
): Promise<VideoProductionResult> {
  const agent = new StuyzaVideoAgent(pipeline);
  return await agent.produce({ prompt, pipeline: pipeline as any, onProgress });
}

/**
 * Factory function for cinematic drama production
 */
export async function produceCinematicScene(
  sceneDescription: string,
  character: string,
  location: string,
  onProgress?: (msg: string) => Promise<void>
): Promise<VideoProductionResult> {
  const agent = new StuyzaVideoAgent("stuyza-cinematic");
  return await agent.produce({
    prompt: `Cinematic scene: ${sceneDescription}. Character: ${character}. Location: ${location}.`,
    pipeline: "stuyza-cinematic",
    duration: 15,
    onProgress,
  });
}

/**
 * Factory function for social media clips
 */
export async function produceSocialClip(
  topic: string,
  platform: "tiktok" | "youtube" | "instagram" = "tiktok",
  onProgress?: (msg: string) => Promise<void>
): Promise<VideoProductionResult> {
  const agent = new StuyzaVideoAgent("stuyza-social");
  return await agent.produce({
    prompt: `${platform} short about: ${topic}. Hook in first 3 seconds. Fast pacing. Music.`,
    pipeline: "stuyza-social",
    duration: platform === "tiktok" ? 15 : 60,
    onProgress,
  });
}
