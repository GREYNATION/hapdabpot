import { log, config } from "./core/config.js";
import { startupSequence } from "./core/startup.js";
import { Telegraf } from "telegraf";
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

        // 2. Setup Bot
        if (!config.telegramToken || config.telegramToken === "placeholder") {
            log("❌ TELEGRAM_BOT_TOKEN missing. Bot will not launch.", "error");
            process.exit(1);
        }

        const bot = new Telegraf(config.telegramToken);

        // 3. Register Routes
        setupRouter(bot);

        // 4. Initialize Cron Jobs
        initMarketScans(bot);

        // 5. Start Web Server FIRST (keeps health checks passing)
        startWebServer(bot);

        // 6. Launch bot in background — doesn't block the web server
        launchBotWithRetry(bot);

        // Graceful Stop
        process.once("SIGINT", () => bot.stop("SIGINT"));
        process.once("SIGTERM", () => bot.stop("SIGTERM"));

    } catch (err: any) {
        log(`[index] FATAL: ${err.message}`, "error");
        process.exit(1);
    }
}

async function launchBotWithRetry(bot: Telegraf) {
    try {
        await bot.telegram.deleteWebhook({ drop_pending_updates: true });
    } catch (e) {
        log("[bot] deleteWebhook failed, continuing...", "warn");
    }

    const MAX_RETRIES = 12;
    const DELAY_MS = 5000;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            await bot.launch();
            log("🚀 BOT LAUNCHED: Gravity Claw v5.0 ready.");
            return;
        } catch (err: any) {
            if (err?.response?.error_code === 409 && attempt < MAX_RETRIES) {
                log(`⏳ Bot conflict (attempt ${attempt}/${MAX_RETRIES}). Retrying in ${DELAY_MS / 1000}s...`, "warn");
                await new Promise(r => setTimeout(r, DELAY_MS));
            } else {
                log(`❌ Bot launch failed after ${attempt} attempts: ${err.message}`, "error");
                return; // don't crash the process — web server stays up
            }
        }
    }
}

main();
