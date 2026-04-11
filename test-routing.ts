import { orchestrator } from "./src/agents/orchestratorAgent.js";
import * as DramaAgent from "./src/agents/drama/DramaAgent.js";

async function testRouting() {
    console.log("Testing Orchestrator Routing (Phase 2)...");

    // 1. Mock Drama Agent Registration
    orchestrator.registerDramaAgent(DramaAgent);
    console.log("✅ DramaAgent registered.");

    // 2. Test Drama Intent Detection
    const dramaMessage = "Write a TikTok hook for my new series about a 3D robot.";
    console.log(`\nTesting message: "${dramaMessage}"`);
    
    // Using private detectIntent for verification (need to cast or just check route result)
    const result = await orchestrator.route(dramaMessage);
    
    console.log("Resulting Intent:", result.intent);
    console.log("Response Preview:", result.response.slice(0, 100) + "...");

    if (result.intent === "drama") {
        console.log("✅ SUCCESS: Correctly routed to DramaAgent.");
    } else {
        console.error("❌ FAILURE: routing incorrect.");
    }
}

testRouting();
