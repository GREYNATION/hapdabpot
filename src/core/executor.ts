import { developerAgent } from "../agents/developer.js";
import { emailAgent } from "../agents/emailAgent.js";
import { visionAgent } from "../agents/visionAgent.js";
import { ResearcherAgent } from "../agents/researcherAgent.js";
import { marketerAgent } from "../agents/marketer.js";
import { architectAgent } from "../agents/architect.js";
import { updateTaskInDB } from "./taskMemory.js";
import { writeFile, writeProject } from "../tools/fileTool.js";
import { fetchJSON } from "../tools/apiTool.js";
import { generateImage } from "../tools/comfyTool.js";
import { runCommand } from "../tools/commandTool.js";
import { startServer, testEndpoint } from "../tools/runtimeTool.js";
import { startApp } from "./processManager.js";

/**
 * Orchestrates task execution by calling specialized agents.
 */
export async function executeTask(task: any) {
  const { agent, task: taskDesc } = task;

  console.log(`[executor] Running ${agent} agent...`);

  switch (agent) {
    case "developer": {
      console.log("🚀 DEVELOPER AGENT TRIGGERED:", taskDesc);

      const project = await developerAgent(taskDesc);
      console.log("📦 RAW AI OUTPUT:", project);

      if (!project.files) {
        return "❌ JSON FAILED — AI did not return files";
      }

      const files = writeProject(project.files);
      const projectPath = "workspace/output";

      // INSTALL
      console.log("📦 Installing dependencies...");
      await runCommand("npm install", projectPath);

      // START WITH APP MANAGER
      const appId = `app-${Date.now()}`;
      console.log(`🚀 Starting app with ID: ${appId}`);
      const { message: startResult, port } = startApp(appId, projectPath);

      // WAIT
      console.log("⏳ Waiting for server to stabilize...");
      await new Promise(r => setTimeout(r, 5000));

      // TEST
      console.log(`🧪 Testing endpoint on port ${port}...`);
      const testResult = await testEndpoint(`http://localhost:${port}/`);

      return `✅ Project created:
${files.join("\n")}

${startResult}

${testResult}`;
    }

    case "email":
      return await emailAgent(taskDesc);

    case "vision":
      return await visionAgent(taskDesc);

    case "researcher": {
      const researcher = new ResearcherAgent();
      const result = await researcher.ask(taskDesc);
      return result.content || "No analysis result.";
    }

    case "marketer": {
      const copy = await marketerAgent(taskDesc);
      return writeFile("workspace/output/marketing.txt", copy);
    }

    case "architect": {
      const plan = await architectAgent(taskDesc);
      return writeFile("workspace/output/architecture.txt", plan);
    }

    case "api": {
      return await fetchJSON(taskDesc);
    }

    case "media": {
      const filePath = await generateImage(taskDesc);
      return filePath;
    }

    case "command": {
      console.log("🐚 COMMAND AGENT TRIGGERED:", taskDesc);
      return await runCommand(taskDesc, "workspace/output");
    }

    case "start": {
      console.log("🚀 START AGENT TRIGGERED");
      return await startServer("workspace/output");
    }

    case "test": {
      console.log("🧪 TEST AGENT TRIGGERED:", taskDesc);
      return await testEndpoint(taskDesc);
    }

    default:
      return `❌ Unknown agent: ${agent}`;
  }
}

export async function runPlan(taskObjects: any[], onStatus?: (msg: string) => Promise<void>): Promise<string> {
    if (onStatus) await onStatus(`⚡ Running tasks...`);

    const taskPromises = taskObjects.map(async (task: any, i: number) => {
        const agentName = task.agent.charAt(0).toUpperCase() + task.agent.slice(1);
        if (onStatus) await onStatus(`💻 ${agentName} working...`);
        
        try {
            updateTaskInDB(task.id, "running");
            const result = await executeTask(task);
            const content = typeof result === 'string' ? result : (result?.content || "No output.");

            updateTaskInDB(task.id, "complete", content);
            
            // Format the success message
            let successMsg = `✅ ${agentName} finished.`;
            if (content.includes("saved to")) {
                const path = content.split("saved to ")[1];
                successMsg = `✅ File created: workspace/${path}`;
            }
            if (onStatus) await onStatus(successMsg);
            
            return { agent: task.agent, content };
        } catch (err: any) {
            console.error(`[executor] Task failed: ${err.message}`);
            updateTaskInDB(task.id, "failed", err.message);
            if (onStatus) await onStatus(`❌ ${task.agent} failed: ${err.message}`);
            return { agent: task.agent, content: `Error: ${err.message}` };
        }
    });

    const results = await Promise.all(taskPromises);
    return results.map((r: { agent: string, content: string }) => `\n\n--- ${r.agent} ---\n${r.content}`).join("");
}
