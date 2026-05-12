/**
 * comfyWorkflows.ts
 * Pre-built ComfyUI workflow templates.
 * Each function returns a fully-wired workflow JSON ready for ComfyClient.run().
 *
 * How ComfyUI workflows work:
 *   - Each node has a string ID ("1", "2", etc.)
 *   - Node inputs reference other nodes as ["nodeId", outputIndex]
 *   - Workflow is a DAG; ComfyUI resolves execution order automatically
 */

// ─── Text to Image (SD1.5 / SDXL compatible) ────────────────────────────────

export interface Txt2ImgOptions {
    /** The positive prompt describing what you want */
    prompt: string;
    /** Negative prompt — what to avoid */
    negativePrompt?: string;
    /** Checkpoint name as it appears in ComfyUI (must exist on the server) */
    checkpoint?: string;
    width?: number;
    height?: number;
    steps?: number;
    cfg?: number;
    seed?: number;
    sampler?: string;
    scheduler?: string;
}

export function buildTxt2ImgWorkflow(opts: Txt2ImgOptions): Record<string, any> {
    const {
        prompt,
        negativePrompt = "ugly, blurry, low quality, deformed, watermark",
        checkpoint = "v1-5-pruned-emaonly.safetensors",
        width = 512,
        height = 512,
        steps = 20,
        cfg = 7,
        seed = Math.floor(Math.random() * 2 ** 32),
        sampler = "euler_ancestral",
        scheduler = "normal",
    } = opts;

    return {
        "1": {
            class_type: "CheckpointLoaderSimple",
            inputs: { ckpt_name: checkpoint },
        },
        "2": {
            class_type: "CLIPTextEncode",
            inputs: { clip: ["1", 1], text: prompt },
        },
        "3": {
            class_type: "CLIPTextEncode",
            inputs: { clip: ["1", 1], text: negativePrompt },
        },
        "4": {
            class_type: "EmptyLatentImage",
            inputs: { width, height, batch_size: 1 },
        },
        "5": {
            class_type: "KSampler",
            inputs: {
                model: ["1", 0],
                positive: ["2", 0],
                negative: ["3", 0],
                latent_image: ["4", 0],
                seed,
                steps,
                cfg,
                sampler_name: sampler,
                scheduler,
                denoise: 1.0,
            },
        },
        "6": {
            class_type: "VAEDecode",
            inputs: { samples: ["5", 0], vae: ["1", 2] },
        },
        "7": {
            class_type: "SaveImage",
            inputs: { images: ["6", 0], filename_prefix: "gravity_claw" },
        },
    };
}

// ─── FLUX Text to Image (for FLUX.1 models) ─────────────────────────────────

export interface FluxTxt2ImgOptions {
    prompt: string;
    /** e.g. "flux1-dev.safetensors" or "flux1-schnell.safetensors" */
    checkpoint?: string;
    width?: number;
    height?: number;
    steps?: number;
    guidance?: number;
    seed?: number;
}

export function buildFluxTxt2ImgWorkflow(opts: FluxTxt2ImgOptions): Record<string, any> {
    const {
        prompt,
        checkpoint = "flux1-schnell.safetensors",
        width = 1024,
        height = 1024,
        steps = 4,
        guidance = 3.5,
        seed = Math.floor(Math.random() * 2 ** 32),
    } = opts;

    return {
        "1": {
            class_type: "CheckpointLoaderSimple",
            inputs: { ckpt_name: checkpoint },
        },
        "2": {
            class_type: "CLIPTextEncode",
            inputs: {
                clip: ["1", 1],
                text: prompt,
            },
        },
        "3": {
            class_type: "CLIPTextEncode",
            inputs: {
                clip: ["1", 1],
                text: "",
            },
        },
        "4": {
            class_type: "EmptyLatentImage",
            inputs: { width, height, batch_size: 1 },
        },
        "5": {
            class_type: "KSampler",
            inputs: {
                model: ["1", 0],
                positive: ["2", 0],
                negative: ["3", 0],
                latent_image: ["4", 0],
                seed,
                steps,
                cfg: guidance,
                sampler_name: "euler",
                scheduler: "simple",
                denoise: 1.0,
            },
        },
        "6": {
            class_type: "VAEDecode",
            inputs: { samples: ["5", 0], vae: ["1", 2] },
        },
        "7": {
            class_type: "SaveImage",
            inputs: { images: ["6", 0], filename_prefix: "gravity_claw_flux" },
        },
    };
}

// ─── Image Upscaling (4x upscale model) ─────────────────────────────────────

export interface UpscaleOptions {
    imageUrl: string;
    /** Upscale model name, e.g. "4x-UltraSharp.pth" */
    model?: string;
}

export function buildUpscaleWorkflow(opts: UpscaleOptions): Record<string, any> {
    const { imageUrl, model = "4x-UltraSharp.pth" } = opts;
    return {
        "1": {
            class_type: "LoadImageFromURL",
            inputs: { url: imageUrl },
        },
        "2": {
            class_type: "UpscaleModelLoader",
            inputs: { model_name: model },
        },
        "3": {
            class_type: "ImageUpscaleWithModel",
            inputs: { upscale_model: ["2", 0], image: ["1", 0] },
        },
        "4": {
            class_type: "SaveImage",
            inputs: { images: ["3", 0], filename_prefix: "gravity_upscaled" },
        },
    };
}

// ─── LTX-Video Text to Video (LTX-V 2B / 0.9) ────────────────────────────────

export interface LtxVideoOptions {
    prompt: string;
    /** Model name e.g. "LTXV/ltx-video-2b-v0.9.safetensors" */
    model?: string;
    /** Duration in seconds */
    duration?: number;
    /** Resolution e.g. "768x512" or "512x512" */
    resolution?: string;
    fps?: number;
}

export function buildLtxVideoWorkflow(opts: LtxVideoOptions): Record<string, any> {
    const {
        prompt,
        model = "LTXV/ltx-video-2b-v0.9.safetensors",
        duration = 2,
        resolution = "512x512",
        fps = 24
    } = opts;

    // Parse resolution (e.g. "720x1280")
    const [widthStr, heightStr] = resolution.split("x");
    const width = parseInt(widthStr) || 512;
    const height = parseInt(heightStr) || 512;
    
    // LTXV expects frame counts. duration * fps.
    const frameCount = Math.min(Math.max(Math.floor(duration * fps), 1), 128); // Cap at 128 for safety

    return {
        "1": {
            class_type: "LtxVideoCheckpointLoader",
            inputs: { ckpt_name: model },
        },
        "2": {
            class_type: "CLIPTextEncode",
            inputs: {
                clip: ["1", 1],
                text: prompt
            },
        },
        "3": {
            class_type: "CLIPTextEncode",
            inputs: {
                clip: ["1", 1],
                text: "low quality, blurry, distorted, deformed, text, watermark"
            },
        },
        "4": {
            class_type: "EmptyLatentVideo",
            inputs: {
                width: width,
                height: height,
                length: frameCount,
                batch_size: 1
            },
        },
        "5": {
            class_type: "LtxVideoSampler",
            inputs: {
                model: ["1", 0],
                positive: ["2", 0],
                negative: ["3", 0],
                latent_image: ["4", 0],
                seed: Math.floor(Math.random() * 2 ** 32),
                steps: 20,
                cfg: 3.5,
                sampler_name: "euler",
                scheduler: "simple",
                denoise: 1.0
            },
        },
        "6": {
            class_type: "VAEDecode",
            inputs: {
                samples: ["5", 0],
                vae: ["1", 2]
            },
        },
        "7": {
            class_type: "VHS_VideoCombine",
            inputs: {
                images: ["6", 0],
                frame_rate: fps,
                loop_count: 0,
                filename_prefix: "spider_jr_video",
                format: "video/h264-mp4",
                pingpong: false,
                save_output: true
            },
        }
    };
}

// ─── Workflow Template Registry ───────────────────────────────────────────────

export type WorkflowType = "txt2img" | "flux" | "upscale" | "video";

export const WORKFLOW_DESCRIPTIONS: Record<WorkflowType, string> = {
    txt2img: "Standard Stable Diffusion text-to-image (512x512–1024x1024)",
    flux:    "FLUX.1 high-quality text-to-image (schnell=fast, dev=quality)",
    upscale: "4x AI upscaling of an existing image URL",
    video:   "LTX-Video text-to-video generation (v0.9 2B)",
};
