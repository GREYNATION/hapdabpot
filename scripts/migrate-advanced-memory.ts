import { getSupabase } from "../src/core/supabase.js";
import { log } from "../src/core/config.js";

/**
 * Migration: Advanced Episodic Memory
 * Creates tables for sessions, observations, and summaries in Supabase.
 */
async function migrate() {
    log("[migration] Connecting to Master Brain...");
    const client = getSupabase();
    if (!client) {
        log("[migration] ❌ ERROR: Supabase client not initialized. Check your SERVICE_ROLE_KEY.", "error");
        return;
    }

    // 1. Sessions Table
    log("[migration] Creating 'hapda_sessions'...");
    await client.rpc('exec_sql', { sql: `
        CREATE TABLE IF NOT EXISTS hapda_sessions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id TEXT NOT NULL,
            title TEXT,
            metadata JSONB DEFAULT '{}',
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );
    ` }).catch(e => log(`Warning: ${e.message}`));

    // 2. Observations (Memories) Table
    log("[migration] Creating 'hapda_observations'...");
    await client.rpc('exec_sql', { sql: `
        CREATE TABLE IF NOT EXISTS hapda_observations (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            session_id UUID REFERENCES hapda_sessions(id) ON DELETE CASCADE,
            domain TEXT NOT NULL,
            content TEXT NOT NULL,
            importance INTEGER DEFAULT 1,
            metadata JSONB DEFAULT '{}',
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
        
        -- Create index for domain and temporal searches
        CREATE INDEX IF NOT EXISTS idx_obs_session ON hapda_observations(session_id);
        CREATE INDEX IF NOT EXISTS idx_obs_domain ON hapda_observations(domain);
        CREATE INDEX IF NOT EXISTS idx_obs_created ON hapda_observations(created_at);
    ` }).catch(e => log(`Warning: ${e.message}`));

    // 3. Summaries Table
    log("[migration] Creating 'hapda_summaries'...");
    await client.rpc('exec_sql', { sql: `
        CREATE TABLE IF NOT EXISTS hapda_summaries (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            session_id UUID REFERENCES hapda_sessions(id) ON DELETE CASCADE,
            content TEXT NOT NULL,
            level INTEGER DEFAULT 1, -- 1=Daily, 2=Weekly, etc.
            metadata JSONB DEFAULT '{}',
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
    ` }).catch(e => log(`Warning: ${e.message}`));

    log("[migration] ✅ Advanced Memory tables created successfully.");
}

migrate();
