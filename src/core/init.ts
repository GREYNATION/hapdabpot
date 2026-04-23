import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { execSync } from "child_process";
import https from "https";
import { WikiService } from "../services/wikiService.js";

/**
 * 🛠️ DEPRECATION SUPPRESSION
 * Silence the internal 'punycode' DEP0040 warning which comes from transitive dependencies (like tr46).
 */
const originalEmitWarning = process.emitWarning;
(process as any).emitWarning = function (warning: any, ...args: any[]) {
    if (typeof warning === 'string' && warning.includes('DEP0040')) return;
    if (warning && typeof warning === 'object' && (warning as any).code === 'DEP0040') return;
    return originalEmitWarning.call(process, warning, ...args);
};

/**
 * 🚀 GLOBAL SYSTEM PRE-FLIGHT INITIALIZATION
 * 
 * This script MUST be imported at the absolute top of all entry points.
 * It guarantees that the environment is loaded and that the disk is ready
 * for database connections before any modules attempt to open them.
 */

const RAW_ENV = process.env;

function initLog(msg: string) {
    const time = new Date().toLocaleTimeString();
    console.log(`[${time}] [INIT] ${msg}`);
}

// 1. Verify Environment Variables
const envCount = Object.keys(RAW_ENV).length;
if (envCount === 0) {
    initLog("⚠️ WARNING: No environment variables detected in process.env.");
    initLog("If running on Railway, ensure your variables are set in the Dashboard.");
}

// 2. Resolve and Guarantee Directories
const dbPath = RAW_ENV.DB_PATH || path.resolve('./data/memory.db');
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
    initLog(`📂 Creating critical storage directory: ${dbDir}`);
    try {
        fs.mkdirSync(dbDir, { recursive: true });
        initLog("✅ Storage directory established.");
    } catch (err: any) {
        initLog(`❌ FAILED to create directory: ${err.message}`);
    }
} else {
    initLog(`✅ Storage directory confirmed: ${dbDir}`);
}

// 3. Clone n8n templates if missing
const templatesDir = path.resolve("./n8n-templates");
if (!fs.existsSync(templatesDir)) {
    try {
        initLog("Preparing n8n templates...");
        
        // Try to install git if on a debian-based system
        try {
            execSync("apt-get update && apt-get install -y git 2>/dev/null", { stdio: "ignore" });
        } catch {
            // Silently fail if not on Linux or no root
        }

        initLog("Cloning n8n templates repository...");
        execSync("git clone https://github.com/enescingoz/awesome-n8n-templates.git n8n-templates", { stdio: "inherit" });
        initLog("✅ n8n templates ready.");
    } catch (err: any) {
        initLog(`⚠️ Could not clone n8n templates: ${err.message}`);
        initLog("👉 Please manually run: git clone https://github.com/enescingoz/awesome-n8n-templates.git n8n-templates");
    }
} else {
    initLog("✅ n8n templates directory confirmed.");
}

// 4. Clone AI prompts if missing
const promptsDir = path.resolve("./ai-prompts");
if (!fs.existsSync(promptsDir)) {
    try {
        initLog("Cloning AI prompts repository...");
        execSync("git clone https://github.com/x1xhlol/system-prompts-and-models-of-ai-tools.git ai-prompts", { stdio: "inherit" });
        initLog("✅ AI prompts ready.");
    } catch (err: any) {
        initLog(`⚠️ Could not clone AI prompts: ${err.message}`);
        initLog("👉 Please manually run: git clone https://github.com/x1xhlol/system-prompts-and-models-of-ai-tools.git ai-prompts");
    }
} else {
    initLog("✅ AI prompts directory confirmed.");
}

// 5. Clone Browser Harness if missing
const harnessDir = path.resolve("./browser-harness");
if (!fs.existsSync(harnessDir)) {
    try {
        initLog("Cloning Browser Harness repository...");
        execSync("git clone https://github.com/browser-use/browser-harness.git browser-harness", { stdio: "inherit" });
        initLog("✅ Browser Harness ready.");
    } catch (err: any) {
        initLog(`⚠️ Could not clone Browser Harness: ${err.message}`);
        initLog("👉 Please manually run: git clone https://github.com/browser-use/browser-harness.git browser-harness");
    }
} else {
    initLog("✅ Browser Harness directory confirmed.");
}

// 7. Clone UI/UX Pro Max Skill if missing
const uxSkillDir = path.resolve("./ui-ux-pro-max-skill");
if (!fs.existsSync(uxSkillDir)) {
    try {
        initLog("Cloning UI/UX Pro Max Skill repository...");
        execSync("git clone https://github.com/nextlevelbuilder/ui-ux-pro-max-skill.git ui-ux-pro-max-skill", { stdio: "inherit" });
        initLog("✅ UI/UX Pro Max Skill ready.");
    } catch (err: any) {
        initLog(`⚠️ Could not clone UI/UX Pro Max Skill: ${err.message}`);
        initLog("👉 Please manually run: git clone https://github.com/nextlevelbuilder/ui-ux-pro-max-skill.git ui-ux-pro-max-skill");
    }
} else {
    initLog("✅ UI/UX Pro Max Skill directory confirmed.");
}

// 8. Clone Claude-Obsidian if missing
const obsidianDir = path.resolve("./claude-obsidian");
if (!fs.existsSync(obsidianDir)) {
    try {
        initLog("Cloning Claude-Obsidian repository...");
        execSync("git clone https://github.com/AgriciDaniel/claude-obsidian.git claude-obsidian", { stdio: "inherit" });
        initLog("✅ Claude-Obsidian ready.");
    } catch (err: any) {
        initLog(`⚠️ Could not clone Claude-Obsidian: ${err.message}`);
        initLog("👉 Please manually run: git clone https://github.com/AgriciDaniel/claude-obsidian.git claude-obsidian");
    }
} else {
    initLog("✅ Claude-Obsidian directory confirmed.");
}

// 9. Initialize Wiki Service
try {
    initLog("Initializing Spirit Brain (Obsidian Wiki)...");
    await WikiService.init();
    initLog("✅ Spirit Brain online.");
} catch (err: any) {
    initLog(`⚠️ Spirit Brain init failed: ${err.message}`);
}

// 6. Log System Status
initLog(`CWD: ${process.cwd()}`);
initLog(`Resolved DB Path: ${dbPath}`);

export const initialized = true;
