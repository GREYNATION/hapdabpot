import dotenv from "dotenv";
import { TelegramBot } from "./bot/telegram.js";
import { startWebServer } from "./webServer.js";

dotenv.config();

console.log("[system] Initializing Gravity Claw Specialist Agent Architecture...");

const bot = new TelegramBot();

bot.launch();
startWebServer();

// Global Error Handling
process.on("unhandledRejection", (reason, promise) => {
    console.error("[system] Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (err) => {
    console.error("[system] Uncaught Exception:", err);
});

// Enable graceful stop
process.once("SIGINT", () => {
    console.log("[system] Stopping...");
    bot.stop("SIGINT");
});
process.once("SIGTERM", () => {
    console.log("[system] Stopping...");
    bot.stop("SIGTERM");
});
