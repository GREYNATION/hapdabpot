import { uploadAudioAndGetUrl } from "./src/services/voiceService.js";

async function test() {
    try {
        console.log("Testing Upload & Play logic...");
        const text = "This is a test of the persistent Supabase voice cache.";
        const url = await uploadAudioAndGetUrl(text);
        console.log("✅ Success! Audio URL:", url);
    } catch (err: any) {
        console.error("❌ Failed:", err.message);
    }
}

test();
