import { DeveloperAgent } from "../src/agents/developerAgent.js";
import { GitHubAgent } from "../src/agents/githubAgent.js";
import { log } from "../src/core/config.js";
import dotenv from "dotenv";

dotenv.config();

async function testAgents() {
    try {
        console.log("=== Testing DeveloperAgent (Base Tools) ===");
        const dev = new DeveloperAgent();
        const devResponse = await dev.ask("Perform a web search for 'current date in NYC' and summarize it.");
        console.log("Developer Response Content: " + devResponse.content);
        if (devResponse.tool_calls) {
            console.log("Developer Tool Calls: " + JSON.stringify(devResponse.tool_calls));
        }

        console.log("\n=== Testing GitHubAgent (Specialized Tools) ===");
        const github = new GitHubAgent();
        const githubResponse = await github.ask("List my recent GitHub repositories.");
        console.log("GitHub Response Content: " + githubResponse.content);
        if (githubResponse.tool_calls) {
            console.log("GitHub Tool Calls: " + JSON.stringify(githubResponse.tool_calls));
        }

        console.log("\nTEST COMPLETE");
    } catch (error: any) {
        console.error("TEST FAILED: " + error.message);
        if (error.stack) console.error(error.stack);
    }
}

testAgents();
