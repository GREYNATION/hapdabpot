import 'dotenv/config';
import { saveMemory, getMemory, getRelevantMemory } from '../src/memory/memoryService.js';

async function testMemoryWithSupabase() {
  console.log("Testing Memory Service with Supabase...\n");
  
  const userId = "test-user-123";
  const agent = "TestAgent";
  const content = "This is a test memory about forex trading strategies.";
  
  console.log("1. Saving memory with embedding...");
  await saveMemory(userId, agent, content, { type: "test" });
  
  console.log("2. Getting recent memories...");
  const recentMemories = await getMemory(userId, 5);
  console.log(`Found ${recentMemories.length} recent memories`);
  
  console.log("3. Getting relevant memories (vector search)...");
  const query = "forex trading";
  const relevantMemories = await getRelevantMemory(userId, query);
  console.log(`Found ${relevantMemories.length} relevant memories for query: "${query}"`);
  
  if (relevantMemories.length > 0) {
    for (const memory of relevantMemories) {
      console.log(`- ${memory.agent}: ${memory.content?.substring(0, 50)}...`);
      if (memory.similarity) {
        console.log(`  Similarity: ${(memory.similarity * 100).toFixed(1)}%`);
      }
    }
  }
}

testMemoryWithSupabase().catch(console.error);