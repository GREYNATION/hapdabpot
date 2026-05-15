import { findSkillByIntent, findSkillBySemanticIntent } from "./skills.js";
import { HiveMind } from "./hiveMind.js";
import { log, config } from "./config.js";
import { askAI } from "./ai.js";

export type AgentType = "architect" | "developer" | "researcher" | "marketer" | "github" | "general" | "media" | "api" | "council" | "finance" | "hermes" | "athena" | "ares" | "atlas" | "hephaestus" | "frontend-engineer" | "branding-engine";

export interface TaskAction {
    agent: AgentType;
    task: string;
}

import { TaskPlan, TaskPlanner } from "./planner.js";

export interface RoutingResult {
    goal: string;
    tasks: TaskAction[];
    skillId?: string;
    plan?: TaskPlan;
}

export class CommandRouter {
    async route(message: string): Promise<RoutingResult> {
        log(`[router] Routing message: ${message.substring(0, 50)}...`);
        const lower = message.toLowerCase();
        const hive = HiveMind.getInstance();
        const state = hive.getState();

        // AUDIT LOG: Persist the raw command as a 'request' event
        const { logToOpsConsole } = await import("./config.js");
        logToOpsConsole("GATEKEEPER", `Command Input: "${message}"`, "status", "ROUTING", 10);
        this.auditLog(message).catch(e => log(`[audit] Failed: ${e.message}`, "warn"));

        // 1. BROADCAST: "everyone", "team", "all", "council"
        if (lower.startsWith("everyone") || lower.startsWith("team,") || lower.startsWith("all agents,") || lower.startsWith("council,")) {
            logToOpsConsole("GATEKEEPER", `Broadcast identified: Coordinated Council Huddle`, "status", "DISPATCH", 40);
            return {
                goal: "Council Huddle",
                tasks: [
                    { agent: "hermes", task: `[Council Context] ${message}` },
                    { agent: "athena", task: `[Council Context] ${message}` },
                    { agent: "ares", task: `[Council Context] ${message}` },
                    { agent: "atlas", task: `[Council Context] ${message}` },
                    { agent: "hephaestus", task: `[Council Context] ${message}` }
                ]
            };
        }

        // 2. PREFIX: "Hermes,", "Athena,", "Ares,", "Atlas,", "Hephaestus,"
        const prefixes = ["hermes,", "athena,", "ares,", "atlas,", "hephaestus,", "ops,", "comms,", "finance,", "research,", "dev,"];
        const foundPrefix = prefixes.find(p => lower.startsWith(p));
        if (foundPrefix) {
            const cleanMsg = message.substring(foundPrefix.length).trim();
            const targetMap: Record<string, AgentType> = {
                "hermes,": "hermes",
                "athena,": "athena",
                "ares,": "ares",
                "atlas,": "atlas",
                "hephaestus,": "hephaestus",
                "ops,": "hermes",
                "comms,": "ares",
                "finance,": "athena",
                "research,": "hermes",
                "dev,": "hephaestus"
            };
            const targetAgent = targetMap[foundPrefix];
            logToOpsConsole("GATEKEEPER", `Direct Triage: Routing to ${targetAgent.toUpperCase()}`, "status", "DISPATCH", 50);
            return {
                goal: `Direct command to ${foundPrefix.slice(0, -1)}`,
                tasks: [{ agent: targetAgent, task: cleanMsg }]
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

        // 3c. SKILLS: Check for direct skill trigger matches
        const matchedSkill = findSkillByIntent(message);
        if (matchedSkill && matchedSkill.triggers?.some(t => lower.includes(t.toLowerCase()))) {
            log(`[router] Tier 3c: Direct skill trigger match: ${matchedSkill.id}`);
            return this.buildRoutingResultForSkill(matchedSkill, message);
        }

        // 3d. SEMANTIC SKILLS: Use local embeddings for similarity search
        const { IntentEngine } = await import("./intent.js");
        const intentEngine = IntentEngine.getInstance();
        const bestMatch = await intentEngine.findBest(message);

        if (bestMatch && bestMatch.score > 0.4) {
            logToOpsConsole("GATEKEEPER", `Semantic Match: ${bestMatch.skill.name} (${(bestMatch.score * 100).toFixed(0)}%)`, "status", "ANALYSIS", 70);
            return this.buildRoutingResultForSkill(bestMatch.skill, message);
        }

        // 3b. REAL ESTATE: Route wholesale/property questions to hermes (Search & Scraping)
        const realEstateKeywords = ["mao", "arv", "wholesale", "lead", "seller", "deal", "repair", "offer", "motivated", "scrape"];
        if (realEstateKeywords.some(k => lower?.includes(k))) {
            log("[router] Real estate intent detected -> hermes");
            return {
                goal: "Real estate wholesale discovery",
                tasks: [{ agent: "hermes", task: message }]
            };
        }
        // 4. TRIAGE: AI-driven delegation (Fallback with Skill Discovery)
        const result = await (foundPrefix ? this.buildRoutingResultForPrefix(foundPrefix, lower) : (matchedSkill ? this.buildRoutingResultForSkill(matchedSkill, message) : null));
        if (result) {
            if (result.plan) {
                logToOpsConsole("SYSTEM", `PLAN_GENERATED: ${result.goal}`, "status", "PLANNER", 50, result.plan);
            }
            return result;
        }

        // Tier 4: AI Triage (The "Council" Logic)
        try {
            logToOpsConsole("ATHENA", `AI Triage Initiated: Analyzing complex request...`, "think", "ANALYSIS", 60);
            
            const { SKILLS } = await import("./skills.js");
            const skillList = SKILLS.map(s => {
                let info = `- ${s.id}: ${s.name} (${s.description})`;
                if (s.collaboration && s.collaboration.length > 0) {
                    info += ` [Collaborates with: ${s.collaboration.join(", ")}]`;
                }
                return info;
            }).join("\n");

            const systemPrompt = `You are Hapdabot — autonomous AI operator for Hap Hustlehard's wholesale real estate and content business. 
Analyze the user's message and delegate to the appropriate specialized Council agent.

Council Personas:
- hermes: Search & Scraping. High-fidelity data extraction, web search, finding leads.
- athena: Analysis & Scoring. Strategic insights, deal evaluation, profitability analysis.
- ares: Outreach Automation. Communication, marketing campaigns, execution of offers.
- atlas: Market Intelligence. Knowledge management, long-term trends, memory maintenance.
- hephaestus: Infrastructure. System health, mission orchestration, technical foundation.

${skillList}

${hive.getContextString()}

Respond with ONLY a JSON object:
{
  "goal": "Coordinated objective description",
  "skillId": "The ID of the specialized skill to use (optional)",
  "tasks": [
    { "agent": "hermes", "task": "Task formatted for the specialist" },
    { "agent": "athena", "task": "Analysis task based on data from hermes" }
  ]
}

If the request is complex, break it down into a multi-step plan involving collaboration between agents.
Message: "${message}"`;
            
            const response = await hive.generate(systemPrompt, { json: true });
            const planData = JSON.parse(response || "{}");
            
            // If AI suggested a skill, ensure we use its primary agent
            if (planData.skillId) {
                const skill = SKILLS.find(s => s.id === planData.skillId);
                if (skill && planData.tasks?.[0]) {
                    planData.tasks[0].agent = planData.tasks[0].agent || skill.primaryAgent;
                }
            }

            const plan = {
                id: `plan_${Date.now()}`,
                goal: planData.goal || "AI Orchestrated Task",
                nodes: (planData.tasks || []).map((t: any, i: number) => ({
                    id: `node_${i}`,
                    agent: t.agent,
                    task: t.task,
                    status: 'pending',
                    dependsOn: i > 0 ? [`node_${i-1}`] : []
                }))
            };

            logToOpsConsole("ATHENA", `AI Triage Complete: Goal identified as "${plan.goal}"`, "status", "DISPATCH", 100, plan);
            
            return {
                goal: plan.goal,
                tasks: planData.tasks || [{ agent: "hermes", task: message }],
                skillId: planData.skillId,
                plan: plan
            };
        } catch (err: any) {
            log(`[error] Router failed: ${err.message}`, "error");
            logToOpsConsole("GATEKEEPER", `AI Triage Failure: Falling back to Hermes`, "error", "FALLBACK", 100);
            return {
                goal: "Error recovery",
                tasks: [{ agent: "hermes", task: message }],
                skillId: matchedSkill?.id
            };
        }
    }

    private async buildRoutingResultForSkill(skill: any, message: string): Promise<RoutingResult> {
        const planner = TaskPlanner.getInstance();
        
        // If the skill has collaboration partners, automatically suggest a multi-agent plan
        if (skill.collaboration && skill.collaboration.length > 0) {
            log(`[router] Auto-planning for collaborating skill: ${skill.id}`);
            const plan = await planner.plan(`Coordinated ${skill.name}`, message, skill);
            
            return {
                goal: `Coordinated ${skill.name}`,
                skillId: skill.id,
                tasks: plan.nodes.map(n => ({ agent: n.agent, task: n.task })),
                plan: plan
            };
        }

        return {
            goal: skill.name,
            tasks: [{ agent: skill.primaryAgent, task: message }],
            skillId: skill.id,
            plan: {
                id: `plan_${Date.now()}`,
                goal: skill.name,
                nodes: [{ id: "root", agent: skill.primaryAgent, task: message, status: 'pending', dependsOn: [] }],
                createdAt: new Date().toISOString()
            }
        };
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
