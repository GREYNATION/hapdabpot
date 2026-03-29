import { routeTask } from '../src/agents/agentRouter.js';

async function testRouter() {
  console.log("Testing Agent Router...\n");
  
  const testTasks = [
    { task: "Analyze the forex market today", userId: "test123" },
    { task: "What's the property value of 123 Main St?", userId: "test123" },
    { task: "Create a TikTok content strategy", userId: "test123" },
    { task: "Something unrelated", userId: "test123" }
  ];
  
  for (const { task, userId } of testTasks) {
    console.log(`Task: "${task}"`);
    const result = await routeTask(task, userId);
    console.log(`Result: ${result}`);
    console.log("---\n");
  }
}

testRouter().catch(console.error);