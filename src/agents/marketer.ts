import { MarketerAgent } from "./marketerAgent.js";
const agent = new MarketerAgent();
export const marketerAgent = async (task: string) => {
  const res = await agent.ask(task);
  return res.content;
};

