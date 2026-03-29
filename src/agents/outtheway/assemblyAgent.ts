// ============================================================
// OUT THE WAY â€” Assembly Agent
// Combines clips into a final 9:16 vertical video
// Adds subtitles and audio using fluent-ffmpeg
// ============================================================

import fs from "fs";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import { log } from "../../core/config.js";
import type { Episode, Scene, AgentEvent } from "./types.js";
import type { MonitoringAgent } from "./monitoringAgent.js";

const BASE_DIR   = process.env.DATA_DIR ?? path.join(process.cwd(), "data");
const OUTPUT_DIR = path.join(BASE_DIR, "outtheway", "output");
const CLIPS_DIR  = path.join(BASE_DIR, "outtheway", "clips");

export class AssemblyAgent {
    private monitor: MonitoringAgent;

    constructor(monitor: MonitoringAgent) {
        this.monitor = monitor;
    }

    private emit(status: AgentEvent["status"], message: string, output?: string): void {
        this.monitor.report({ agent: "assembly", status, message, timestamp: "", output });
    }

    /**
     * Assemble all produced scenes into a single vertical mp4.
     * Returns the path to the final video file.
     */
    async assembleEpisode(episode: Episode, scenes: Scene[]): Promise<string> {
        this.ensureOutputDir();
        this.emit("active", `Starting assembly for episode ${episode.episodeNumber} (${scenes.length} scenes)`);
        log(`[assembly] Assembling episode ${episode.episodeNumber} from ${scenes.length} scenes`);

        const outputPath = path.join(OUTPUT_DIR, `ep_${episode.episodeNumber}_final.mp4`);
        const metaPath   = path.join(OUTPUT_DIR, `ep_${episode.episodeNumber}_assembly.json`);

        // Gather clip paths (use stub json files if real clips don't exist yet)
        const clipPaths  = scenes.map(s => s.clipPath).filter(Boolean) as string[];
        const audioPaths = scenes.map(s => s.audioPath).filter(Boolean) as string[];

        // Check which clips actually exist vs are stubs
        const existingClips  = clipPaths.filter(p => fs.existsSync(p));
        const stubClips      = clipPaths.filter(p => !fs.existsSync(p));

        if (stubClips.length > 0) {
            log(`[assembly] âš ï¸  ${stubClips.length} clip(s) are stubs (not yet generated). Creating assembly manifest.`, "warn");
        }

        // Write assembly manifest regardless
        const manifest = {
            episode: episode.episodeNumber,
            title: episode.title,
            outputPath,
            totalScenes: scenes.length,
            clips: clipPaths.map((p, i) => ({
                scene: i + 1,
                clipPath: p,
                audioPath: audioPaths[i] ?? null,
                exists: fs.existsSync(p)
            })),
            subtitles: this.buildSubtitleScript(episode, scenes),
            resolution: "1080x1920", // 9:16 vertical
            assembledAt: new Date().toISOString()
        };

        fs.writeFileSync(metaPath, JSON.stringify(manifest, null, 2), "utf-8");
        log(`[assembly] ðŸ“‹ Assembly manifest saved: ${metaPath}`);

        // If real MP4 clips exist, attempt actual FFmpeg concat
        if (existingClips.length > 0) {
            try {
                await this.concatClips(existingClips, audioPaths, outputPath);
                episode.finalVideoPath = outputPath;
                this.monitor.setFinalVideo(outputPath);
                this.emit("completed", `Episode ${episode.episodeNumber} assembled`, outputPath);
                log(`[assembly] âœ… Final video: ${outputPath}`);
            } catch (err: any) {
                this.emit("failed", `FFmpeg assembly failed: ${err.message}`);
                log(`[assembly] âŒ FFmpeg error: ${err.message}`, "error");
                throw err;
            }
        } else {
            // All stubs â€” record manifest as the output
            episode.finalVideoPath = metaPath;
            this.monitor.setFinalVideo(metaPath);
            this.emit("completed", `Assembly manifest ready (no real clips yet) â€” ep ${episode.episodeNumber}`, metaPath);
            log(`[assembly] ðŸ“„ No real clips â€” manifest ready at ${metaPath}`);
        }

        return episode.finalVideoPath!;
    }

    /** FFmpeg: concatenate clips and merge audio into final vertical mp4 */
    private async concatClips(
        clipPaths: string[],
        audioPaths: string[],
        outputPath: string
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            // Build a concat text file for ffmpeg
            const concatFile = path.join(OUTPUT_DIR, "_concat.txt");
            const concatContent = clipPaths.map(p => `file '${p.replace(/\\/g, "/")}'`).join("\n");
            fs.writeFileSync(concatFile, concatContent, "utf-8");

            log(`[assembly] ðŸŽ¬ Running FFmpeg concat...`);

            const cmd = ffmpeg()
                .input(concatFile)
                .inputOptions(["-f concat", "-safe 0"])
                .videoFilter("scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2")
                .videoCodec("libx264")
                .audioCodec("aac")
                .outputOptions(["-crf 23", "-preset fast", "-movflags +faststart"])
                .output(outputPath);

            // Merge first audio track if it exists
            if (audioPaths.length > 0 && fs.existsSync(audioPaths[0])) {
                cmd.input(audioPaths[0]);
            }

            cmd
                .on("end", () => resolve())
                .on("error", (err) => reject(err))
                .run();
        });
    }

    /** Generate an SRT-style subtitle script from episode dialogue */
    private buildSubtitleScript(episode: Episode, scenes: Scene[]): string {
        let srt = "";
        let index = 1;
        let startMs = 0;

        for (const scene of scenes) {
            const durMs = (scene.durationSeconds ?? 4) * 1000;
            const perLine = Math.floor(durMs / Math.max(scene.dialogue.length, 1));

            for (const line of scene.dialogue) {
                const start = this.msToSrt(startMs);
                const end   = this.msToSrt(startMs + perLine);
                srt += `${index}\n${start} --> ${end}\n[${line.character}] ${line.line}\n\n`;
                startMs += perLine;
                index++;
            }

            if (scene.dialogue.length === 0) startMs += durMs;
        }

        // Save SRT file alongside manifest
        const srtPath = path.join(OUTPUT_DIR, `ep_${episode.episodeNumber}.srt`);
        fs.writeFileSync(srtPath, srt, "utf-8");
        log(`[assembly] ðŸ“ Subtitles written: ${srtPath}`);
        return srt;
    }

    private msToSrt(ms: number): string {
        const h  = Math.floor(ms / 3600000).toString().padStart(2, "0");
        const m  = Math.floor((ms % 3600000) / 60000).toString().padStart(2, "0");
        const s  = Math.floor((ms % 60000) / 1000).toString().padStart(2, "0");
        const ms2 = (ms % 1000).toString().padStart(3, "0");
        return `${h}:${m}:${s},${ms2}`;
    }

    private ensureOutputDir(): void {
        if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }
}

