import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { execSync } from "child_process";
import https from "https";
import { WikiService } from "../services/wikiService.js";

/**
 * ðŸ› ï¸ DEPRECATION SUPPRESSION
 * Silence the internal 'punycode' DEP0040 warning which comes from transitive dependencies (like tr46).
 */
const originalEmitWarning = process.emitWarning;
(process as any).emitWarning = function (warning: any, ...args: any[]) {
    if (typeof warning === 'string' && warning?.includes('DEP0040')) return;
    if (warning && typeof warning === 'object' && (warning as any).code === 'DEP0040') return;
    return originalEmitWarning.call(process, warning, ...args);
};

/**
 * ðŸš€ GLOBAL SYSTEM PRE-FLIGHT INITIALIZATION
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

/**
 * ðŸ› ï¸ PORT CLEANUP (Windows Support)
 */
function cleanupStaleProcesses() {
    if (process.platform !== 'win32') return;
    
    const ports = ['3141', '3142', '3200'];
    initLog(`ðŸ§¹ Cleaning up stale processes on ports: ${ports.join(', ')}...`);
    
    for (const port of ports) {
        try {
            // Find process ID using NetTCPConnection and stop it
            const command = `powershell -Command "Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"`;
            execSync(command);
        } catch (err) {
            // Silently fail if no process found or access denied
        }
    }
}

// 0. Cleanup ports before anything else
cleanupStaleProcesses();

// 1. Verify Environment Variables
const envCount = Object.keys(RAW_ENV).length;
if (envCount === 0) {
    initLog("âš ï¸ WARNING: No environment variables detected in process.env.");
    initLog("If running on Railway, ensure your variables are set in the Dashboard.");
}

// 2. Resolve and Guarantee Directories
const dbPath = RAW_ENV.DB_PATH || path.resolve('./data/memory.db');
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
    initLog(`ðŸ“‚ Creating critical storage directory: ${dbDir}`);
    try {
        fs.mkdirSync(dbDir, { recursive: true });
        initLog("âœ… Storage directory established.");
    } catch (err: any) {
        initLog(`âŒ FAILED to create directory: ${err.message}`);
    }
} else {
    initLog(`âœ… Storage directory confirmed: ${dbDir}`);
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
        initLog("âœ… n8n templates ready.");
    } catch (err: any) {
        initLog(`âš ï¸ Could not clone n8n templates: ${err.message}`);
        initLog("ðŸ‘‰ Please manually run: git clone https://github.com/enescingoz/awesome-n8n-templates.git n8n-templates");
    }
} else {
    initLog("âœ… n8n templates directory confirmed.");
}

// 4. Clone AI prompts if missing
const promptsDir = path.resolve("./ai-prompts");
if (!fs.existsSync(promptsDir)) {
    try {
        initLog("Cloning AI prompts repository...");
        execSync("git clone https://github.com/x1xhlol/system-prompts-and-models-of-ai-tools.git ai-prompts", { stdio: "inherit" });
        initLog("âœ… AI prompts ready.");
    } catch (err: any) {
        initLog(`âš ï¸ Could not clone AI prompts: ${err.message}`);
        initLog("ðŸ‘‰ Please manually run: git clone https://github.com/x1xhlol/system-prompts-and-models-of-ai-tools.git ai-prompts");
    }
} else {
    initLog("âœ… AI prompts directory confirmed.");
}

// 5. Clone Browser Harness if missing
const harnessDir = path.resolve("./browser-harness");
if (!fs.existsSync(harnessDir)) {
    try {
        initLog("Cloning Browser Harness repository...");
        execSync("git clone https://github.com/browser-use/browser-harness.git browser-harness", { stdio: "inherit" });
        initLog("âœ… Browser Harness ready.");
    } catch (err: any) {
        initLog(`âš ï¸ Could not clone Browser Harness: ${err.message}`);
        initLog("ðŸ‘‰ Please manually run: git clone https://github.com/browser-use/browser-harness.git browser-harness");
    }
} else {
    initLog("âœ… Browser Harness directory confirmed.");
}

// 7. Clone UI/UX Pro Max Skill if missing
const uxSkillDir = path.resolve("./ui-ux-pro-max-skill");
if (!fs.existsSync(uxSkillDir)) {
    try {
        initLog("Cloning UI/UX Pro Max Skill repository...");
        execSync("git clone https://github.com/nextlevelbuilder/ui-ux-pro-max-skill.git ui-ux-pro-max-skill", { stdio: "inherit" });
        initLog("âœ… UI/UX Pro Max Skill ready.");
    } catch (err: any) {
        initLog(`âš ï¸ Could not clone UI/UX Pro Max Skill: ${err.message}`);
        initLog("ðŸ‘‰ Please manually run: git clone https://github.com/nextlevelbuilder/ui-ux-pro-max-skill.git ui-ux-pro-max-skill");
    }
} else {
    initLog("âœ… UI/UX Pro Max Skill directory confirmed.");
}

// 8. Clone Claude-Obsidian if missing
const obsidianDir = path.resolve("./claude-obsidian");
if (!fs.existsSync(obsidianDir)) {
    try {
        initLog("Cloning Claude-Obsidian repository...");
        execSync("git clone https://github.com/AgriciDaniel/claude-obsidian.git claude-obsidian", { stdio: "inherit" });
        initLog("âœ… Claude-Obsidian ready.");
    } catch (err: any) {
        initLog(`âš ï¸ Could not clone Claude-Obsidian: ${err.message}`);
        initLog("ðŸ‘‰ Please manually run: git clone https://github.com/AgriciDaniel/claude-obsidian.git claude-obsidian");
    }
} else {
    initLog("âœ… Claude-Obsidian directory confirmed.");
}

// 9. Initialize Wiki Service
try {
    initLog("Initializing Spirit Brain (Obsidian Wiki)...");
    await WikiService.init();
    initLog("âœ… Spirit Brain online.");
} catch (err: any) {
    initLog(`âš ï¸ Spirit Brain init failed: ${err.message}`);
}

// 6. Log System Status
initLog(`CWD: ${process.cwd()}`);
initLog(`Resolved DB Path: ${dbPath}`);

export const initialized = true;

