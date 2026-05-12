/**
 * FalVideoClient.ts
 * Cloud-based video generation using fal.ai's LTX-Video API.
 * No local ComfyUI server required — runs entirely in the cloud.
 *
 * Uses FAL_API_KEY from .env for authentication.
 */

import { log } from "../../core/config.js";
import axios from "axios";

const FAL_BASE = "https://queue.fal.run";

// LTX-Video text-to-video endpoint (fal.ai)
const LTX_ENDPOINT = "fal-ai/ltx-video";

export interface FalVideoOptions {
    prompt: string;
    negativePrompt?: string;
    /** Number of frames (e.g. 97 for ~4s at 24fps) */
    numFrames?: number;
    /** Frames per second */
    fps?: number;
    /** Width in pixels (must be multiple of 32) */
    width?: number;
    /** Height in pixels (must be multiple of 32) */
    height?: number;
    /** Number of inference steps */
    numInferenceSteps?: number;
    /** Guidance scale */
    guidanceScale?: number;
    seed?: number;
}

export interface FalVideoResult {
    success: boolean;
    videoUrl?: string;
    videoBuffer?: Buffer;
    error?: string;
    requestId?: string;
}

export class FalVideoClient {

    /**
     * Generate a video using fal.ai's LTX-Video model.
     * This submits a request, polls for completion, then downloads the result.
     */
    async generateVideo(options: FalVideoOptions): Promise<FalVideoResult> {
        const rawKey = process.env.FAL_API_KEY || "";
        const apiKey = rawKey.trim().replace(/['"]/g, ''); // Remove spaces and potential quotes
        
        if (!apiKey) {
            return { success: false, error: "FAL_API_KEY is not set in .env" };
        }

        const {
            prompt,
            negativePrompt = "low quality, worst quality, deformed, distorted, watermark, text, blurry",
            numFrames = 97,     // ~4 seconds at 24fps
            fps = 24,
            width = 704,        // 9:16 vertical (multiple of 32)
            height = 1280,
            numInferenceSteps = 30,
            guidanceScale = 7.5,
            seed = Math.floor(Math.random() * 2 ** 32),
        } = options;

        const headers = {
            "Authorization": `Key ${apiKey}`,
            "Content-Type": "application/json",
        };

        try {
            // Step 1: Submit the request to the queue
            log(`[FalVideo] 📤 Submitting video request to fal.ai...`);
            log(`[FalVideo] Prompt: "${prompt.slice(0, 100)}..."`);
            log(`[FalVideo] Settings: ${width}x${height}, ${numFrames} frames, ${fps}fps`);

            const submitRes = await fetch(`${FAL_BASE}/${LTX_ENDPOINT}`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    prompt,
                    negative_prompt: negativePrompt,
                    num_frames: numFrames,
                    num_inference_steps: numInferenceSteps,
                    guidance_scale: guidanceScale,
                    width,
                    height,
                    seed,
                }),
                signal: AbortSignal.timeout(30_000)
            });

            if (!submitRes.ok) {
                const text = await submitRes.text();
                throw new Error(`HTTP ${submitRes.status}: ${text}`);
            }

            const data = await submitRes.json();
            const requestId = data?.request_id;
            if (!requestId) {
                log(`[FalVideo] ❌ No request_id in submit response: ${JSON.stringify(data)}`, "error");
                return { success: false, error: "No request_id returned from fal.ai" };
            }

            log(`[FalVideo] ✅ Queued! Request ID: ${requestId}`);

            // Step 2: Poll for completion
            const result = await this.pollForResult(requestId, headers);
            return result;

        } catch (err: any) {
            const errMsg = err.response?.data?.detail || err.message;
            log(`[FalVideo] ❌ Request failed: ${errMsg}`, "error");
            return { success: false, error: errMsg };
        }
    }

    /**
     * Poll the fal.ai queue until the video is ready.
     */
    private async pollForResult(requestId: string, headers: Record<string, string>): Promise<FalVideoResult> {
        const statusUrl = `${FAL_BASE}/${LTX_ENDPOINT}/requests/${requestId}/status`;
        const resultUrl = `https://queue.fal.run/${LTX_ENDPOINT}/requests/${requestId}`;

        const maxAttempts = 120; // 10 minutes max (5s intervals)
        let attempts = 0;

        while (attempts < maxAttempts) {
            attempts++;
            await this.sleep(5_000); // 5 second intervals

            try {
                const statusRes = await fetch(`${statusUrl}?logs=1`, {
                    headers,
                    signal: AbortSignal.timeout(10_000)
                });

                if (!statusRes.ok) {
                    throw new Error(`HTTP ${statusRes.status}`);
                }

                const statusData = await statusRes.json();
                const status = statusData?.status;

                if (status === "IN_QUEUE") {
                    const pos = statusData?.queue_position ?? "?";
                    if (attempts % 6 === 0) { // Log every 30s
                        log(`[FalVideo] ⏳ In queue, position: ${pos} (${attempts * 5}s elapsed)`);
                    }
                    continue;
                }

                if (status === "IN_PROGRESS") {
                    if (attempts % 6 === 0) {
                        log(`[FalVideo] 🔄 Processing... (${attempts * 5}s elapsed)`);
                    }
                    continue;
                }

                if (status === "COMPLETED") {
                    log(`[FalVideo] ✅ Generation complete! Fetching result...`);

                    // Fetch the full result
                    const resultRes = await fetch(resultUrl, {
                        headers,
                        signal: AbortSignal.timeout(30_000)
                    });
                    
                    if (!resultRes.ok) throw new Error(`HTTP ${resultRes.status}`);
                    const data = await resultRes.json();

                    // fal.ai response format can vary — check multiple locations
                    const videoUrl = data?.video?.url || data?.video || data?.output?.url || data?.output?.[0]?.url || data?.url;

                    if (!videoUrl) {
                        log(`[FalVideo] ⚠️ No video URL in result. Keys: ${Object.keys(data || {}).join(", ")}`, "warn");
                        log(`[FalVideo] Full response: ${JSON.stringify(data).slice(0, 500)}`, "warn");
                        return { success: false, error: "No video URL in fal.ai response", requestId };
                    }

                    log(`[FalVideo] 📥 Downloading video from: ${videoUrl.slice(0, 80)}...`);

                    // Download the video bytes
                    const downloadRes = await fetch(videoUrl, {
                        signal: AbortSignal.timeout(120_000)
                    });
                    
                    if (!downloadRes.ok) throw new Error(`Failed to download video: HTTP ${downloadRes.status}`);

                    const arrayBuffer = await downloadRes.arrayBuffer();
                    const videoBuffer = Buffer.from(arrayBuffer);
                    log(`[FalVideo] ✅ Downloaded ${(videoBuffer.length / 1024 / 1024).toFixed(1)}MB video`);

                    return {
                        success: true,
                        videoUrl,
                        videoBuffer,
                        requestId,
                    };
                }

                if (status === "FAILED") {
                    const errorMsg = statusData?.error || "Unknown fal.ai error";
                    log(`[FalVideo] ❌ Generation failed: ${errorMsg}`, "error");
                    return { success: false, error: errorMsg, requestId };
                }

            } catch (pollErr: any) {
                if (attempts % 12 === 0) {
                    log(`[FalVideo] ⚠️ Poll error (attempt ${attempts}): ${pollErr.message}`, "warn");
                }
            }
        }

        return { success: false, error: `Timed out after ${maxAttempts * 5}s waiting for fal.ai`, requestId };
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

export const falVideoClient = new FalVideoClient();
