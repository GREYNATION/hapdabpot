import dotenv from "dotenv";
import { TelegramBot } from "./bot/telegram.js";
import { startMorningBriefing } from "./cron/morningBriefing.js";
import { startLeadAlerts } from "./cron/leadAlerts.js";
import { startOutreachCron, registerOutreachHandlers } from "./services/outreachService.js";
import { startWebServer } from "./webServer.js";

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
} catch (err: any) {
    console.error("[system] CRITICAL: Bot launch failed:", err.message);
}

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

