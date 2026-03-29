import { saveMemory, getMemory } from '../src/memory/memoryService.js';

async function testMemoryWithEmbedding() {
  console.log("Testing Memory Service with Embedding...\n");
  
  const userId = "test-user-123";
  const agent = "TestAgent";
  const content = "This is a test memory about forex trading strategies.";
  
  console.log("Saving memory...");
  await saveMemory(userId, agent, content, { type: "test" });
  
  console.log("Retrieving memory...");
  const memories = await getMemory(userId, 5);
  
  console.log(`Found ${memories.length} memories:`);
  for (const memory of memories) {
    console.log(`- ${memory.agent}: ${memory.content.substring(0, 50)}...`);
  }
}

testMemoryWithEmbedding().catch(console.error);