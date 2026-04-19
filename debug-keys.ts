import { config } from "./src/core/config.js";
import "dotenv/config";

console.log("GROQ_API_KEY present:", !!process.env.GROQ_API_KEY);
if (process.env.GROQ_API_KEY) {
  console.log("GROQ_API_KEY ends with:", process.env.GROQ_API_KEY.slice(-5));
}
console.log("OPENROUTER_API_KEY present:", !!process.env.OPENROUTER_API_KEY);
if (process.env.OPENROUTER_API_KEY) {
  console.log("OPENROUTER_API_KEY ends with:", process.env.OPENROUTER_API_KEY.slice(-5));
}
console.log("Config openaiApiKey ends with:", config.openaiApiKey?.slice(-5));
