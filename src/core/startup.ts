import { log, initializeConfig } from "./config.js";
import { initDb } from "./memory.js";
import { initializeClients } from "./ai.js";

/**
 * Global application startup sequence.
 * Ensures config is fetched from Supabase, clients are initialized,
 * and database schema is ready before any agents start.
 */
export async function startupSequence() {
    log("🚀 --- SYSTEM STARTUP SEQUENCE ---");

    try {
        // 1. Initialize core configuration (Fetch secrets from Supabase)
        await initializeConfig();

        // 2. Initialize database schema
        initDb();

        // 3. Initialize AI clients with fresh credentials
        initializeClients();

        // 4. Specialized agents are now handled via CouncilOrchestrator lazily
        
        log("✅ --- COUNCIL STARTUP COMPLETE ---");
        return true;
    } catch (err: any) {
        log(`[startup] FATAL ERROR: ${err.message}`, "error");
        // We still return true to allow the bot to boot in restricted mode
        // unless it's a critical missing config like TELEGRAM_BOT_TOKEN
        if (err.message.includes("TELEGRAM_BOT_TOKEN")) {
            throw err;
        }
        return false;
    }
}
