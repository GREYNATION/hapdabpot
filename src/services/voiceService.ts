import fs from 'fs';
import path from 'path';
import { openai, config, log } from '../core/config.js';
import { openRouterClient } from '../core/ai.js';
import OpenAI from "openai";
import { getSupabase } from '../core/supabase.js';
import axios from 'axios';

// Lazy-initialized TTS client — must NOT be created at module load time
// because OPENAI_API_KEY arrives from Supabase after boot.
let _ttsClient: OpenAI | null = null;
function getTtsClient(): OpenAI {
    if (!_ttsClient || (_ttsClient as any)._lastKey !== config.openaiApiKey) {
        const key = config.openaiApiKey || process.env.OPENAI_API_KEY || "";
        log(`[voice] Creating TTS client (key present: ${!!key && key !== "placeholder"})`);
        _ttsClient = new OpenAI({ apiKey: key });
        (_ttsClient as any)._lastKey = config.openaiApiKey;
    }
    return _ttsClient;
}

// @ts-ignore
import ffmpeg from 'fluent-ffmpeg';
import fetch from 'node-fetch';

/**
 * VoiceService — Handles STT (Whisper) and TTS (OpenAI / ElevenLabs)
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
            if (!this.isFfmpegReady) {
                log(`[voice] WARNING: ffmpeg not found in common Windows paths. Fallback to system PATH.`, "warn");
            }
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
                        return `[SYSTEM NOTICE: Audio transcription failed. Error: ${err.message.substring(0, 50)}. DO NOT attempt to search for this error; instead, notify the user that the voice message could not be processed.]`;
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
     * TTS: Synthesize Speech with ElevenLabs -> OpenAI Fallback
     */
    static async synthesize(text: string, voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer' = 'alloy'): Promise<Buffer | null> {
        if (!text || text.trim() === "") return null;

        const chunks = this.chunkText(text, 4000);
        const buffers: Buffer[] = [];

        for (const chunk of chunks) {
            let chunkBuffer: Buffer | null = null;

            // 1. Try ElevenLabs First
            const elevenKey = config.elevenKey || process.env.ELEVEN_API_KEY || process.env.ELEVENLABS_API_KEY;
            const voiceId = config.elevenVoiceId || process.env.ELEVEN_VOICE_ID || "JBFqnCBsd6RMkjVDRZzb";

            if (elevenKey && elevenKey !== "placeholder") {
                try {
                    log(`[voice] Attempting ElevenLabs synthesis...`);
                    const response = await axios.post(
                        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
                        {
                            text: chunk,
                            model_id: "eleven_multilingual_v2",
                            voice_settings: { stability: 0.5, similarity_boost: 0.75 }
                        },
                        {
                            headers: { "xi-api-key": elevenKey, "Content-Type": "application/json" },
                            responseType: "arraybuffer"
                        }
                    );
                    chunkBuffer = Buffer.from(response.data);
                    log("[voice] ElevenLabs synthesis successful");
                } catch (err: any) {
                    const errorMsg = err.response?.data ? Buffer.from(err.response.data).toString() : err.message;
                    log(`[voice] ElevenLabs failed: ${errorMsg}. Falling back to OpenAI.`, "warn");
                }
            }

            // 2. Fallback to OpenAI if ElevenLabs failed or not configured
            if (!chunkBuffer) {
                try {
                    log(`[voice] Attempting OpenAI fallback...`);
                    const client = getTtsClient();
                    const mp3 = await client.audio.speech.create({
                        model: "tts-1-hd",
                        voice: voice === 'alloy' ? 'onyx' : voice, // Use onyx as default for drama
                        input: chunk,
                    });
                    chunkBuffer = Buffer.from(await mp3.arrayBuffer());
                    log("[voice] OpenAI fallback successful");
                } catch (oaErr: any) {
                    log(`[voice] OpenAI fallback failed: ${oaErr.message}`, "error");
                }
            }

            if (chunkBuffer) {
                buffers.push(chunkBuffer);
            }
        }

        return buffers.length > 0 ? Buffer.concat(buffers) : null;
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
    const supabase = getSupabase();
    if (!supabase) throw new Error("Supabase client not available for audio upload");

    const fileName = `voice_${Date.now()}_${Math.random().toString(36).substring(7)}.mp3`;
    const { data, error } = await supabase.storage
        .from('tracks')
        .upload(fileName, file, {
            contentType: 'audio/mpeg',
            cacheControl: '3600',
            upsert: false
        });

    if (error) {
        log(`[voice] Supabase upload failed: ${error.message}`, "error");
        throw error;
    }

    const { data: { publicUrl } } = supabase.storage
        .from('tracks')
        .getPublicUrl(fileName);

    log(`[voice] Audio uploaded: ${publicUrl}`);
    return publicUrl;
}
