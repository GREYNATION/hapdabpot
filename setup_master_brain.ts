import { createClient } from '@supabase/supabase-js';
import "dotenv/config";

async function initSchema() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
        console.error("ERROR: Missing credentials in .env");
        return;
    }

    console.log("INITIALIZING MASTER BRAIN...");
    const supabase = createClient(url, key);

    console.log("Building hapda_credentials table...");
    const { error: credError } = await supabase.rpc('admin_run_sql', {
        sql: "CREATE TABLE IF NOT EXISTS hapda_credentials (key TEXT PRIMARY KEY, value TEXT NOT NULL, service TEXT, metadata JSONB DEFAULT '{}'::jsonb, updated_at TIMESTAMPTZ DEFAULT NOW());"
    });
    if (credError) console.error("Credentials error:", credError);
    else console.log("hapda_credentials ready");

    console.log("Building ops_logs table...");
    const { error: logError } = await supabase.rpc('admin_run_sql', {
        sql: "CREATE TABLE IF NOT EXISTS ops_logs (id BIGSERIAL PRIMARY KEY, level TEXT DEFAULT 'info', message TEXT, context JSONB DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ DEFAULT NOW());"
    });
    if (logError) console.error("Ops logs error:", logError);
    else console.log("ops_logs ready");

    console.log("MASTER BRAIN ONLINE");
}

initSchema();
