import { log, config } from "./core/config.js";
import { startupSequence } from "./core/startup.js";
import { Telegraf } from "telegraf";
import { setupRouter } from "./bot/router.js";
import { initMarketScans } from "./cron/marketScans.js";

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

        // 5. Launch
        bot.launch();
        log("🚀 BOT LAUNCHED: Gravity Claw v5.0 ready.");

        // Graceful Stop
        process.once("SIGINT", () => bot.stop("SIGINT"));
        process.once("SIGTERM", () => bot.stop("SIGTERM"));

    } catch (err: any) {
        log(`[index] FATAL: ${err.message}`, "error");
        process.exit(1);
    }
}

main();
