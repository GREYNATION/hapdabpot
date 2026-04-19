import "dotenv/config";

import { handle } from "./src/agents/drama/DramaAgent.js";
import { initDb } from "./src/core/memory.js";

async function test() {
  console.log("🚀 Starting DramaAgent Integration Test...");
  console.log("Env GROQ_API_KEY present:", !!process.env.GROQ_API_KEY);
  
  initDb();
  console.log("✅ DB Init.");

  const prompt = "Write a 30s TikTok opening script about gravity claw AI.";
  
  try {
    console.log("💬 Calling Agent...");
    const res = await handle(prompt, "test-user");
    console.log("\n🤖 RESULT:\n");
    console.log(res);
    console.log("\n✅ PASS");
  } catch (err: any) {
    console.error("❌ FAIL:", err.message);
    if (err.stack) console.error(err.stack);
    process.exit(1);
  }
}

test();
