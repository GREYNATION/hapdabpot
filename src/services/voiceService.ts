import { config, log } from "../core/config.js";
import fetch from "node-fetch";
import { getSupabase } from "../core/supabase.js";
import { openai } from "../core/ai.js";
import crypto from "crypto";

/**
 * Generates high-fidelity human voice audio buffer via ElevenLabs
 */
export async function generateVoice(text: string): Promise<Buffer> {
    log(`[voice] 🎙️ Generating realistic speech via OpenAI TTS: "${text.substring(0, 30)}..."`);

    try {
        const mp3 = await openai.audio.speech.create({
            model: "tts-1",
            voice: "onyx",
            input: text,
        });

        const buffer = Buffer.from(await mp3.arrayBuffer());
        return buffer;
    } catch (err: any) {
        log(`[voice] ❌ OpenAI TTS failed: ${err.message}`, "error");
        throw err;
    }
}

/**
 * Generates voice, uploads to Supabase, and returns a public URL.
 * Uses MD5 of text+voiceId for persistent caching.
 */
export async function uploadAudioAndGetUrl(text: string): Promise<string> {
    const hash = crypto.createHash("md5").update(text + "openai-onyx").digest("hex");
    const fileName = `${hash}.mp3`;
    const bucketName = "voice-cache";

    const supabaseInstance = getSupabase();
    if (!supabaseInstance) {
        log("[voice] ❌ Supabase not connected. Using fallback URL.", "warn");
        return `${process.env.BASE_URL}/api/voice/audio?text=${encodeURIComponent(text)}`;
    }

    try {
        // 1. Check if file already exists in Supabase
        const { data: existingFile } = await supabaseInstance.storage.from(bucketName).list("", {
            search: fileName
        });

        if (existingFile && existingFile.length > 0) {
            log(`[voice] 🚀 Cache hit! Found existing audio for hash ${hash}`);
            const { data } = supabaseInstance.storage.from(bucketName).getPublicUrl(fileName);
            return data.publicUrl;
        }

        // 2. Generate new voice audio
        const buffer = await generateVoice(text);

        // 3. Upload to Supabase Storage
        log(`[voice] 📤 Uploading new audio to Supabase: ${fileName}`);
        const { error: uploadError } = await supabaseInstance.storage
            .from(bucketName)
            .upload(fileName, buffer, {
                contentType: "audio/mpeg",
                cacheControl: "3600",
                upsert: false
            });

        if (uploadError) throw uploadError;

        // 4. Get and return Public URL
        const { data } = supabaseInstance.storage.from(bucketName).getPublicUrl(fileName);
        return data.publicUrl;
    } catch (err: any) {
        log(`[voice] ❌ Upload/GetUrl failed: ${err.message}`, "error");
        // Fallback to the old streaming URL route if upload fails
        return `/api/voice/audio?text=${encodeURIComponent(text)}`;
    }
}
