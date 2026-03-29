import { getRelevantMemory } from '../src/memory/memoryService.js';

async function testVectorSearch() {
  console.log("Testing Vector Search (getRelevantMemory)...\n");
  
  const userId = "test-user-123";
  const query = "forex trading strategies";
  
  console.log(`Searching for memories similar to: "${query}"`);
  const relevantMemories = await getRelevantMemory(userId, query);
  
  console.log(`Found ${relevantMemories.length} relevant memories:`);
  for (const memory of relevantMemories) {
    console.log(`- ${memory.agent || 'Unknown'}: ${memory.content?.substring(0, 50) || 'No content'}...`);
    if (memory.similarity) {
      console.log(`  Similarity: ${(memory.similarity * 100).toFixed(1)}%`);
    }
  }
}

testVectorSearch().catch(console.error);