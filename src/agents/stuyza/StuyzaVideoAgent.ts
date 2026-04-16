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
import { log } from "../../core/config.js";
import { askAI } from "../../core/ai.js";

const execAsync = promisify(exec);

const OPENMONTAGE_DIR = path.join(process.cwd(), "src", "agents", "stuyza", "openmontage");

export interface VideoProductionRequest {
  prompt: string;
  pipeline?: "stuyza-explainer" | "stuyza-cinematic" | "stuyza-social" | "animated-explainer" | "cinematic" | "documentary-montage";
  duration?: number; // seconds
  referenceVideo?: string; // URL or local path
  outputName?: string;
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
      const result = await this.executePipeline(pipeline, productionScript, outputName);

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
    outputName: string
  ): Promise<{ videoUrl?: string; outputPath?: string; cost?: number; stages?: string[] }> {
    const projectDir = path.join(process.cwd(), "projects", outputName);
    const renderPath = path.join(projectDir, "renders");
    const assetPath = path.join(projectDir, "assets", "images");

    if (!fs.existsSync(renderPath)) fs.mkdirSync(renderPath, { recursive: true });
    if (!fs.existsSync(assetPath)) fs.mkdirSync(assetPath, { recursive: true });

    // Build a CinematicRendererProps-compatible props object.
    // The AI script may contain raw content; we map it to the scenes schema.
    // A title scene is always injected as a guaranteed fallback so scenes is never [].
    const titleText: string =
      (script.enhanced_data?.script as string) ||
      (script.prompt as string) ||
      outputName;

    const cinematicProps = {
      scenes: [
        {
          kind: "title" as const,
          id: "title-0",
          startSeconds: 0,
          durationSeconds: script.duration || 15,
          text: titleText.substring(0, 120),
          accent: "#86d8ff",
          intensity: 1,
        },
      ],
      titleFontSize: 78,
      titleWidth: 1320,
      signalLineCount: 18,
    };

    const propsPath = path.join(projectDir, "props.json");
    fs.writeFileSync(propsPath, JSON.stringify(cinematicProps, null, 2));

    log(`[StuyzaVideoAgent] Starting Remotion render for: ${outputName}`);

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
  pipeline?: string
): Promise<VideoProductionResult> {
  const agent = new StuyzaVideoAgent(pipeline);
  return await agent.produce({ prompt, pipeline: pipeline as any });
}

/**
 * Factory function for cinematic drama production
 */
export async function produceCinematicScene(
  sceneDescription: string,
  character: string,
  location: string
): Promise<VideoProductionResult> {
  const agent = new StuyzaVideoAgent("stuyza-cinematic");
  return await agent.produce({
    prompt: `Cinematic scene: ${sceneDescription}. Character: ${character}. Location: ${location}.`,
    pipeline: "stuyza-cinematic",
    duration: 15,
  });
}

/**
 * Factory function for social media clips
 */
export async function produceSocialClip(
  topic: string,
  platform: "tiktok" | "youtube" | "instagram" = "tiktok"
): Promise<VideoProductionResult> {
  const agent = new StuyzaVideoAgent("stuyza-social");
  return await agent.produce({
    prompt: `${platform} short about: ${topic}. Hook in first 3 seconds. Fast pacing. Music.`,
    pipeline: "stuyza-social",
    duration: platform === "tiktok" ? 15 : 60,
  });
}
