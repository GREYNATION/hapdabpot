import { log, config } from "./core/config.js";
import { startupSequence } from "./core/startup.js";
import { TelegramBot } from "./bot/telegram.js";
import { setupRouter } from "./bot/router.js";
import { initMarketScans } from "./cron/marketScans.js";
import { startWebServer } from "./webServer.js";

// Global crash handlers to catch silent Railway deaths
process.on('uncaughtException', (err) => {
    log(`[FATAL] Uncaught Exception: ${err.message}\n${err.stack}`, 'error');
    process.exit(1);
});
process.on('unhandledRejection', (reason, p) => {
    log(`[FATAL] Unhandled Rejection at: ${p} - reason: ${reason}`, 'error');
    process.exit(1);
});

async function main() {
    log("🌟 --- GRAVITY CLAW SYSTEM LOADING ---");

    try {
        // 1. Run core startup (Supabase config, DB init, AI clients)
        const ok = await startupSequence();
        if (!ok) {
            log("⚠️ System partially initialized. Proceeding in fallback mode.", "warn");
        }

        const tgBot = new TelegramBot();
        const bot = tgBot.getBot();

        log("[index] Step 1: Setting up Router...");
        // 3. Register command routes from router.ts
        setupRouter(bot);
        log("[index] Step 1 Complete: Router setup.");

        // 4. Initialize Cron Jobs (Skip if in Dashboard-only mode)
        const skipBot = process.env.SKIP_BOT === 'true';
        if (skipBot) {
            log("🌌 [index] Dashboard-only mode detected. Skipping bot/cron launch.", "info");
        } else {
            log("[index] Step 2: Initializing Market Scans...");
            initMarketScans(bot);
            log("[index] Step 2 Complete: Market Scans.");
        }

        log("[index] Step 3: Starting Web Server...");
        // 5. Start Web Server (Dashboard + Neural Bridge)
        startWebServer(bot);
        log("[index] Step 3 Complete: Web Server active.");

        // 6. Launch bot Supreme (Skip if in Dashboard-only mode)
        if (!skipBot) {
            log("[index] Step 4: Launching Telegram Bot polling...");
            tgBot.launch();
            log("[index] Step 4 Complete: Bot Launch called.");
        } else {
            log("🟢 [index] Local Neural Bridge online. Connect to dashboard to view cloud activity.");
        }

        // Graceful Stop
        process.once("SIGINT", () => bot.stop("SIGINT"));
        process.once("SIGTERM", () => bot.stop("SIGTERM"));

    } catch (err: any) {
        log(`[index] FATAL: ${err.message}`, "error");
        process.exit(1);
    }
}

main();
