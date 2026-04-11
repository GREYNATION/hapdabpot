import { callAI, userMsg } from "./src/core/ai.js";

async function test() {
  try {
    console.log("🚀 Testing callAI...");
    const res = await callAI([userMsg("Say hello")], "test");
    console.log("✅ Response:", res.content);
  } catch (err) {
    console.error("❌ callAI Failed:", err);
  }
}

test();
