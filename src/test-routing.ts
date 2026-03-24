// Test script for routing logic
import { routeTask, architectAgent } from "./agents/architect.js";

const testCases = [
  { input: "build a backend api", expected: "developer" },
  { input: "research nyc property market", expected: "researcher" },
  { input: "create a marketing strategy", expected: "marketer" },
  { input: "hello world", expected: "developer" } // fallback
];

async function runTests() {
  console.log("--- ROUTING LOGIC TEST ---");
  for (const tc of testCases) {
    const result = routeTask(tc.input);
    const passed = result === tc.expected;
    console.log(`Input: "${tc.input}" | Expected: ${tc.expected} | Got: ${result} | ${passed ? "✅ PASSED" : "❌ FAILED"}`);
  }
  
  console.log("\n--- ARCHITECT AGENT PLAN TEST ---");
  const testInput = "build a new feature";
  const planStr = await architectAgent(testInput);
  console.log("Plan Output:");
  console.log(planStr);
  
  try {
      const plan = JSON.parse(planStr);
      if (plan.tasks && plan.tasks[0].agent === "developer") {
          console.log("✅ Plan format and content verified.");
      } else {
          console.log("❌ Plan format or content mismatch.");
      }
  } catch (e) {
      console.log("❌ Plan is not valid JSON.");
  }
  
  console.log("--------------------------");
}

runTests().catch(console.error);
