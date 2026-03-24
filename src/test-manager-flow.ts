import { ai, manager } from "./core/manager.js";
import { executeTask } from "./core/executor.js";
import { initDb } from "./core/memory.js";

async function testManagerFlow() {
    console.log("--- MANAGER FLOW TEST (FUNCTIONAL) ---");
    try {
        initDb();
        const chatId = 12345;
        const userText = "Build a basic node express API with routes and package.json";

        console.log("Input:", userText);
        
        // STEP 0: AI
        console.log("[TEST] Calling ai()...");
        const instantReply = await ai(userText);
        console.log(`[INSTANT REPLY] ${instantReply}`);

        // STEP 1: PLAN
        console.log("[TEST] Calling manager()...");
        const plan = await manager(userText);
        console.log(`[PLAN] Tasks: ${plan.tasks.length}`);

        // STEP 2: EXECUTE
        for (const task of plan.tasks) {
            console.log(`[EXECUTING] ${task.agent}...`);
            const result = await executeTask(task);
            console.log(`[RESULT] ${result.substring(0, 100)}...`);
        }

        console.log("\n✅ SUCCESS: Functional flow completed.");
    } catch (e: any) {
        console.error("❌ TEST FAILED WITH ERROR:");
        console.error("Message:", e.message);
        if (e.code) console.error("Code:", e.code);
        if (e.stack) console.error(e.stack);
    }
    console.log("--------------------------");
}

testManagerFlow().catch(console.error);
