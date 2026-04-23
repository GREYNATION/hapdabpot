import "dotenv/config";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import Groq from "groq-sdk";
import path from "path";
import { getSupabase } from "./supabase.js";



export function log(msg: string, level: "info" | "warn" | "error" = "info") {
    const time = new Date().toLocaleTimeString();
    console.log(`[${time}] [${level.toUpperCase()}] ${msg}`);
}

/**
 * Broadcasts a log entry to the Supabase 'ops_logs' table for the web Command Center.
 */
export async function logToOpsConsole(agent: string, message: string, type: "think" | "tool" | "error" | "status" | "chat" = "status") {
    const supabase = getSupabase();
    if (!supabase) return;

    try {
        await supabase.from("ops_logs").insert({
            agent,
            message,
            type,
            timestamp: new Date().toISOString()
        });
    } catch (e) {
        // Silently fail to avoid crashing the bot if logging fails
    }
}

const env = process.env;

export const config = {
    telegramToken: env.TELEGRAM_BOT_TOKEN || "",
    openaiApiKey: env.OPENAI_API_KEY || "",
    openaiModel: env.OPENAI_MODEL || "gpt-4o",
    groqModel: env.GROQ_MODEL || "llama-3.3-70b-versatile",
    anthropicModel: env.ANTHROPIC_MODEL || "claude-sonnet-4-5",
    deepseekModel: env.DEEPSEEK_MODEL || "deepseek-chat",
    aiProvider: env.AI_PROVIDER || (env.OPENROUTER_API_KEY ? "openrouter" : (env.OPENAI_API_KEY ? "openai" : "groq")),
    braveApiKey: env.BRAVE_API_KEY || "",
    elevenKey: env.ELEVENLABS_API_KEY || env.ELEVEN_API_KEY || "",
    elevenVoiceId: env.ELEVEN_VOICE_ID || "21m00Tcm4TlvDq8ikWAM", // Rachel (High compatibility)
    githubToken: env.GITHUB_TOKEN || "",
    apifyToken: env.APIFY_TOKEN || "",
    txActorId: env.TX_ACTOR_ID || "",
    flActorId: env.FL_ACTOR_ID || "",
    gaActorId: env.GA_ACTOR_ID || "",
    njActorId: env.NJ_ACTOR_ID || "",
    baseUrl: env.BASE_URL || "https://hapdabot.railway.app",
    scraperApiKey: env.SCRAPER_API_KEY || "",
    agentmailApiKey: env.AGENTMAIL_API_KEY || "",
    agentmailEmail: env.AGENTMAIL_EMAIL || "",
    kieAiApiKey: env.KIE_AI_API_KEY || "",
    runwayApiKey: env.RUNWAY_API_KEY || "",
    ownerId: parseInt(env.OWNER_ID || "0"),
    allowedUserIds: (env.ALLOWED_USER_IDS || "").split(",").map(id => parseInt(id.trim())).filter(id => !isNaN(id)),
    dbPath: process.env.DB_PATH || path.join(process.cwd(), "data", "memory.db"),
    brainDir: path.join(process.cwd(), "data", "brain"),
    anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
    visionModel: process.env.VISION_MODEL ?? "gpt-4-vision-preview",
    STITCH_MASTER_PROJECT_ID: process.env.STITCH_MASTER_PROJECT_ID ?? "",
    firecrawlApiKey: env.FIRECRAWL_API_KEY || "",
    openaiBaseUrl: env.OPENAI_BASE_URL || "",
};

// ── AI Clients (Exports are updated by initializeClients) ──────────────────

export let openai = new OpenAI({ 
    apiKey: env.OPENAI_API_KEY || "placeholder",
    baseURL: env.OPENAI_BASE_URL || undefined
});
export let groq = new Groq({ apiKey: env.GROQ_API_KEY || "placeholder" });
export let anthropic = env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: env.ANTHROPIC_API_KEY }) : null;

/**
 * Fetches dynamic credentials from Supabase table 'hapda_credentials'.
 * This allows the bot to run without a local .env file once registered.
 */
export async function initializeConfig() {
    log("[config] 🏛️ STARTING COUNCIL OF SPIRITS ENGINE");
    log("[config] Initializing dynamic config from Supabase...");
    const client = getSupabase();
    if (!client || process.env.SKIP_DB_CONFIG === 'true') {
        log("[config] Using local .env for configuration.");
        return;
    }

    const { data, error } = await client.from("hapda_credentials").select("key, value");
    if (error) {
        log(`[config] Failed to fetch credentials: ${error.message}`, "error");
        return;
    }

    if (data) {
        data.forEach((row: { key: string, value: string }) => {
            // Dynamic credentials from Supabase
            process.env[row.key] = row.value;
            if (row.key === "OPENAI_MODEL") config.openaiModel = row.value;
            if (row.key === "GROQ_MODEL") config.groqModel = row.value;
            if (row.key === "OPENAI_API_KEY") {
                openai = new OpenAI({ 
                    apiKey: row.value,
                    baseURL: process.env.OPENAI_BASE_URL || undefined
                });
                config.openaiApiKey = row.value;
            }
            if (row.key === "GROQ_API_KEY") groq = new Groq({ apiKey: row.value });
            if (row.key === "ANTHROPIC_API_KEY") anthropic = new Anthropic({ apiKey: row.value });
            if (row.key === "TELEGRAM_BOT_TOKEN") config.telegramToken = row.value;
            if (row.key === "BRAVE_API_KEY") config.braveApiKey = row.value;
            if (row.key === "ELEVEN_API_KEY") config.elevenKey = row.value;
            if (row.key === "ELEVEN_VOICE_ID") config.elevenVoiceId = row.value;
            if (row.key === "GITHUB_TOKEN") config.githubToken = row.value;
            if (row.key === "APIFY_TOKEN") config.apifyToken = row.value;
            if (row.key === "TX_ACTOR_ID") config.txActorId = row.value;
            if (row.key === "FL_ACTOR_ID") config.flActorId = row.value;
            if (row.key === "GA_ACTOR_ID") config.gaActorId = row.value;
            if (row.key === "NJ_ACTOR_ID") config.njActorId = row.value;
            if (row.key === "BASE_URL") config.baseUrl = row.value;
            if (row.key === "SCRAPER_API_KEY") config.scraperApiKey = row.value;
            if (row.key === "AGENTMAIL_API_KEY") config.agentmailApiKey = row.value;
            if (row.key === "AGENTMAIL_EMAIL") config.agentmailEmail = row.value;
            if (row.key === "KIE_AI_API_KEY") config.kieAiApiKey = row.value;
            if (row.key === "RUNWAY_API_KEY") config.runwayApiKey = row.value;
            if (row.key === "FIRECRAWL_API_KEY") config.firecrawlApiKey = row.value;
        });
        log(`[config] Loaded ${data.length} credentials from Master Brain.`);
    }
}
