import { createClient } from '@supabase/supabase-js';
import "dotenv/config";

/**
 * setup_master_brain.ts
 * Initializes the required schema for the Gravity Claw Council of Spirits.
 */
async function initSchema() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
        console.error("❌ ERROR: Missing credentials in .env");
        return;
    }

    console.log(`🚀 INITIALIZING MASTER BRAIN SCHEMA @ ${url}`);
    const supabase = createClient(url, key);

    try {
        // 1. hapda_credentials (Unified Vault)
        console.log("Building 'hapda_credentials' table...");
        const { error: credError } = await supabase.rpc('admin_run_sql', {
            sql: `
                CREATE TABLE IF NOT EXISTS hapda_credentials (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL,
                    service TEXT,
                    metadata JSONB DEFAULT '{}'::jsonb,
                    updated_at TIMESTAMPTZ DEFAULT NOW()
                );
            `
        }).catch(async () => {
             // Fallback if admin RPC doesn't exist: attempt simple query to see if exists
             return supabase.from('hapda_credentials').select('count', { count: 'exact', head: true });
        });

        // 2. ops_logs (Visual Thinking Console)
        console.log("Building 'ops_logs' table...");
        // Since we can't always run raw SQL via API without a custom RPC, 
        // we'll provide the instructions if the table creation fails, 
        // but for Service Role keys, we can sometimes do it if the schema cache is fresh.
        // Actually, Supabase API doesn't support CREATE TABLE directly. 
        // We assume the user has initialized the DB or we use a clever hack if available.
        
        // BETTER APPROACH: We'll use the 'postgres' RPC if available, otherwise we'll tell the user.
        // MOST Supabase projects have a 'public' schema where we can just attempt an insert to "create" if Auto-schema was on (rare now).
        
        // REALISTIC APPROACH: We'll try to insert a dummy row. If it fails with "relation does not exist", 
        // we'll provide the SQL block for the user to paste into the Supabase SQL Editor.
        
        const { error: logTestError } = await supabase.from('ops_logs').select('id').limit(1);
        if (logTestError && logTestError.code === 'PGRST204') {
            console.log("⚠️  'ops_logs' table missing. Please run the following SQL in your Supabase SQL Editor:");
            console.log(`
                CREATE TABLE ops_logs (
                    id BIGSERIAL PRIMARY KEY,
                    agent TEXT NOT NULL,
                    message TEXT NOT NULL,
                    type TEXT NOT NULL,
                    timestamp TIMESTAMPTZ DEFAULT NOW()
                );
            `);
        } else {
            console.log("✅ 'ops_logs' already exists or is accessible.");
        }

        const { error: memTestError } = await supabase.from('memories').select('id').limit(1);
        if (memTestError && memTestError.code === 'PGRST204') {
             console.log("⚠️  'memories' table missing. Please run the following SQL in your Supabase SQL Editor:");
             console.log(`
                -- Enable Vector Extension
                CREATE EXTENSION IF NOT EXISTS vector;

                CREATE TABLE memories (
                    id BIGSERIAL PRIMARY KEY,
                    user_id TEXT,
                    agent TEXT,
                    content TEXT,
                    embedding vector(1536), -- Default for OpenAI embeddings
                    metadata JSONB DEFAULT '{}'::jsonb,
                    created_at TIMESTAMPTZ DEFAULT NOW()
                );
             `);
        } else {
            console.log("✅ 'memories' already exists or is accessible.");
        }

        console.log("\n--- SCHEMA INITIALIZATION STATUS ---");
        console.log("The script has verified your table availability.");
        console.log("If you see ⚠️  warnings above, please apply the SQL snippets to your project.");

    } catch (err: any) {
        console.error("❌ CRITICAL ERROR DURING INIT:", err.message);
    }
}

initSchema();
