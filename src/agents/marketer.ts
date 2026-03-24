import { MarketerAgent } from "./marketerAgent.js";
const agent = new MarketerAgent();
export const marketerAgent = (task: string) => agent.ask(task);
