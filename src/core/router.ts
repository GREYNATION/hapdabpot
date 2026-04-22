import { findSkillByIntent } from "./skills.js";
import { HiveMind } from "./hiveMind.js";
import { log, config } from "./config.js";
import { askAI } from "./ai.js";

export type AgentType = "architect" | "developer" | "researcher" | "marketer" | "github" | "general" | "media" | "api" | "council" | "finance";

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
        const lower = message.toLowerCase();
        const hive = HiveMind.getInstance();
        const state = hive.getState();

        // AUDIT LOG: Persist the raw command as a 'request' event
        this.auditLog(message).catch(e => log(`[audit] Failed: ${e.message}`, "warn"));

        // 1. BROADCAST: "everyone", "team", "all", "council"
        if (lower.startsWith("everyone") || lower.startsWith("team,") || lower.startsWith("all agents,") || lower.startsWith("council,")) {
            log(`[router] Tier 1: Broadcast detected.`);
            return {
                goal: "Council Huddle",
                tasks: [
                    { agent: "architect", task: `[Council Context] ${message}` },
                    { agent: "researcher", task: `[Council Context] ${message}` },
                    { agent: "marketer", task: `[Council Context] ${message}` },
                    { agent: "finance", task: `[Council Context] ${message}` },
                    { agent: "developer", task: `[Council Context] ${message}` },
                    { agent: "github", task: `[Council Context] ${message}` },
                    { agent: "media", task: `[Council Context] ${message}` }
                ]
            };
        }

        // 2. PREFIX: "Ops,", "Comms,", "Finance,", "Research,", "Dev,"
        const prefixes = ["ops,", "comms,", "finance,", "research,", "dev,"];
        const foundPrefix = prefixes.find(p => lower.startsWith(p));
        if (foundPrefix) {
            log(`[router] Tier 2: Prefix detected: ${foundPrefix}`);
            const cleanMsg = message.substring(foundPrefix.length).trim();
            const targetMap: Record<string, AgentType> = {
                "ops,": "researcher",
                "comms,": "marketer",
                "finance,": "finance",
                "research,": "researcher",
                "dev,": "developer"
            };
            return {
                goal: `Direct command to ${foundPrefix.slice(0, -1)}`,
                tasks: [{ agent: targetMap[foundPrefix], task: cleanMsg }]
            };
        }

        // 3. PINNED: Check if a specific agent is pinned for this session
        if (state.pinned_agent_id) {
            log(`[router] Tier 3: Pinned session detected (${state.pinned_agent_id})`);
            return {
                goal: "Continue pinned session",
                tasks: [{ agent: state.pinned_agent_id as any, task: message }]
            };
        }

        // 4. TRIAGE: AI-driven delegation (Fallback with Skill Discovery)
        log(`[router] Tier 4: Falling back to AI Triage.`);
        const matchedSkill = findSkillByIntent(message);
        
        // Dynamic Skill Catalog for the AI Router
        const { SKILLS } = await import("./skills.js");
        const skillList = SKILLS.map(s => `- ${s.id}: ${s.name} (${s.description})`).join("\n");

        const systemPrompt = `You are the Hive Mind of the Council of Spirits — the elite Command Center for HapdaBot. 
Analyze the user's message and delegate to the appropriate Council specialist.

Council Personas (use these for delegation):
- researcher: Ops Intelligence (The Architect). High-scale research, infrastructure, or complex data.
- marketer: Communications Lead (Global Outreach). Branding, copy, and human engagement.
- developer: Technical Soul. Code, systems, and automation.
- finance: Strategic Finance. Markets, ROI, and capital.

Available Specialized Skills (select the most relevant ID if any, or leave skillId null):
${skillList}

Respond with ONLY a JSON object:
{
  "goal": "Coordinated objective description",
  "skillId": "The ID of the specialized skill to use (optional)",
  "tasks": [
    { "agent": "researcher", "task": "Task formatted for the specialist" }
  ]
}

Message: "${message}"`;

        try {
            const aiResponse = await askAI(
                message, 
                systemPrompt, 
                { jsonMode: true, model: config.openaiModel }
            );

            const plan = JSON.parse(aiResponse.content);
            
            // If AI suggested a skill, ensure we use its primary agent
            if (plan.skillId) {
                const skill = SKILLS.find(s => s.id === plan.skillId);
                if (skill && plan.tasks?.[0]) {
                    plan.tasks[0].agent = plan.tasks[0].agent || skill.primaryAgent;
                }
            }

            return {
                goal: plan.goal || "Process request",
                tasks: plan.tasks || [{ agent: "researcher", task: message }],
                skillId: plan.skillId
            };
        } catch (err: any) {
            log(`[error] Router failed: ${err.message}`, "error");
            return {
                goal: "Error recovery",
                tasks: [{ agent: matchedSkill?.primaryAgent || "researcher", task: message }],
                skillId: matchedSkill?.id
            };
        }
    }

    private async auditLog(message: string) {
        try {
            const { getSupabase } = await import("./supabase.js");
            const supabase = getSupabase();
            if (supabase) {
                await supabase.from("ops_logs").insert([{
                    agent: "GATEKEEPER",
                    message: `AUDIT: ${message}`,
                    type: "status",
                    timestamp: new Date().toISOString()
                }]);
            }
        } catch (e: any) {
            log(`[audit] Non-fatal logging failure: ${e.message}`, "warn");
        }
    }
}

