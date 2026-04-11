import { generateVoice } from "./src/services/voiceService.js";
import fs from "fs";

async function test() {
    try {
        console.log("Testing ElevenLabs generation...");
        console.log(`Key preview: ${process.env.ELEVENLABS_API_KEY?.substring(0, 8)}...`);
        const buffer = await generateVoice("Hello, this is a test of the realistic voice system.");
        fs.writeFileSync("test_voice.mp3", buffer);
        console.log("✅ Success! Audio saved to test_voice.mp3");
    } catch (err: any) {
        console.error("❌ Failed:", err.message);
        if (err.stack) console.error(err.stack);
    }
}

test();
