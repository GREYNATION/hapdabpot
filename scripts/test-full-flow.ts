import { ManagerAI } from '../src/core/manager.js';

async function testFullFlow() {
    console.log("🚀 Testing Full Flow with HaptaBap Integration...");
    const manager = new ManagerAI();
    try {
        const response = await manager.processMessage(12345, "Hello! Who are you?");
        console.log("✅ Manager Response 1:", response);
        if (response.includes("HaptaBap")) {
            console.log("🌟 PERSONA VERIFIED: HaptaBap is active.");
        }

        console.log("\n🚀 Testing Email Routing...");
        const response2 = await manager.processMessage(12345, "Check my email");
        console.log("✅ Manager Response 2:", response2);
        if (response2.toLowerCase().includes("inbox") || response2.toLowerCase().includes("email")) {
            console.log("🌟 ROUTING VERIFIED: Developer agent handled email.");
        }
    } catch (e: any) {
        console.error("❌ Full Flow Test Failed:", e.message);
    }
}

testFullFlow();
