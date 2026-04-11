import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
console.log("Key Prefix loaded:", process.env.OPENROUTER_API_KEY ? process.env.OPENROUTER_API_KEY.substring(0, 10) : "MISSING");

async function main() {
    try {
        console.log("Triggering /auto...");
        const { runClawAgent } = await import('./src/agents/claw/runClaw.js');
        const result = await runClawAgent("find surplus fund opportunities in Texas and notify me");
        console.log("\n\n=== RESULT ===");
        console.log(result);
        process.exit(0);
    } catch (err: any) {
        fs.writeFileSync('error.log', err.stack || err.message);
        process.exit(1);
    }
}

main();
