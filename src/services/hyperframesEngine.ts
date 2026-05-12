import { log } from "../core/config.js";
import { falVideoClient } from "../agents/spider/FalVideoClient.js";
import { comfyAgent } from "../agents/comfy/ComfyAgent.js";
import { ScriptPackage } from "./scriptEngine.js";
import { VoiceService } from "./voiceService.js";
import * as fs from "fs";
import * as path from "path";
import { exec } from "child_process";
import util from "util";

const execAsync = util.promisify(exec);

const VIDEO_DIR = process.env.VIDEO_DIR || "./videos/hyperframes";

export class HyperFramesEngine {
    
    /**
     * Phase 3: Generates cinematic B-Roll based on the Adaptive Script's B-Roll Prompt using Fal.ai (LTX-Video).
     * Now also generates the voiceover and merges them together for a complete TikTok-ready video!
     */
    static async generateCinematicBRoll(scriptPackage: ScriptPackage, onProgress?: (msg: string) => void): Promise<{ success: boolean; url?: string; error?: string }> {
        log(`[HyperFrames] 🎥 Initializing Cinematic B-Roll Generation for: ${scriptPackage.trend.title}`);
        
        try {
            if (!fs.existsSync(VIDEO_DIR)) {
                fs.mkdirSync(VIDEO_DIR, { recursive: true });
            }

            const safeTitle = scriptPackage.trend.title.replace(/[^a-z0-9]/gi, '_').toLowerCase().substring(0, 30);
            const timestamp = Date.now();
            
            // 1. Generate Voiceover
            onProgress?.(`🎙️ Generating Voiceover using profile: *${scriptPackage.voiceProfile}*...`);
            const audioBuffer = await VoiceService.synthesize(scriptPackage.script, scriptPackage.voiceProfile as any);
            
            let audioPath = "";
            if (audioBuffer) {
                audioPath = path.join(VIDEO_DIR, `audio_${safeTitle}_${timestamp}.mp3`);
                fs.writeFileSync(audioPath, audioBuffer);
                onProgress?.(`✅ Voiceover generated!`);
            } else {
                onProgress?.(`⚠️ Failed to generate voiceover. Proceeding with video only.`);
            }

            // 2. Generate B-Roll Visuals
            let videoBuffer: Buffer | undefined;

            onProgress?.(`☁️ *HyperFrames Engine* starting...\nSending prompt to Fal.ai (LTX-Video)...`);
            const falResult = await falVideoClient.generateVideo({
                prompt: scriptPackage.brollPrompt,
                width: 704,
                height: 1280, // Vertical video for TikTok/Shorts
                numFrames: 97,  // ~4 seconds at 24fps looping
                fps: 24,
                numInferenceSteps: 30,
                guidanceScale: 7.5,
            });

            if (falResult.success && falResult.videoBuffer) {
                videoBuffer = falResult.videoBuffer;
                onProgress?.(`✅ Cloud Visuals generated successfully! (${(videoBuffer.length / 1024 / 1024).toFixed(1)}MB)`);
            } else {
                log(`[HyperFrames] ⚠️ Fal.ai generation failed: ${falResult.error}. Attempting local ComfyUI fallback...`, "warn");
                onProgress?.(`⚠️ Cloud generation failed (${falResult.error}).\n🔄 Falling back to local ComfyUI LTX-Video cluster...`);
                
                const comfyResult = await comfyAgent.video(scriptPackage.brollPrompt, {
                    duration: 4,
                    resolution: "704x1280",
                    fps: 24
                });

                if (comfyResult.videoBuffers && comfyResult.videoBuffers.length > 0) {
                    videoBuffer = comfyResult.videoBuffers[0];
                    onProgress?.(`✅ Local Visuals generated successfully! (${(videoBuffer.length / 1024 / 1024).toFixed(1)}MB)`);
                } else {
                    return { success: false, error: `Cloud failed (${falResult.error}) and Local ComfyUI failed to return video buffers.` };
                }
            }

            const videoPath = path.join(VIDEO_DIR, `video_${safeTitle}_${timestamp}.mp4`);
            fs.writeFileSync(videoPath, videoBuffer);

            // 3. Merge Audio and Video (Loop video to match audio length if audio exists)
            if (audioPath) {
                onProgress?.(`🎬 Merging Voiceover and Cinematic B-Roll...`);
                const finalPath = path.join(VIDEO_DIR, `final_${safeTitle}_${timestamp}.mp4`);
                
                // Use FFmpeg to loop the 4-second video to match the audio length
                // -stream_loop -1 loops the input video indefinitely
                // -shortest stops encoding when the shortest stream (the audio) ends
                const ffmpegCmd = `ffmpeg -stream_loop -1 -i "${videoPath}" -i "${audioPath}" -c:v copy -c:a aac -shortest "${finalPath}" -y`;
                
                try {
                    await execAsync(ffmpegCmd);
                    log(`[HyperFrames] ✅ Final merged video saved to: ${finalPath}`);
                    return { success: true, url: finalPath };
                } catch (ffmpegErr: any) {
                    log(`[HyperFrames] ⚠️ FFmpeg merge failed: ${ffmpegErr.message}. Returning raw video.`, "warn");
                    return { success: true, url: videoPath };
                }
            }

            log(`[HyperFrames] ✅ Cinematic B-Roll saved to: ${videoPath}`);
            return { success: true, url: videoPath };

        } catch (err: any) {
            log(`[HyperFrames] ❌ Fatal error in generation pipeline: ${err.message}`, "error");
            return { success: false, error: err.message };
        }
    }
}
