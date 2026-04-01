import dotenv from "dotenv";
import { TelegramBot } from "./bot/telegram.js";
import { startMorningBriefing } from "./cron/morningBriefing.js";
import { startLeadAlerts } from "./cron/leadAlerts.js";
import { startOutreachCron, registerOutreachHandlers } from "./services/outreachService.js";
import { startWebServer } from "./webServer.js";
import { initMarketScans } from "./cron/marketScans.js";

dotenv.config();

console.log("[system] Starting Web Server...");
const server = startWebServer();

import { initWebSocket } from "./core/websocket.js";
initWebSocket(server);

console.log("[system] Initializing Telegram Bot...");
const bot = new TelegramBot();

try {
    bot.launch();
    registerOutreachHandlers(bot.getBot());
    startMorningBriefing(bot.getBot());
    startLeadAlerts(bot.getBot());
    startOutreachCron(bot.getBot());
    initMarketScans();
} catch (err: any) {
    console.error("[system] CRITICAL: Bot launch failed:", err.message);
}

// Global Error Handling
process.on("unhandledRejection", (err: any) => {
  if (err?.message?.includes("409")) {
    console.warn("[bot] Another instance is running — shutting down this one");
    process.exit(1); // Railway will restart cleanly
  }
  console.error("[system] Unhandled Rejection:", err);
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

