import { handleHapdaCommand } from "../src/hapda_bot.js";
import { initializeConfig } from "../src/core/config.js";

async function test() {
    console.log("🧪 Testing Hapda Bot Runtime...");
    await initializeConfig();

    const goal = "/auto Calculate the surplus for a property sold at $200,000 with a debt of $150,000.";
    console.log(`\nInput: ${goal}`);
    
    const result = await handleHapdaCommand(goal);
    console.log("\n--- Final Result ---");
    console.log(result);
    console.log("--------------------");

    if (result.includes("$50,000") || result.includes("50000")) {
        console.log("\n✅ Test Passed: Calculated surplus correctly.");
    } else {
        console.log("\n❌ Test Failed: Result doesn't contain expected surplus calculation.");
    }
}

test().catch(console.error);
