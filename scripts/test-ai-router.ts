import { aiRoute } from '../src/agents/aiRouter.js';

async function testAiRouter() {
  console.log("Testing AI Router...\n");
  
  const testTasks = [
    "Analyze the forex market today",
    "What's the property value of 123 Main St?",
    "Create a TikTok content strategy",
    "How do I buy Bitcoin?",
    "Find houses for sale in Brooklyn"
  ];
  
  for (const task of testTasks) {
    console.log(`Task: "${task}"`);
    try {
      const agent = await aiRoute(task);
      console.log(`→ ${agent || "No agent matched"}`);
    } catch (error) {
      console.log(`Error: ${error}`);
    }
    console.log("---\n");
  }
}

testAiRouter().catch(console.error);