import OpenAI from "openai";
import { OpenRouter } from "@openrouter/sdk";

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
    openaiApiKey: (process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY)?.trim(),
    openaiBaseUrl: process.env.OPENAI_BASE_URL?.trim() || "https://openrouter.ai/api/v1",
    openaiModel: process.env.OPENAI_MODEL?.trim() || "openai/gpt-4o-mini",
    backupModel: process.env.BACKUP_MODEL?.trim() || "meta-llama/llama-3.3-70b-instruct",
    visionModel: process.env.VISION_MODEL?.trim() || "openai/gpt-4o-mini",
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

    aiProvider: (process.env.AI_PROVIDER?.trim() || "openrouter") as "openrouter" | "gemini" | "anthropic",
    ownerId: (process.env.TELEGRAM_OWNER_ID ? parseInt(process.env.TELEGRAM_OWNER_ID) : undefined),
    glm5turboapikey: "bc9acf3d7cf44d7ab61ca63df309adab.KbLFEbBbSMD4A21K"
};
// Set default owner if not explicitly provided
if(!config.ownerId && config.allowedUserIds.length > 0) {
        config.ownerId = config.allowedUserIds[0];
}

log(`[system] Config loaded. Provider: ${config.aiProvider}`);

export const openai = new OpenAI({
    apiKey: config.openaiApiKey,
    baseURL: config.openaiBaseUrl,
});

export const openrouter = new OpenRouter({
    apiKey: config.openaiApiKey,
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
