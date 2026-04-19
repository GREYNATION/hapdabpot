import { OUT_THE_WAY_EP1, CinemaAgent } from './src/agents/cinema/CinemaAgent.js';
import "dotenv/config";

const agent = new CinemaAgent();
console.log("Testing processScene for Scene 1...");
agent.processScene(OUT_THE_WAY_EP1.scenes[0]).then(r => console.log(JSON.stringify(r, null, 2))).catch(console.error);
