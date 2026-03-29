import { processUserInput } from '../src/taskOrchestrator.js';

async function testCompleteFlow() {
  console.log("=== Testing Complete User Input → Response Flow ===\n");
  
  const testCases = [
    { input: "Analyze forex market trends", userId: "user-001" },
    { input: "What's the property value of 123 Main St?", userId: "user-002" },
    { input: "Create TikTok content strategy", userId: "user-003" }
  ];
  
  for (const { input, userId } of testCases) {
    console.log(`📝 Input: "${input}"`);
    console.log(`👤 User: ${userId}`);
    
    const result = await processUserInput(input, userId);
    
    console.log(`✅ Success: ${result.success}`);
    console.log(`🤖 Agent: ${result.agent || 'None'}`);
    console.log(`📤 Response: ${result.response.substring(0, 100)}...`);
    console.log("─".repeat(50));
  }
}

testCompleteFlow().catch(console.error);