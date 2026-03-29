import { DeveloperAgent } from "../src/agents/developerAgent.js";
import { log } from "../src/core/config.js";

async function testYouTubeRead() {
    const agent = new DeveloperAgent();
    const youtubeUrl = "https://www.youtube.com/shorts/JAnI5Y1H9Xw";
    
    console.log(`=== Testing read_url for YouTube: ${youtubeUrl} ===`);
    
    try {
        const result = await agent.executeTool("read_url", { url: youtubeUrl });
        console.log("Result content:");
        console.log(result);
        
        if ((result.includes("YouTube Video Information") && result.includes("Title:")) || 
            (result.includes("couldn't fetch direct metadata") && result.includes("online"))) {
            console.log("\nTEST PASSED: YouTube info found (either direct or fallback).");
        } else {
            console.log("\nTEST FAILED: No YouTube info found in response.");
            process.exit(1);
        }
    } catch (error: any) {
        console.error(`\nTEST FAILED: ${error.message}`);
        process.exit(1);
    }
}

testYouTubeRead();
