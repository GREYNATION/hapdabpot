import { ArchitectAgent } from "./architectAgent.js";

const agent = new ArchitectAgent();

/**
 * Routes a task to the appropriate agent based on keywords.
 * @param input The user's message or task description.
 * @returns The specialist agent responsible for the task.
 */
export function routeTask(input: string) {
  const text = input.toLowerCase();

  if (text.includes("build") || text.includes("api") || text.includes("backend")) {
    return "developer";
  }

  if (text.includes("research")) return "researcher";
  if (text.includes("marketing")) return "marketer";

  return "developer"; // fallback
}

/**
 * Architect agent that generates a structured plan for the routing.
 */
export const architectAgent = async (task: string) => {
  const assignedAgent = routeTask(task);
  const plan = {
    tasks: [
      { agent: assignedAgent, task: task }
    ]
  };
  return JSON.stringify(plan, null, 2);
};

