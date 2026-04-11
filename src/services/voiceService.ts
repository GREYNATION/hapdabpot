import { config, log } from "../core/config.js";
import fetch from "node-fetch";
import { getSupabase } from "../core/supabaseMemory.js";
import crypto from "crypto";

/**
 * Generates high-fidelity human voice audio buffer via ElevenLabs
 */
export async function generateVoice(text: string): Promise<Buffer> {
    const voiceId = config.elevenVoiceId;
    const apiKey = config.elevenKey;

    if (!apiKey) {
        log("[voice] ❌ ElevenLabs API Key missing. Falling back to default.", "error");
        throw new Error("Missing ElevenLabs API Key");
    }

    log(`[voice] 🎙️ Generating realistic speech for: "${text.substring(0, 30)}..."`);

    try {
        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
            method: "POST",
            headers: {
                "xi-api-key": apiKey,
                "Content-Type": "application/json",
                "accept": "audio/mpeg"
            },
            body: JSON.stringify({
                text,
                model_id: "eleven_monolingual_v1",
                voice_settings: {
                    stability: 0.4,
                    similarity_boost: 0.8
                }
            })
        });

        if (!response.ok) {
            const errorMsg = await response.text();
            throw new Error(`ElevenLabs API Error: ${response.status} - ${errorMsg}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
    } catch (err: any) {
        log(`[voice] ❌ Failed to generate voice: ${err.message}`, "error");
        throw err;
    }
}

/**
 * Generates voice, uploads to Supabase, and returns a public URL.
 * Uses MD5 of text+voiceId for persistent caching.
 */
export async function uploadAudioAndGetUrl(text: string): Promise<string> {
    const voiceId = config.elevenVoiceId;
    const hash = crypto.createHash("md5").update(text + voiceId).digest("hex");
    const fileName = `${hash}.mp3`;
    const bucketName = "voice-cache";

    const supabase = getSupabase();

    try {
        // 1. Check if file already exists in Supabase
        const { data: existingFile } = await supabase.storage.from(bucketName).list("", {
            search: fileName
        });

        if (existingFile && existingFile.length > 0) {
            log(`[voice] 🚀 Cache hit! Found existing audio for hash ${hash}`);
            const { data } = supabase.storage.from(bucketName).getPublicUrl(fileName);
            return data.publicUrl;
        }

        // 2. Generate new voice audio
        const buffer = await generateVoice(text);

        // 3. Upload to Supabase Storage
        log(`[voice] 📤 Uploading new audio to Supabase: ${fileName}`);
        const { error: uploadError } = await supabase.storage
            .from(bucketName)
            .upload(fileName, buffer, {
                contentType: "audio/mpeg",
                cacheControl: "3600",
                upsert: false
            });

        if (uploadError) throw uploadError;

        // 4. Get and return Public URL
        const { data } = supabase.storage.from(bucketName).getPublicUrl(fileName);
        return data.publicUrl;
    } catch (err: any) {
        log(`[voice] ❌ Upload/GetUrl failed: ${err.message}`, "error");
        // Fallback to the old streaming URL route if upload fails
        return `${process.env.BASE_URL}/api/voice/audio?text=${encodeURIComponent(text)}`;
    }
}
