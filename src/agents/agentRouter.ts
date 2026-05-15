import { TraderAgent } from "./TraderAgent.js";
import { ContentAgent } from "./ContentAgent.js";
import { GeneticTraderAgent } from "./trading/GeneticTraderAgent.js";
import { VisionAgent } from "./visionAgent.js";
import { aiRoute } from "./aiRouter.js";
import { handle as dramaHandle } from "./drama/DramaAgent.js";

// Specialized Agents (Phase 4)
import { HermesAgent } from "./hermesAgent.js";
import { AthenaAgent } from "./athenaAgent.js";
import { AresAgent } from "./aresAgent.js";
import { AtlasAgent } from "./atlasAgent.js";
import { HephaestusAgent } from "./hephaestusAgent.js";

const trader = new TraderAgent();
const content = new ContentAgent();
const genetics = new GeneticTraderAgent();
const vision = new VisionAgent();

// Instantiate new specialized agents
const hermes = new HermesAgent();
const athena = new AthenaAgent();
const ares = new AresAgent();
const atlas = new AtlasAgent();
const hephaestus = new HephaestusAgent();

export async function routeTask(task: string, userId: string) {
  const agentName = await aiRoute(task);

  switch (agentName) {
    case "Hermes":
      const hermesRes = await hermes.ask(task);
      return hermesRes.content;

    case "Athena":
      const athenaRes = await athena.ask(task);
      return athenaRes.content;

    case "Ares":
      const aresRes = await ares.ask(task);
      return aresRes.content;

    case "Atlas":
      const atlasRes = await atlas.ask(task);
      return atlasRes.content;

    case "Hephaestus":
      const hephaestusRes = await hephaestus.ask(task);
      return hephaestusRes.content;

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
      return "🤖 AI could not decide agent. Defaulting to Hephaestus for system check.";
  }
}
