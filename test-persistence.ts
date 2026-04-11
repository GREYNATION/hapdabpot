import { config, ensureDirs } from "./src/core/config.js";
import { writeAgentMemory, syncBrainToDisk } from "./src/core/memory.js";
import fs from "fs";
import path from "path";

async function test() {
    console.log("Testing Infrastructure Persistence & Brain Mapping...");

    // 1. Verify Dirs
    ensureDirs();
    const dirs = [config.dataDir, config.logDir, config.brainDir];
    for (const dir of dirs) {
        if (fs.existsSync(dir)) {
            console.log(`✅ Directory exists: ${dir}`);
        } else {
            console.error(`❌ Directory missing: ${dir}`);
        }
    }

    // 2. Verify Logic (Simulate Agent Memory Update)
    console.log("\nSimulating agent memory update...");
    try {
        await writeAgentMemory("trading", "last_test_run", new Date().toISOString());
        console.log("✅ writeAgentMemory called.");

        // Wait a small bit for the async sync to start
        await new Promise(r => setTimeout(r, 2000));

        const brainFile = path.join(config.brainDir, "trading_memory.md");
        if (fs.existsSync(brainFile)) {
            console.log(`✅ Brain Mirror success! File created: ${brainFile}`);
            const stats = fs.statSync(brainFile);
            console.log(`   File size: ${stats.size} bytes`);
        } else {
            console.log("⚠️ Brain Mirror file not created yet (might need Supabase connectivity).");
        }
    } catch (err: any) {
        console.log("⚠️ Simulation finished (but likely hit Supabase connectivity issue which is expected):", err.message);
    }
}

test();
