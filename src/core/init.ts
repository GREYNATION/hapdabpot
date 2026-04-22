import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { execSync } from "child_process";

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
        initLog("Cloning n8n templates repository...");
        execSync("git clone https://github.com/enescingoz/awesome-n8n-templates.git n8n-templates", { stdio: "inherit" });
        initLog("✅ n8n templates ready.");
    } catch (err: any) {
        initLog(`⚠️ Could not clone n8n templates: ${err.message}`);
    }
} else {
    initLog("✅ n8n templates directory confirmed.");
}

// 4. Log System Status
initLog(`CWD: ${process.cwd()}`);
initLog(`Resolved DB Path: ${dbPath}`);

export const initialized = true;
