import 'dotenv/config';
import { log, initializeConfig } from '../src/core/config.js';
import { VoiceService } from '../src/services/voiceService.js';
import { initializeClients } from '../src/core/ai.js';
import fs from 'fs';
import path from 'path';

async function testVoice() {
    process.env.SKIP_DB_CONFIG = 'true';
    log("🧪 --- TESTING VOICE INTEGRATION ---");
    
    // Initialize local config/clients
    await initializeConfig();
    initializeClients();

    // 1. Test Synthesis (TTS)
    log("\n1. Testing Text-to-Speech (Onyx)...");
    try {
        const text = "Hello, I am the Hapda Bot Executive Assistant. I am now speaking with the authoritative Onyx voice. How can I assist you today?";
        const buffer = await VoiceService.synthesize(text, "onyx");
        
        const testDir = path.resolve('./temp/test');
        if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });
        
        const voicePath = path.join(testDir, 'test_onyx.mp3');
        fs.writeFileSync(voicePath, buffer);
        log(`✅ Synthesis successful. Saved to: ${voicePath}`);
        
        // 2. Test Transcription (STT)
        log("\n2. Testing Speech-to-Text (Transcription)...");
        const transcription = await VoiceService.transcribe(buffer, '.mp3');
        log(`✅ Transcription result: "${transcription}"`);
        
        if (transcription.toLowerCase().includes("onyx")) {
            log("✨ Voice system is working perfectly!");
        } else {
            log("⚠️ Transcription mismatch, check OpenAI connection.", "warn");
        }
    } catch (e: any) {
        log(`❌ Voice test failed: ${e.message}`, "error");
    }

    log("\n🏁 --- VOICE TESTING COMPLETE ---");
}

testVoice().catch(err => {
    console.error("FATAL VOICE TEST FAILURE:", err);
    process.exit(1);
});
