import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import Groq from "groq-sdk";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();

export const config = {
    telegramToken: process.env.TELEGRAM_BOT_TOKEN?.trim(),
    allowedUserIds: (process.env.TELEGRAM_ALLOWED_USER_IDS || "")
        .split(",")
        .map(id => parseInt(id.trim()))
        .filter(id => !isNaN(id)),
    
    baseUrl: process.env.BASE_URL?.trim() || "http://localhost:8181",
    apifyToken: process.env.APIFY_TOKEN?.trim(),
    apifyUserId: process.env.APIFY_USER_ID?.trim(),
    scraperApiKey: process.env.SCRAPER_API_KEY?.trim(),

    // State-Specific Scrapers (Apify Actor IDs)
    txActorId: process.env.TX_ACTOR_ID?.trim(),
    flActorId: process.env.FL_ACTOR_ID?.trim(),
    gaActorId: process.env.GA_ACTOR_ID?.trim(),
    njActorId: process.env.NJ_ACTOR_ID?.trim(),
    
    // ── Infrastructure Paths ──────────────────────────────────────────────────
    volumePath: process.env.VOLUME_PATH?.trim() || process.cwd(),
    get dataDir() { return path.join(this.volumePath, "data"); },
    get logDir() { return path.join(this.volumePath, "logs"); },
    get brainDir() { return path.join(this.volumePath, "brain"); },
    
    openaiApiKey: process.env.GROQ_API_KEY?.trim(),
    openaiBaseUrl: "https://api.groq.com/openai/v1",
    openaiModel: process.env.OPENAI_MODEL?.trim() || "llama-3.3-70b-versatile",
    backupModel: process.env.BACKUP_MODEL?.trim() || "llama-3.3-70b-versatile",
    visionModel: process.env.VISION_MODEL?.trim() || "llama-3.2-11b-vision-preview",
    elevenKey: process.env.ELEVENLABS_API_KEY?.trim(),
    elevenVoiceId: process.env.ELEVENLABS_VOICE_ID?.trim() || "pNInz6obpg8ndEao7mAl",
    runwayApiKey: process.env.RUNWAY_API_KEY?.trim(),
    kieAiApiKey: process.env.KIE_AI_API_KEY?.trim(),
    githubToken: process.env.GITHUB_TOKEN?.trim(),
    braveApiKey: process.env.BRAVE_API_KEY?.trim(),
    dbPath: process.env.DB_PATH?.trim() || path.join(process.env.VOLUME_PATH?.trim() || process.cwd(), "data", "gravity-claw.db"),
    agentmailApiKey: process.env.AGENTMAIL_API_KEY?.trim(),
    agentmailEmail: process.env.AGENTMAIL_EMAIL?.trim(),
    anthropicApiKey: process.env.ANTHROPIC_API_KEY?.trim(),
    geminiApiKey: process.env.GEMINI_API_KEY?.trim(),
    geminiModel: process.env.GEMINI_MODEL?.trim() || "gemini-2.0-flash",
    deepseekApiKey: process.env.DEEPSEEK_API_KEY?.trim(),
    deepseekModel: process.env.DEEPSEEK_MODEL?.trim() || "deepseek-chat",
    aiProvider: "groq" as "groq" | "gemini" | "anthropic" | "deepseek",
    ownerId: (() => {
        const id = process.env.TELEGRAM_OWNER_ID || process.env.OWNER_CHAT_ID;
        if (!id) return undefined;
        const parsed = parseInt(id);
        return isNaN(parsed) ? undefined : parsed;
    })(),
    STITCH_MASTER_PROJECT_ID: "10494731315779539060",
};

if (!config.ownerId && config.allowedUserIds.length > 0) {
    config.ownerId = config.allowedUserIds[0];
}

export function log(msg: string, level: "info" | "warn" | "error" = "info") {
    const timestamp = new Date().toISOString();
    const formatted = `[${timestamp}] [${level.toUpperCase()}] ${msg}\n`;
    console.log(formatted.trim());
    try {
        const logFile = path.join(config.logDir, "bot.log");
        if (!fs.existsSync(config.logDir)) fs.mkdirSync(config.logDir, { recursive: true });
        fs.appendFileSync(logFile, formatted);
    } catch (e) {
        // Ignore logging errors
    }
}

/**
 * Ensure all infrastructure directories exist
 */
export function ensureDirs() {
    const dirs = [config.dataDir, config.logDir, config.brainDir, path.dirname(config.dbPath)];
    for (const dir of dirs) {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`[system] Created directory: ${dir}`);
        }
    }
}

ensureDirs();

log(`[system] Config loaded. Provider: ${config.aiProvider}. Owner: ${config.ownerId || 'NOT CONFIGURED'}`);
if (config.openaiApiKey) {
    const keyPrefix = config.openaiApiKey.startsWith("gsk_") ? "Groq" : "OpenAI";
    log(`[system] LLM Auth: Using ${keyPrefix} key (ends in ...${config.openaiApiKey.slice(-4)})`);
    log(`[ai] Groq key loaded: ${config.openaiApiKey.slice(0, 10)}...`);
} else {
    log(`[system] WARNING: LLM Auth: No API Key found in environment!`, "error");
}

// Lazy initialized clients
export let openai: OpenAI;
export let groq: Groq;
export let anthropic: Anthropic | null = null;

/**
 * Initialize config from Supabase if keys are missing from process.env
 */
export async function initializeConfig() {
    log("[config] Initializing dynamic config...");
    
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        log("[config] Skipping dynamic fetch: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing from environment", "warn");
    } else {
        try {
            const { memoryManager } = await import("../memory/memoryManager.js");

            const keysToFetch = [
                "TELEGRAM_BOT_TOKEN",
                "OPENROUTER_API_KEY",
                "ANTHROPIC_API_KEY",
                "GEMINI_API_KEY",
                "GROQ_API_KEY",
                "BRAVE_API_KEY",
                "ELEVENLABS_API_KEY",
                "APIFY_TOKEN",
                "OPENAI_MODEL"
            ];

            for (const key of keysToFetch) {
                if (!process.env[key]) {
                    try {
                        const value = await memoryManager.getCredential(key);
                        if (value) {
                            process.env[key] = value;
                            log(`[config] Fetched ${key} from Supabase`);
                        }
                    } catch (err) {
                        log(`[config] Error fetching ${key} from Supabase: ${err}`, "error");
                    }
                }
            }
        } catch (err) {
            log(`[config] Failed to load MemoryManager: ${err}`, "error");
        }
    }

    // Update config object values

    // Update config object values
    config.telegramToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
    config.openaiApiKey = process.env.GROQ_API_KEY?.trim();
    config.openaiModel = process.env.OPENAI_MODEL?.trim() || "llama-3.3-70b-versatile";
    config.anthropicApiKey = process.env.ANTHROPIC_API_KEY?.trim();
    config.braveApiKey = process.env.BRAVE_API_KEY?.trim();
    config.elevenKey = process.env.ELEVENLABS_API_KEY?.trim();
    config.apifyToken = process.env.APIFY_TOKEN?.trim();

    // Initialize clients
    openai = new OpenAI({
        apiKey: config.openaiApiKey || "placeholder",
        baseURL: config.openaiBaseUrl,
    });

    groq = new Groq({
        apiKey: config.openaiApiKey || "placeholder",
    });

    anthropic = config.anthropicApiKey
        ? new Anthropic({ apiKey: config.anthropicApiKey })
        : null;

    log("[config] Dynamic config initialization complete.");
}
