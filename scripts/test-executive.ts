import 'dotenv/config';
import { log } from '../src/core/config.js';
import { ExecutiveManager } from '../src/core/executive/executiveManager.js';
import { startupSequence } from '../src/core/startup.js';

async function testExecutive() {
    log("🧪 --- TESTING EXECUTIVE WORKFLOWS ---");

    // 1. Init System
    await startupSequence();

    // 2. Test Morning Briefing
    log("\n1. Testing Morning Briefing...");
    try {
        const briefing = await ExecutiveManager.generateMorningBriefing();
        log("✅ Briefing generated successfully.");
        console.log("--- BRIEFING PREVIEW ---");
        console.log(briefing.substring(0, 500) + "...");
        console.log("------------------------");
    } catch (e: any) {
        log(`❌ Briefing failed: ${e.message}`, "error");
    }

    // 3. Test Decision Logging
    log("\n2. Testing Decision Logging...");
    try {
        const title = "Switch to Strong Architecture";
        const logic = "The legacy Claw engine has too much coupling between tool execution and reasoning, leading to 400 errors. Modular runtime ensures separation of concerns.";
        const outcome = "Successfully ported to src/hapda_bot.ts and src/core/runtime/*.";
        
        const result = ExecutiveManager.logDecision(title, logic, outcome);
        log(`✅ ${result}`);
    } catch (e: any) {
        log(`❌ Decision log failed: ${e.message}`, "error");
    }

    // 4. Test Heartbeat/Triage Pulse
    log("\n3. Testing Heartbeat Pulse...");
    try {
        const pulse = await ExecutiveManager.runTriagePulse();
        log(pulse ? `✅ Pulse detected: ${pulse}` : "✅ Pulse: No urgent items found.");
    } catch (e: any) {
        log(`❌ Heartbeat failed: ${e.message}`, "error");
    }

    log("\n🏁 --- EXECUTIVE TESTING COMPLETE ---");
}

testExecutive().catch(err => {
    console.error("FATAL TEST FAILURE:", err);
    process.exit(1);
});
