// Force UTF-8 encoding
process.stdout.setEncoding("utf8");
process.stderr.setEncoding("utf8");
import "./core/init.js";
import 'dotenv/config';
import { log, config } from "./core/config.js";
import { startupSequence } from "./core/startup.js";
import { TelegramBot } from "./bot/telegram.js";
import { setupRouter } from "./bot/router.js";
import { startLeadAlerts, registerLeadAlertHandlers } from "./cron/leadAlerts.js";
import { startTrendAlerts } from "./cron/trendAlerts.js";
import { startHeartbeat } from "./cron/heartbeat.js";
import { startWebServer } from "./webServer.js";
import { contentScheduler } from "./agents/ContentSchedulerAgent.js";

// Global crash handlers to catch silent Railway deaths
process.on('uncaughtException', (err) => {
    log(`[FATAL] Uncaught Exception: ${err.message}\n${err.stack}`, 'error');
    process.exit(1);
});
process.on('unhandledRejection', (reason, p) => {
    log(`[WARN] Unhandled Rejection caught (non-fatal): ${reason}`, 'error');
    // ðŸ›¡ï¸ SHIELD: Do NOT process.exit(1) here. Scraper timeouts and blocked
    // requests cause recoverable rejections that should not kill the bot.
});

async function main() {
    log("ðŸŒŸ --- GRAVITY CLAW SYSTEM LOADING ---");

    try {
        // 1. Run core startup (Supabase config, DB init, AI clients)
        const ok = await startupSequence();
        if (!ok) {
            log("âš ï¸ System partially initialized. Proceeding in fallback mode.", "warn");
        }

        const tgBot = new TelegramBot();
        const bot = tgBot.getBot();

        // 3. Register command routes from router.ts
        setupRouter(bot);
        registerLeadAlertHandlers(bot);
        contentScheduler.attachBot(bot);

        // Register Hermes Acquisition Engine handlers
        const { registerHermesHandlers } = await import("../modules/hermes_bot.js");
        registerHermesHandlers(bot);

        log("[index] Step 1 Complete: Router & Hermes setup.");

        // 4. Initialize Cron Jobs (Skip if in Dashboard-only mode)
        const skipBot = process.env.SKIP_BOT === 'true';
        if (skipBot) {
            log("ðŸŒŒ [index] Dashboard-only mode detected. Skipping bot/cron launch.", "info");
        } else {
            log("[index] Step 2: Initializing Lead Alerts...");
            await startLeadAlerts(bot);
            startTrendAlerts(bot);
            startHeartbeat(bot);
            contentScheduler.startScheduler();
            log("[index] Step 2 Complete: Market Scans & Heartbeat.");
        }

        log("[index] Step 3: Starting Web Server...");
        // 5. Start Web Server (Dashboard + Neural Bridge)
        await startWebServer(bot);
        log("[index] Step 3 Complete: Web Server active.");

        // 6. Launch bot Supreme (Skip if in Dashboard-only mode)
        if (!skipBot) {
            log("[index] Step 4: Launching Telegram Bot polling...");
            tgBot.launch();
            log("[index] Step 4 Complete: Bot Launch called.");
        } else {
            log("ðŸŸ¢ [index] Local Neural Bridge online. Connect to dashboard to view cloud activity.");
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



// Enhanced unhandled rejection handler with full stack trace
process.on('unhandledRejection', (reason: any, promise: any) => {
  console.error('========================================');
  console.error('[CRASH] Unhandled Rejection');
  console.error('Time:', new Date().toISOString());
  console.error('Message:', reason?.message ?? reason);
  console.error('Stack:', reason?.stack ?? 'No stack available');
  console.error('========================================');
});

process.on('unhandledRejection', (reason: any) => {
    // Completely ignore the Puter.js shim crash to keep the bot alive
    if (reason?.stack?.includes('xhrshim.js')) {
        return; 
    }
    console.error('[CRASH PREVENTED] Path:', reason?.stack?.split('\n')[1]?.trim());
});

