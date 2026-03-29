import { getEmbedding } from '../src/memory/embeddingService.js';

async function testEmbedding() {
  console.log("Testing Embedding Service...\n");
  
  const testTexts = [
    "Hello world",
    "Forex market analysis",
    "Real estate property valuation"
  ];
  
  for (const text of testTexts) {
    console.log(`Text: "${text}"`);
    const embedding = await getEmbedding(text);
    console.log(`Embedding length: ${embedding.length}`);
    if (embedding.length > 0) {
      console.log(`First 5 values: [${embedding.slice(0, 5).join(", ")}...]`);
    }
    console.log("---\n");
  }
}

testEmbedding().catch(console.error);