import { developerAgent } from "./src/agents/developer.js";
import "dotenv/config";

async function test() {
  console.log("🧪 Testing Developer Agent...");
  const project = await developerAgent("Build a basic express API with a hello endpoint");
  console.log("📂 Files generated:", project.files.map(f => f.path));
  
  const indexFile = project.files.find(f => f.path === "src/index.js");
  if (indexFile) {
    console.log("📄 src/index.js exists.");
    const content = indexFile.content;
    const fs = await import("fs");
    fs.writeFileSync("generated-index.js", content);
    
    const hasRoot = content.includes('app.get("/")') || content.includes("app.get('/')");
    const hasRunningText = content.toLowerCase().includes("api is running");
    
    console.log("✅ Has root route:", hasRoot);
    console.log("✅ Has 'API is running' text:", hasRunningText);
    
    if (hasRoot && hasRunningText) {
      console.log("🎊 SUCCESS: Developer agent is standardized!");
    } else {
      console.log("❌ FAILURE: Standard boilerplate missing.");
    }
  } else {
    console.log("❌ FAILURE: src/index.js missing.");
  }
}

test().catch(console.error);
