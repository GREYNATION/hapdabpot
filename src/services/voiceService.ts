import fs from 'fs';
import path from 'path';
import { log } from '../core/config.js';
import { openai } from '../core/ai.js';
import ffmpeg from 'fluent-ffmpeg';
import { promisify } from 'util';
import fetch from 'node-fetch';

/**
 * VoiceService — Handles STT (Whisper) and TTS (OpenAI)
 */
export class VoiceService {
    private static TEMP_DIR = path.resolve('./temp/voice');

    static init() {
        if (!fs.existsSync(this.TEMP_DIR)) {
            fs.mkdirSync(this.TEMP_DIR, { recursive: true });
        }
    }

    /**
     * STT: Transcribe Audio Buffer
     */
    static async transcribe(buffer: Buffer, originalExt: string = '.oga'): Promise<string> {
        this.init();
        const inputPath = path.join(this.TEMP_DIR, `input_${Date.now()}${originalExt}`);
        const outputPath = path.join(this.TEMP_DIR, `output_${Date.now()}.mp3`);

        fs.writeFileSync(inputPath, buffer);

        let attempt = 0;
        const maxRetries = 2;

        const attemptTranscription = async (): Promise<string> => {
            try {
                // Convert to MP3 if needed (OpenAI likes mp3/m4a/wav)
                await this.convertToMp3(inputPath, outputPath);

                const transcription = await openai.audio.transcriptions.create({
                    file: fs.createReadStream(outputPath),
                    model: "whisper-1",
                });

                return transcription.text;
            } catch (err: any) {
                if (attempt < maxRetries) {
                    attempt++;
                    const delay = attempt * 2000;
                    log(`[voice] Transcription failed: ${err.message}. Retrying in ${delay}ms...`, "warn");
                    await new Promise(r => setTimeout(r, delay));
                    return attemptTranscription();
                }
                throw err;
            }
        };

        try {
            return await attemptTranscription();
        } finally {
            // Cleanup
            if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
            if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        }
    }

    /**
     * TTS: Synthesize Speech
     */
    static async synthesize(text: string, voice: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer" = "onyx"): Promise<Buffer> {
        log(`[voice] Synthesizing speech with voice: ${voice} (Length: ${text.length})`);
        
        // Handle character limit (OpenAI TTS has a ~4096 character limit)
        if (text.length <= 4000) {
            const mp3 = await openai.audio.speech.create({
                model: "tts-1",
                voice: voice,
                input: text,
            });
            return Buffer.from(await mp3.arrayBuffer());
        }

        // Chunking strategy for long responses
        log(`[voice] Text exceeds 4000 chars. Chunking...`);
        const chunks = this.chunkText(text, 4000);
        const buffers: Buffer[] = [];

        for (const chunk of chunks) {
            log(`[voice] Synthesizing chunk (${chunk.length} chars)...`);
            const mp3 = await openai.audio.speech.create({
                model: "tts-1",
                voice: voice,
                input: chunk,
            });
            buffers.push(Buffer.from(await mp3.arrayBuffer()));
        }

        return Buffer.concat(buffers);
    }

    /**
     * Split text into chunks that don't break mid-sentence if possible.
     */
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

    /**
     * Helper: Convert audio to MP3 using fluent-ffmpeg
     */
    private static convertToMp3(input: string, output: string): Promise<void> {
        return new Promise((resolve, reject) => {
            ffmpeg(input)
                .toFormat('mp3')
                .on('end', () => resolve())
                .on('error', (err) => reject(err))
                .save(output);
        });
    }

    /**
     * Download file from Telegram URL
     */
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

/**
 * Global Export for compatibility 
 */
export const generateVoice = (text: string) => VoiceService.synthesize(text, "onyx");

export async function uploadAudioAndGetUrl(file: Buffer): Promise<string> {
  // TODO: implement upload (S3, Supabase, etc.)
  return "https://placeholder-url.com/audio.mp3";
}
