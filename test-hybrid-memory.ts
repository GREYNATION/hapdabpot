import { initDb, db, getSupabase, writeAgentMemory, readAgentMemory, logSession, emitSignal } from "./src/core/memory.js";

async function test() {
    console.log("Testing Hybrid Memory Layer (Master Brain Schema)...");
    
    // 1. Test SQLite
    try {
        initDb();
        const row = db.prepare("SELECT 1 as one").get();
        console.log("✅ SQLite operational:", row);
    } catch (e) {
        console.error("❌ SQLite failed:", e);
    }

    // 2. Test Supabase
    try {
        console.log("Supabase URL present:", !!process.env.SUPABASE_URL);
        console.log("Supabase Key present:", !!(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY));
        
        console.log("Connecting to Supabase...");
        const supabase = getSupabase();
        console.log("✅ Supabase client initialized.");
        
        console.log("Testing Supabase Memory (hapda_memory)...");
        await writeAgentMemory("test", "ping", "pong-" + Date.now());
        const value = await readAgentMemory("test", "ping");
        console.log("✅ Supabase Memory Result:", value);

        console.log("Testing Supabase Logs (hapda_session_logs)...");
        await logSession("test-agent", "Test Summary", { data: "test" });
        console.log("✅ Supabase Session Logged.");

        console.log("Testing Supabase Signals (hapda_signals)...");
        await emitSignal("test-source", "test-target", "test-event", { hello: "world" });
        console.log("✅ Supabase Signal Emitted.");

    } catch (e: any) {
        console.error("❌ Supabase failed:", e.message);
        console.log("Tip: Ensure the SQL schema provided has been run in the Supabase SQL Editor.");
        if (e.message.includes("404")) {
           console.log("Note: Table not found error usually means the SQL hasn't been run yet.");
        }
    }
}

test();
