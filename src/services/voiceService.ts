import fs from 'fs';
import path from 'path';
import { openai, config, log } from '../core/config.js';
import { openRouterClient } from '../core/ai.js';
// @ts-ignore
import ffmpeg from 'fluent-ffmpeg';
import fetch from 'node-fetch';

/**
 * VoiceService — Handles STT (Whisper) and TTS (OpenAI)
 * Optimized for Windows and Railway deployments.
 */
export class VoiceService {
    private static TEMP_DIR = path.resolve('./temp/voice');
    private static isFfmpegReady = false;

    static init() {
        if (!fs.existsSync(this.TEMP_DIR)) {
            fs.mkdirSync(this.TEMP_DIR, { recursive: true });
        }

        // Windows-specific ffmpeg path fallback (if installed via common paths)
        if (process.platform === 'win32') {
            const paths = [
                'ffmpeg', // Default in PATH (Linux/Railway)
                'C:\\ffmpeg\\bin\\ffmpeg.exe',
                'C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe',
                'C:\\ProgramData\\chocolatey\\bin\\ffmpeg.exe',
                'C:\\bin\\ffmpeg.exe',
                path.join(process.cwd(), 'bin', 'ffmpeg.exe')
            ];
            
            for (const p of paths) {
                if (p === 'ffmpeg' || fs.existsSync(p)) {
                    ffmpeg.setFfmpegPath(p);
                    log(`[voice] FFmpeg path set to: ${p}`);
                    this.isFfmpegReady = true;
                    break;
                }
            }
            log(`[voice] WARNING: ffmpeg not found in common Windows paths. Fallback to system PATH.`, "warn");
        }
    }

    /**
     * STT: Transcribe Audio Buffer
     */
    static async transcribe(buffer: Buffer, originalExt: string = '.oga'): Promise<string> {
        this.init();
        const timestamp = Date.now();
        const inputPath = path.join(this.TEMP_DIR, `input_${timestamp}${originalExt}`);
        const outputPath = path.join(this.TEMP_DIR, `output_${timestamp}.mp3`);

        fs.writeFileSync(inputPath, buffer);

        const attemptTranscription = async (): Promise<string> => {
            const maxRetries = 3;
            let attempt = 0;

            while (attempt < maxRetries) {
                try {
                    let fileToUpload = inputPath;

                    // Try converting to MP3 if ffmpeg is available
                    try {
                        await this.convertToMp3(inputPath, outputPath);
                        fileToUpload = outputPath;
                        log(`[voice] Conversion successful, using MP3 for Whisper.`);
                    } catch (convErr: any) {
                        log(`[voice] ffmpeg conversion failed or not found: ${convErr.message}. Trying raw upload...`, "warn");
                        const rawOggPath = path.join(this.TEMP_DIR, `raw_${timestamp}.ogg`);
                        fs.copyFileSync(inputPath, rawOggPath);
                        fileToUpload = rawOggPath;
                    }

                    try {
                        const transcription = await openai.audio.transcriptions.create({
                            file: fs.createReadStream(fileToUpload),
                            model: "whisper-1",
                        });
                        return transcription.text;
                    } catch (oe: any) {
                        log(`[voice] OpenAI Whisper failed, trying OpenRouter fallback...`, "warn");
                        const transcription = await openRouterClient.audio.transcriptions.create({
                            file: fs.createReadStream(fileToUpload),
                            model: "openai/whisper-large-v3",
                        });
                        return transcription.text;
                    }
                } catch (err: any) {
                    const isRetryable = err.message?.includes('Connection') || 
                                       err.status >= 500 || 
                                       err.message?.includes('rate limit');

                    if (!isRetryable || attempt >= maxRetries - 1) {
                        log(`[voice] Transcription FAILED permanently: ${err.message}`, "error");
                        return `[Audio Transcription Unavailable — Error: ${err.message.substring(0, 50)}]`;
                    }

                    attempt++;
                    const baseDelay = Math.pow(2, attempt) * 1000;
                    const jitter = Math.random() * 500;
                    const waitDelay = baseDelay + jitter;

                    log(`[voice] Transcription transient error: ${err.message}. Retrying (${attempt}/${maxRetries}) in ${Math.round(waitDelay)}ms...`, "warn");
                    await new Promise(r => setTimeout(r, waitDelay));
                }
            }
            return "[Audio Transcription Unavailable — Retries exhausted]";
        };

        try {
            return await attemptTranscription();
        } finally {
            // Cleanup all temp files
            const files = fs.readdirSync(this.TEMP_DIR);
            for (const f of files) {
                if (f.includes(String(timestamp))) {
                    try { fs.unlinkSync(path.join(this.TEMP_DIR, f)); } catch { }
                }
            }
        }
    }

    /**
     * TTS: Synthesize Speech
     */
    static async synthesize(text: string, voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer' = 'alloy'): Promise<Buffer | null> {
        if (!text || text.trim() === "") return null;

        try {
            const chunks = this.chunkText(text, 4000); // Split to stay under API limits
            const buffers: Buffer[] = [];

            for (const chunk of chunks) {
                let chunkBuffer: Buffer | null = null;

                // 1. Try ElevenLabs First (Premium)
                if (config.elevenKey) {
                    try {
                        log(`[voice] Generating premium chunk (${chunk.length} chars) via ElevenLabs...`);
                        const voiceId = config.elevenVoiceId || "pNInz6obpgmqnzPCWZZf";
                        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'xi-api-key': config.elevenKey
                            },
                            body: JSON.stringify({
                                text: chunk,
                                model_id: "eleven_monolingual_v1",
                                voice_settings: { stability: 0.5, similarity_boost: 0.5 }
                            })
                        });

                        if (response.ok) {
                            chunkBuffer = Buffer.from(await response.arrayBuffer());
                        } else {
                            const errText = await response.text();
                            log(`[voice] ElevenLabs chunk failed: ${errText}`, "warn");
                        }
                    } catch (e: any) {
                        log(`[voice] ElevenLabs error: ${e.message}`, "warn");
                    }
                }

                // 2. Fallback to OpenAI TTS
                if (!chunkBuffer) {
                    log(`[voice] Falling back to OpenAI TTS for chunk...`);
                    try {
                        const mp3 = await openai.audio.speech.create({
                            model: "tts-1",
                            voice: voice,
                            input: chunk,
                        });
                        chunkBuffer = Buffer.from(await mp3.arrayBuffer());
                    } catch (oaErr: any) {
                        log(`[voice] OpenAI fallback failed: ${oaErr.message}`, "error");
                    }
                }

                if (chunkBuffer) {
                    buffers.push(chunkBuffer);
                }
            }

            if (buffers.length === 0) return null;
            return Buffer.concat(buffers);
        } catch (err: any) {
            log(`[voice] TTS Failed permanently: ${err.message}.`, "error");
            return null;
        }
    }

    private static chunkText(text: string, limit: number): string[] {
        const chunks: string[] = [];
        let remaining = text;

        while (remaining.length > 0) {
            if (remaining.length <= limit) {
                chunks.push(remaining);
                break;
            }

            let splitAt = remaining.lastIndexOf('.', limit);
            if (splitAt === -1) splitAt = remaining.lastIndexOf('\n', limit);
            if (splitAt === -1) splitAt = limit;

            chunks.push(remaining.substring(0, splitAt + 1).trim());
            remaining = remaining.substring(splitAt + 1).trim();
        }

        return chunks;
    }

    private static convertToMp3(input: string, output: string): Promise<void> {
        return new Promise((resolve, reject) => {
            ffmpeg(input)
                .toFormat('mp3')
                .on('end', () => resolve())
                .on('error', (err) => reject(err))
                .save(output);
        });
    }

    static async downloadTelegramFile(url: string): Promise<Buffer> {
        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts) {
            try {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 15000);
                const res = await fetch(url, { signal: controller.signal as any });
                clearTimeout(timeout);

                if (!res.ok) throw new Error(`Failed to download file from ${url}`);
                const arrayBuffer = await res.arrayBuffer();
                return Buffer.from(arrayBuffer);
            } catch (err: any) {
                attempts++;
                if (attempts >= maxAttempts) throw err;
                const delay = attempts * 3000;
                log(`[voice] Telegram download failed: ${err.message}. Retrying in ${delay}ms...`, "warn");
                await new Promise(r => setTimeout(r, delay));
            }
        }
        throw new Error("Download failed after all retries.");
    }
}

export const generateVoice = (text: string) => VoiceService.synthesize(text, "onyx");

export async function uploadAudioAndGetUrl(file: Buffer): Promise<string> {
    return "https://placeholder-url.com/audio.mp3";
}
