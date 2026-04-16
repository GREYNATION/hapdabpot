import { log, config } from "./core/config.js";
import { startupSequence } from "./core/startup.js";
import { TelegramBot } from "./bot/telegram.js";
import { setupRouter } from "./bot/router.js";
import { initMarketScans } from "./cron/marketScans.js";
import { startWebServer } from "./webServer.js";

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

        // 3. Register command routes from router.ts
        setupRouter(bot);

        // 4. Initialize Cron Jobs (Skip if in Dashboard-only mode)
        const skipBot = process.env.SKIP_BOT === 'true';
        if (skipBot) {
            log("🌌 [index] Dashboard-only mode detected. Skipping bot/cron launch.", "info");
        } else {
            initMarketScans(bot);
        }

        // 5. Start Web Server (Dashboard + Neural Bridge)
        startWebServer(bot);

        // 6. Launch bot Supreme (Skip if in Dashboard-only mode)
        if (!skipBot) {
            tgBot.launch();
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
