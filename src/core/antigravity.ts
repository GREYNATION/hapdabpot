import { ArchitectAgent } from "../agents/architectAgent.js";
import { DeveloperAgent } from "../agents/developerAgent.js";
import { ResearcherAgent } from "../agents/researcherAgent.js";
import { MarketerAgent } from "../agents/marketerAgent.js";
import { GitHubAgent } from "../agents/githubAgent.js";
import { handleTask } from "../openrouter.js";
import { AgentType } from "./router.js";

export interface AntigravityRequest {
    agent: AgentType;
    instruction: string;
    history?: any[];
    systemOverride?: string;
}

export class Antigravity {
    private architect = new ArchitectAgent();
    private developer = new DeveloperAgent();
    private researcher = new ResearcherAgent();
    private marketer = new MarketerAgent();
    private github = new GitHubAgent();

    async run(req: AntigravityRequest): Promise<{ content: string }> {
        const { agent, instruction, history = [], systemOverride } = req;
        
        switch (agent) {
            case "architect":
                return await this.architect.ask(instruction, history, systemOverride);
            case "developer":
                return await this.developer.ask(instruction, history, systemOverride);
            case "researcher":
                return await this.researcher.ask(instruction, history, systemOverride);
            case "marketer":
                return await this.marketer.ask(instruction, history, systemOverride);
            case "github":
                return await this.github.ask(instruction, history, systemOverride);
            case "general":
            default:
                return { content: await handleTask(instruction) };
        }
    }
}

export const antigravity = new Antigravity();
