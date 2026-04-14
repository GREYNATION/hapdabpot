import { config, initializeConfig, log } from "./core/config.js";
import { getSupabase } from "./core/supabase.js";

async function testConfig() {
    log("--- START CONFIG DIAGNOSTIC ---");
    
    // 1. Initial state (local .env)
    console.log("Local Config State:");
    console.log("- Telegram Token:", config.telegramToken ? "YES" : "NO");
    console.log("- OpenAI Key:", config.openaiApiKey ? "YES" : "NO");
    console.log("- Brave Key:", config.braveApiKey ? "YES" : "NO");
    console.log("- GitHub Token:", config.githubToken ? "YES" : "NO");

    // 2. Test Supabase connectivity
    const client = getSupabase();
    console.log("\nSupabase Connection:", client ? "CONNECTED" : "FAILED");

    // 3. Trigger dynamic loading
    await initializeConfig();

    // 4. Post-dynamic state
    console.log("\nDynamic Config State (After Supabase):");
    console.log("- Telegram Token:", config.telegramToken ? "YES" : "NO");
    console.log("- OpenAI Key:", config.openaiApiKey ? "YES" : "NO");
    console.log("- Brave Key:", config.braveApiKey ? "YES" : "NO");
    console.log("- GitHub Token:", config.githubToken ? "YES" : "NO");
    
    log("--- END CONFIG DIAGNOSTIC ---");
}

testConfig().catch(err => {
    console.error("Test failed:", err);
});
