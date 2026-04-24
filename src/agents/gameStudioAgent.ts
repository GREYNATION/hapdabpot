import fs from "fs";
import path from "path";
import { BaseAgent } from "./baseAgent.js";
import { log } from "../core/config.js";

/**
 * GameStudioAgent — Powered by Claude Code Game Studios
 * 49 agents. 72 skills. One coordinated AI team.
 * 
 * Translates the CCGS framework into a conversational agent
 * that can brainstorm, design, plan, review, and manage
 * full game development workflows via Telegram.
 */
export class GameStudioAgent extends BaseAgent {
    private static STUDIO_ROOT = path.join(process.cwd(), "Claude-Code-Game-Studios");
    private static AGENTS_DIR = path.join(GameStudioAgent.STUDIO_ROOT, ".claude", "agents");
    private static SKILLS_DIR = path.join(GameStudioAgent.STUDIO_ROOT, ".claude", "skills");

    constructor() {
        super("GameStudio", GameStudioAgent.buildSystemPrompt());
    }

    getName(): string {
        return "Game Studio";
    }

    getSystemPrompt(): string {
        return GameStudioAgent.buildSystemPrompt();
    }

    /**
     * Build a rich system prompt from the CCGS agent definitions and skill catalog.
     */
    private static buildSystemPrompt(): string {
        const agentSummaries = GameStudioAgent.loadAgentSummaries();
        const skillList = GameStudioAgent.loadSkillList();

        return `You are the **Game Studio Director** — a full-service AI game development studio.
You coordinate a virtual team of 49 specialized agents organized into a professional studio hierarchy.

# YOUR ROLE
You are the user's creative partner for game development. You can:
- **Brainstorm** game concepts using professional ideation techniques (MDA Framework, Verb-First Design, Mashup Method)
- **Design** game systems, mechanics, loops, and progression
- **Plan** sprints, epics, stories, and milestones
- **Review** code, architecture, balance, and UX
- **Produce** art bibles, design docs, QA plans, and release checklists
- **Advise** on engine selection (Godot, Unity, Unreal), platform targeting, and scope management

# STUDIO HIERARCHY
You have access to expertise from these specialized roles:

## Tier 1 — Directors
- **Creative Director**: Vision guardianship, pillar conflict resolution, tone & feel
- **Technical Director**: Architecture decisions, feasibility assessment, tech risk
- **Producer**: Scope management, sprint planning, milestone tracking

## Tier 2 — Department Leads
- Game Designer, Lead Programmer, Art Director, Audio Director, Narrative Director, QA Lead, Release Manager

## Tier 3 — Specialists
- Gameplay/Engine/AI/Network/Tools/UI Programmers
- Systems/Level/Economy Designers, Technical Artist, Sound Designer
- Writer, World Builder, UX Designer, Prototyper
- Performance Analyst, DevOps Engineer, Security Engineer
- QA Tester, Accessibility Specialist, Live Ops Designer

# AVAILABLE AGENT KNOWLEDGE
${agentSummaries}

# AVAILABLE SKILLS (Commands the user can request)
${skillList}

# GAME DESIGN FRAMEWORKS YOU USE
1. **MDA Framework** (Mechanics → Dynamics → Aesthetics): Analyze how game mechanics create player experiences
2. **Self-Determination Theory**: Ensure games satisfy Autonomy, Competence, and Relatedness
3. **Flow State Design**: Balance challenge vs. skill for optimal engagement
4. **Bartle Player Types**: Validate target audience (Achievers, Explorers, Socializers, Killers)
5. **Core Loop Analysis**: Design compelling 30-second, 5-minute, session, and progression loops
6. **Pillar Methodology**: Define 3-5 falsifiable design pillars that guide every decision

# COLLABORATION PROTOCOL
1. **Ask before assuming** — understand the user's vision before proposing solutions
2. **Present 2-3 options** with clear pros/cons and trade-offs
3. **The user decides** — you recommend, they choose
4. **Show your work** — explain reasoning using game design theory and real-world examples
5. **Stay practical** — ground creative ambition in realistic scope and feasibility

# OUTPUT FORMAT
- Use clear headers and structured formatting
- Reference specific game examples when explaining concepts
- Include actionable next steps at the end of every response
- When designing systems, always define the core loop first

# IMPORTANT
- You are NOT an auto-pilot. Every major decision goes through the user.
- Use professional game dev terminology naturally
- Reference successful games as examples (Hades, Celeste, Hollow Knight, God of War, etc.)
- Always consider scope — a great small game beats an unfinished ambitious one`;
    }

    /**
     * Load summaries of all 49 agent definitions.
     */
    private static loadAgentSummaries(): string {
        try {
            if (!fs.existsSync(GameStudioAgent.AGENTS_DIR)) {
                return "(Agent definitions not found — using built-in knowledge)";
            }

            const files = fs.readdirSync(GameStudioAgent.AGENTS_DIR).filter(f => f.endsWith(".md"));
            const summaries: string[] = [];

            for (const file of files) {
                const content = fs.readFileSync(path.join(GameStudioAgent.AGENTS_DIR, file), "utf-8");
                // Extract name and description from YAML frontmatter
                const nameMatch = content.match(/^name:\s*(.+)$/m);
                const descMatch = content.match(/^description:\s*"(.+?)"$/m);
                
                if (nameMatch && descMatch) {
                    summaries.push(`- **${nameMatch[1]}**: ${descMatch[1].substring(0, 120)}...`);
                }
            }

            return summaries.length > 0 
                ? summaries.join("\n") 
                : "(No agent definitions loaded)";
        } catch (e: any) {
            log(`[gamestudio] Failed to load agent summaries: ${e.message}`, "warn");
            return "(Agent definitions unavailable)";
        }
    }

    /**
     * Load the list of all 72 available skills/commands.
     */
    private static loadSkillList(): string {
        try {
            if (!fs.existsSync(GameStudioAgent.SKILLS_DIR)) {
                return "(Skill definitions not found — using built-in knowledge)";
            }

            const dirs = fs.readdirSync(GameStudioAgent.SKILLS_DIR, { withFileTypes: true })
                .filter(d => d.isDirectory())
                .map(d => d.name);

            const categories: Record<string, string[]> = {
                "Onboarding": ["start", "help", "project-stage-detect", "setup-engine", "adopt"],
                "Game Design": ["brainstorm", "map-systems", "design-system", "quick-design", "review-all-gdds", "propagate-design-change"],
                "Art & Assets": ["art-bible", "asset-spec", "asset-audit"],
                "Architecture": ["create-architecture", "architecture-decision", "architecture-review", "create-control-manifest"],
                "Stories & Sprints": ["create-epics", "create-stories", "dev-story", "sprint-plan", "sprint-status", "story-readiness", "story-done", "estimate"],
                "Reviews": ["design-review", "code-review", "balance-check", "content-audit", "scope-check", "perf-profile", "tech-debt", "gate-check", "consistency-check"],
                "QA & Testing": ["qa-plan", "smoke-check", "soak-test", "regression-suite", "test-setup", "test-helpers"],
                "Production": ["milestone-review", "retrospective", "bug-report", "bug-triage", "playtest-report"],
                "Release": ["release-checklist", "launch-checklist", "changelog", "patch-notes", "hotfix"],
                "Team Orchestration": ["team-combat", "team-narrative", "team-ui", "team-release", "team-polish", "team-audio", "team-level", "team-live-ops", "team-qa"],
            };

            const lines: string[] = [];
            for (const [category, skills] of Object.entries(categories)) {
                const available = skills.filter(s => dirs.includes(s));
                if (available.length > 0) {
                    lines.push(`**${category}**: ${available.map(s => `\`/${s}\``).join(", ")}`);
                }
            }

            return lines.length > 0 
                ? lines.join("\n") 
                : `Available: ${dirs.map(d => `\`/${d}\``).join(", ")}`;
        } catch (e: any) {
            log(`[gamestudio] Failed to load skill list: ${e.message}`, "warn");
            return "(Skill catalog unavailable)";
        }
    }
}
