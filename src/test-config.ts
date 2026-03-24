import { config } from "./core/config.js";

console.log("--- CONFIG DIAGNOSTIC ---");
console.log("TELEGRAM_BOT_TOKEN:", config.telegramToken ? "EXISTS" : "MISSING");
console.log("OPENAI_API_KEY:", config.openaiApiKey ? "EXISTS" : "MISSING");
console.log("GITHUB_TOKEN:", config.githubToken ? "EXISTS" : "MISSING");
console.log("BRAVE_API_KEY:", config.braveApiKey ? "EXISTS" : "MISSING");
console.log("--------------------------");

if (config.braveApiKey) {
    console.log("BRAVE_API_KEY value (first 4 chars):", config.braveApiKey.substring(0, 4));
} else {
    console.log("BRAVE_API_KEY is null/undefined in the config object.");
}
