import { TraderAgent } from "./TraderAgent.js";
import { RealEstateAgent } from "./RealEstateAgent.js";
import { ContentAgent } from "./ContentAgent.js";
import { aiRoute } from "./aiRouter.js";

const trader = new TraderAgent();
const realEstate = new RealEstateAgent();
const content = new ContentAgent();

export async function routeTask(task: string, userId: string) {
  const agentName = await aiRoute(task);

  switch (agentName) {
    case "TraderAgent":
      return trader.execute(task, userId);

    case "RealEstateAgent":
      return realEstate.execute(task, userId);

    case "ContentAgent":
      return content.execute(task, userId);

    default:
      return "🤖 AI could not decide agent.";
  }
}