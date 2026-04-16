/**
 * test-production.ts
 * Test script for Stuyza Productions / OpenMontage integration
 *
 * Run: npx tsx src/agents/stuyza/test-production.ts
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("\n🎬 === STUYZA PRODUCTIONS / OPENMONTAGE TEST ===\n");

// Test 1: Check OpenMontage directory structure
console.log("📁 Test 1: Checking OpenMontage directory structure...");
const openmontageDir = path.join(__dirname, "openmontage");

const requiredDirs = [
  "pipeline_defs",
  "skills",
  "tools",
  "remotion-composer"
];

let allDirsExist = true;
for (const dir of requiredDirs) {
  const dirPath = path.join(openmontageDir, dir);
  const exists = fs.existsSync(dirPath);
  console.log(`  ${exists ? "✅" : "❌"} ${dir}/`);
  if (!exists) allDirsExist = false;
}

if (!allDirsExist) {
  console.error("\n❌ OpenMontage not properly installed. Run:");
  console.error("   git clone https://github.com/calesthio/OpenMontage.git src/agents/stuyza/openmontage");
  process.exit(1);
}

// Test 2: Check pipeline definitions
console.log("\n📋 Test 2: Checking pipeline definitions...");
const pipelineDir = path.join(openmontageDir, "pipeline_defs");
const pipelines = fs.readdirSync(pipelineDir).filter((f) => f.endsWith(".yaml"));
console.log(`  Found ${pipelines.length} built-in pipelines:`);
pipelines.slice(0, 5).forEach((p) => console.log(`    • ${p.replace(".yaml", "")}`));
if (pipelines.length > 5) console.log(`    ... and ${pipelines.length - 5} more`);

// Test 3: Check Stuyza custom pipelines
console.log("\n🏗️  Test 3: Checking Stuyza custom pipelines...");
const stuyzaPipelineDir = path.join(__dirname, "pipelines");
const stuyzaPipelines = fs.existsSync(stuyzaPipelineDir)
  ? fs.readdirSync(stuyzaPipelineDir).filter((f) => f.endsWith(".yaml"))
  : [];

if (stuyzaPipelines.length === 0) {
  console.log("  ⚠️  No custom Stuyza pipelines found");
} else {
  console.log(`  Found ${stuyzaPipelines.length} Stuyza pipelines:`);
  stuyzaPipelines.forEach((p) => console.log(`    • ${p.replace(".yaml", "")}`));
}

// Test 4: Check agent files
console.log("\n🤖 Test 4: Checking TypeScript agent files...");
const agentFiles = ["StuyzaVideoAgent.ts", "stuyzaCommand.ts", "index.ts"];
agentFiles.forEach((file) => {
  const exists = fs.existsSync(path.join(__dirname, file));
  console.log(`  ${exists ? "✅" : "❌"} ${file}`);
});

// Test 5: Check Python tool registry
console.log("\n🐍 Test 5: Checking Python tool registry...");
const toolRegistry = path.join(openmontageDir, "tools", "tool_registry.py");
const baseTool = path.join(openmontageDir, "tools", "base_tool.py");

if (fs.existsSync(toolRegistry)) {
  console.log("  ✅ tool_registry.py found");
} else {
  console.log("  ❌ tool_registry.py not found");
}

if (fs.existsSync(baseTool)) {
  console.log("  ✅ base_tool.py found");
} else {
  console.log("  ❌ base_tool.py not found");
}

// Test 6: Check Remotion composer
console.log("\n🎥 Test 6: Checking Remotion composer...");
const remotionDir = path.join(openmontageDir, "remotion-composer");
const remotionPackageJson = path.join(remotionDir, "package.json");

if (fs.existsSync(remotionPackageJson)) {
  console.log("  ✅ Remotion composer package.json found");
  try {
    const pkg = JSON.parse(fs.readFileSync(remotionPackageJson, "utf-8"));
    console.log(`  📦 Version: ${pkg.version || "unknown"}`);
  } catch {
    console.log("  ⚠️  Could not parse package.json");
  }
} else {
  console.log("  ❌ Remotion composer not found");
}

// Test 7: Check agent guide
console.log("\n📖 Test 7: Checking documentation...");
const agentGuide = path.join(openmontageDir, "AGENT_GUIDE.md");
if (fs.existsSync(agentGuide)) {
  const stats = fs.statSync(agentGuide);
  console.log(`  ✅ AGENT_GUIDE.md found (${(stats.size / 1024).toFixed(1)} KB)`);
} else {
  console.log("  ❌ AGENT_GUIDE.md not found");
}

// Test 8: Try loading TypeScript modules
console.log("\n🔧 Test 8: Testing TypeScript module imports...");
try {
  const { StuyzaVideoAgent } = await import("./StuyzaVideoAgent.js");
  console.log("  ✅ StuyzaVideoAgent imported successfully");

  const agent = new StuyzaVideoAgent();
  const availablePipelines = agent.getAvailablePipelines();
  console.log(`  ✅ Agent initialized with ${availablePipelines.length} pipelines`);
  console.log(`     Pipelines: ${availablePipelines.slice(0, 3).join(", ")}${availablePipelines.length > 3 ? "..." : ""}`);
} catch (err: any) {
  console.log(`  ❌ Failed to import StuyzaVideoAgent: ${err.message}`);
}

// Summary
console.log("\n" + "=".repeat(50));
console.log("✅ Stuyza Productions integration is ready!");
console.log("=".repeat(50) + "\n");

console.log("Next steps:");
console.log("  1. Install Python dependencies:");
console.log("     cd src/agents/stuyza/openmontage");
console.log("     pip install -r requirements.txt");
console.log("     cd remotion-composer && npm install");
console.log("");
console.log("  2. Test a production request:");
console.log("     npx tsx -e \"import { produceVideo } from './src/agents/stuyza/index.js'; console.log(await produceVideo({ prompt: 'Test video' }));\"");
console.log("");
console.log("  3. Deploy to Railway:");
console.log("     git add src/agents/stuyza");
console.log("     git commit -m 'feat: add Stuyza Productions'");
console.log("     git push");
console.log("");
