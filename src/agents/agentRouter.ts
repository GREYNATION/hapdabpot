import { TraderAgent } from "./TraderAgent.js";
import { ContentAgent } from "./ContentAgent.js";
import { GeneticTraderAgent } from "./trading/GeneticTraderAgent.js";
import { VisionAgent } from "./visionAgent.js";
import { aiRoute } from "./aiRouter.js";
import { handle as dramaHandle } from "./drama/DramaAgent.js";

const trader = new TraderAgent();
const content = new ContentAgent();
const genetics = new GeneticTraderAgent();
const vision = new VisionAgent();

export async function routeTask(task: string, userId: string) {
  const agentName = await aiRoute(task);

  switch (agentName) {
    case "TraderAgent":
      return trader.execute(task, userId);

    case "ContentAgent":
      return content.execute(task, userId);

    case "DramaAgent":
      return dramaHandle(task, userId);

    case "GeneticTraderAgent":
      const genRes = await genetics.ask(task);
      return genRes.content;

    case "VisionAgent":
      const visRes = await vision.ask(task);
      return visRes.content;

    default:
      return "🤖 AI could not decide agent.";
  }
}
