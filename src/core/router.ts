import { openai, config, log } from "./config.js";
import { askAI } from "./ai.js";
import { findSkillByIntent } from "./skills.js";

export type AgentType = "architect" | "developer" | "researcher" | "marketer" | "github" | "general" | "media" | "api";

export interface TaskAction {
    agent: AgentType;
    task: string;
}

export interface RoutingResult {
    goal: string;
    tasks: TaskAction[];
    skillId?: string;
}

export class CommandRouter {
    async route(message: string): Promise<RoutingResult> {
        log(`[router] Routing message: ${message.substring(0, 50)}...`);
        
        // 0. Hard Keyword Routing (Override for reliability)
        const lower = message.toLowerCase();
        if (lower.includes("email") || lower.includes("update") || lower.includes("agentmail")) {
            log(`[router] Hard-routed to developer (Keyword match)`);
            return {
                goal: "Handle email/update request",
                tasks: [{ agent: "developer", task: message }]
            };
        }

        // 1. Check for explicit skill intent first
        const matchedSkill = findSkillByIntent(message);
        if (matchedSkill) {
            log(`[router] Detected skill: ${matchedSkill.id}`);
            return {
                goal: `Execute skill: ${matchedSkill.name}`,
                tasks: [{ agent: matchedSkill.primaryAgent.toLowerCase() as any, task: message }],
                skillId: matchedSkill.id
            };
        }

        const systemPrompt = `You are a Command Router & Planner. Analyze the user's message and create a structured plan to fulfill it.
Respond with ONLY a JSON object in this format:
{
  "goal": "Brief description of the overall objective",
  "tasks": [
    { "agent": "architect", "task": "Design task description" },
    { "agent": "developer", "task": "Implementation task description" }
  ]
}

Available Agents (use exact lowercase names):
- architect: For system design, architecture, infrastructure, or high-level planning.
- developer: For coding, debugging, implementation, email management, checking updates, or technical logic.
- researcher: For fact-finding, documentation, web search, or general info.
- marketer: For branding, communication strategy, copywriting, or messaging.
- github: For GitHub issues, PRs, or repository actions.
- general: If it's a general greeting or doesn't fit the above.
- media: For generating images or visual content (local ComfyUI).
- api: For fetching external data via URL.

Message: "${message}"`;

        try {
            const response = await askAI(
                message, 
                systemPrompt, 
                { jsonMode: true, model: config.openaiModel }
            );

            const plan = JSON.parse(response.content);
            
            return {
                goal: plan.goal || "Process request",
                tasks: plan.tasks || [{ agent: "general", task: message }],
                skillId: undefined
            };
        } catch (err: any) {
            log(`[error] Router failed: ${err.message}`, "error");
            return {
                goal: "Error recovery",
                tasks: [{ agent: "general", task: message }]
            };
        }
    }
}

