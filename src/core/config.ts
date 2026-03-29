import OpenAI from "openai";

import Anthropic from "@anthropic-ai/sdk";
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
    openaiApiKey: process.env.GROQ_API_KEY?.trim(),
    openaiBaseUrl: "https://api.groq.com/openai/v1",
    openaiModel: process.env.OPENAI_MODEL?.trim() || "llama-3.3-70b-versatile",
    backupModel: process.env.BACKUP_MODEL?.trim() || "llama-3.3-70b-versatile",
    visionModel: process.env.VISION_MODEL?.trim() || "llama-3.2-11b-vision-preview",
    elevenKey: process.env.ELEVENLABS_API_KEY?.trim(),
    elevenVoiceId: process.env.ELEVENLABS_VOICE_ID?.trim() || "pNInz6obpg8ndEao7mAl",
    runwayApiKey: process.env.RUNWAY_API_KEY?.trim(),
    kieAiApiKey: process.env.KIE_AI_API_KEY?.trim(),
    dbPath: process.env.DB_PATH?.trim() || "./data/gravity-claw.db",
    githubToken: process.env.GITHUB_TOKEN?.trim(),
    braveApiKey: process.env.BRAVE_API_KEY?.trim(),
    agentmailApiKey: process.env.AGENTMAIL_API_KEY?.trim(),
    agentmailEmail: process.env.AGENTMAIL_EMAIL?.trim(),
    anthropicApiKey: process.env.ANTHROPIC_API_KEY?.trim(),
    geminiApiKey: process.env.GEMINI_API_KEY?.trim(),
    geminiModel: process.env.GEMINI_MODEL?.trim() || "gemini-2.0-flash",

    aiProvider: "groq" as "groq" | "gemini" | "anthropic",
    ownerId: (() => {
        const id = process.env.TELEGRAM_OWNER_ID || process.env.OWNER_CHAT_ID;
        if (!id) return undefined;
        const parsed = parseInt(id);
        return isNaN(parsed) ? undefined : parsed;
    })(),
    glm5turboapikey: "bc9acf3d7cf44d7ab61ca63df309adab.KbLFEbBbSMD4A21K"
};
// Set default owner if not explicitly provided
if(!config.ownerId && config.allowedUserIds.length > 0) {
    config.ownerId = config.allowedUserIds[0];
}

log(`[system] Config loaded. Provider: ${config.aiProvider}. Owner: ${config.ownerId || 'NOT CONFIGURED'}`);
if (config.openaiApiKey) {
    const keyPrefix = config.openaiApiKey.startsWith("gsk_") ? "Groq" : "OpenAI";
    log(`[system] LLM Auth: Using ${keyPrefix} key (ends in ...${config.openaiApiKey.slice(-4)})`);
    log(`[ai] Groq key loaded: ${config.openaiApiKey.slice(0, 10)}...`);
} else {
    log(`[system] âš ï¸ LLM Auth: No API Key found in environment!`, "error");
}

export const openai = new OpenAI({
    apiKey: config.openaiApiKey,
    baseURL: config.openaiBaseUrl,
});

export const groq = new OpenAI({
    apiKey: config.openaiApiKey,
    baseURL: "https://api.groq.com/openai/v1",
});

export const gemini = null;
export const anthropic = config.anthropicApiKey ? new Anthropic({ apiKey: config.anthropicApiKey }) : null;

export function log(msg: string, level: "info" | "warn" | "error" = "info") {
    const timestamp = new Date().toISOString();
    const formatted = `[${timestamp}] [${level.toUpperCase()}] ${msg}\n`;
    console.log(formatted.trim());
    try {
        fs.appendFileSync(path.join(process.cwd(), "bot.log"), formatted);
    } catch (e) {
        // Ignore logging errors
    }
}

