import { handleTask } from '../src/services/openrouter.js';

async function testHaptaBap() {
    console.log("🚀 Testing HaptaBap AI Integration...");
    try {
        const response = await handleTask("What is your name and what do you do?");
        console.log("✅ HaptaBap Success!");
    } catch (e: any) {
        console.error("❌ HaptaBap Test Failed:", e.message);
    }
}

testHaptaBap();
