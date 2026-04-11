import { TraderAgent } from "./TraderAgent.js";
import { ContentAgent } from "./ContentAgent.js";
import { aiRoute } from "./aiRouter.js";
import { handle as dramaHandle } from "./drama/DramaAgent.js";

const trader = new TraderAgent();
const content = new ContentAgent();

export async function routeTask(task: string, userId: string) {
  const agentName = await aiRoute(task);

  switch (agentName) {
    case "TraderAgent":
      return trader.execute(task, userId);

    case "ContentAgent":
      return content.execute(task, userId);

    case "DramaAgent":
      return dramaHandle(task, userId);

    default:
      return "🤖 AI could not decide agent.";
  }
}
