import { DeveloperAgent } from "../src/agents/developerAgent.js";

async function testWebSearchFallback() {
    const agent = new DeveloperAgent();
    const youtubeUrl = "https://www.youtube.com/shorts/JAnI5Y1H9Xw";
    
    console.log(`=== Testing web_search for YouTube: ${youtubeUrl} ===`);
    
    try {
        const result = await agent.executeTool("web_search", { query: youtubeUrl });
        console.log("Result content:");
        console.log(result);
        
        if (result.includes("shorts") || result.includes("YouTube")) {
            console.log("\nTEST PASSED: YouTube info found via web_search.");
        } else {
            console.log("\nTEST FAILED: No YouTube info found.");
            process.exit(1);
        }
    } catch (error: any) {
        console.error(`\nTEST FAILED: ${error.message}`);
        process.exit(1);
    }
}

testWebSearchFallback();
