import { memoryManager } from "../src/memory/memoryManager.js";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";

// Load .env from the root
dotenv.config({ path: path.join(process.cwd(), ".env") });

async function migrate() {
  const keysToMigrate = [
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

  console.log("🚀 Starting credential migration...");

  for (const key of keysToMigrate) {
    const value = process.env[key];
    if (value) {
      console.log(`Migrating ${key}...`);
      const service = key.split('_')[0].toLowerCase();
      
      try {
        await memoryManager.setCredential({
          key,
          value,
          service,
          metadata: { migratedAt: new Date().toISOString() }
        });
        console.log(`✅ ${key} migrated successfully.`);
      } catch (err) {
        console.error(`❌ Failed to migrate ${key}:`, err);
      }
    } else {
      console.log(`⚠️  ${key} not found in .env, skipping.`);
    }
  }

  console.log("✅ Migration complete.");
}

migrate().catch(console.error);
