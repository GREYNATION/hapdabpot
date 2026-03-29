import { ResearcherAgent } from "./researcherAgent.js";
const agent = new ResearcherAgent();
export const researcherAgent = (task: string) => agent.ask(task);

