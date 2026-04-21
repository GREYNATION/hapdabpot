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

        try {
            // Convert to MP3 if needed (OpenAI likes mp3/m4a/wav)
            await this.convertToMp3(inputPath, outputPath);

            const transcription = await openai.audio.transcriptions.create({
                file: fs.createReadStream(outputPath),
                model: "whisper-1",
            });

            return transcription.text;
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
        log(`[voice] Synthesizing speech with voice: ${voice}`);
        const mp3 = await openai.audio.speech.create({
            model: "tts-1",
            voice: voice,
            input: text,
        });

        const buffer = Buffer.from(await mp3.arrayBuffer());
        return buffer;
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
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Failed to download file from ${url}`);
        return Buffer.from(await res.arrayBuffer());
    }
}

/**
 * Global Export for compatibility 
 */
export const generateVoice = (text: string) => VoiceService.synthesize(text, "onyx");
