import { GeminiProvider } from '../src/core/gemini-provider.js';
import { log } from '../src/core/config.js';

async function testGemini() {
    console.log("🚀 Testing Gemini Provider Fix...");
    const provider = new GeminiProvider();
    try {
        const response = await provider.chat([
            { role: 'system', content: 'You are a helpful assistant.' },
            { role: 'user', content: 'Say hello and confirm you are working correctly.' }
        ]);
        console.log("✅ Gemini Response:", response);
    } catch (e: any) {
        console.error("❌ Gemini Test Failed:", e.message);
    }
}

testGemini();
