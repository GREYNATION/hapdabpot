import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { config, log } from "./config.js";

// Database is initialized using the redirected path from config.ts
export const db = new Database(config.dbPath);

// Enable WAL for better performance
db.pragma("journal_mode = WAL");

// ─── Supabase Client (Master Brain) ───────────────────────────────────────────

let _supabase: SupabaseClient | null = null;

/**
 * Returns a singleton instance of the Supabase client, or null if not configured
 */
export function getSupabase(): SupabaseClient | null {
  if (!_supabase) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

    if (!url || !key) {
      return null;
    }

    _supabase = createClient(url, key);
  }
  return _supabase;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type AgentDomain = "real_estate" | "trading" | "drama" | "global" | string;

export interface AgentSignal {
  id: string;
  source: AgentDomain;
  target: AgentDomain;
  event: string;
  payload: any;
  handled: boolean;
  created_at: string;
}

/**
 * Initialize the local database schema (for operational data)
 */
export function initDb() {
    log("[db] Initializing local database at: " + config.dbPath);

    // 1. Core conversations table
    db.exec(`
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chat_id INTEGER NOT NULL,
            role TEXT NOT NULL,          -- 'user' or 'assistant'
            content TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // 2. FTS5 Virtual Table for searching content
    db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
            content,
            content='messages',
            content_rowid='id'
        );
    `);

    // 3. Triggers to keep FTS in sync with the messages table
    db.exec(`
        CREATE TRIGGER IF NOT EXISTS messages_ai AFTER INSERT ON messages BEGIN
            INSERT INTO messages_fts(rowid, content) VALUES (new.id, new.content);
        END;

        CREATE TRIGGER IF NOT EXISTS messages_ad AFTER DELETE ON messages BEGIN
            INSERT INTO messages_fts(messages_fts, rowid, content) VALUES('delete', old.id, old.content);
        END;

        CREATE TRIGGER IF NOT EXISTS messages_au AFTER UPDATE ON messages BEGIN
            INSERT INTO messages_fts(messages_fts, rowid, content) VALUES('delete', old.id, old.content);
            INSERT INTO messages_fts(rowid, content) VALUES (new.id, new.content);
        END;
    `);

    // 4. Settings table for chat-specific preferences
    db.exec(`
        CREATE TABLE IF NOT EXISTS settings (
            chat_id INTEGER PRIMARY KEY,
            voice_mode INTEGER DEFAULT 0
        );
    `);
    
    // 5. CRM Deals table
    db.exec(`
        CREATE TABLE IF NOT EXISTS deals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            address TEXT NOT NULL,
            seller_name TEXT,
            seller_phone TEXT,
            arv REAL DEFAULT 0,
            repair_estimate REAL DEFAULT 0,
            max_offer REAL DEFAULT 0,
            status TEXT DEFAULT 'lead', 
            assigned_buyer TEXT,
            city TEXT,
            price REAL DEFAULT 0,
            surplus REAL DEFAULT 0,
            profit REAL DEFAULT 0,
            sale_price REAL DEFAULT 0,
            buyer_id INTEGER,
            assignment_fee REAL DEFAULT 0,
            outcome TEXT,
            invoice_prompted INTEGER DEFAULT 0,
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // Migration for existing databases
    try { db.prepare("SELECT outcome FROM deals LIMIT 1").get(); } catch (e) { db.exec("ALTER TABLE deals ADD COLUMN outcome TEXT;"); }
    try { db.prepare("SELECT invoice_prompted FROM deals LIMIT 1").get(); } catch (e) { db.exec("ALTER TABLE deals ADD COLUMN invoice_prompted INTEGER DEFAULT 0;"); }
    try { db.prepare("SELECT notes FROM deals LIMIT 1").get(); } catch (e) { db.exec("ALTER TABLE deals ADD COLUMN notes TEXT;"); }
    try { db.prepare("SELECT city FROM deals LIMIT 1").get(); } catch (e) { db.exec("ALTER TABLE deals ADD COLUMN city TEXT;"); }
    try { db.prepare("SELECT last_call_status FROM deals LIMIT 1").get(); } catch (e) { db.exec("ALTER TABLE deals ADD COLUMN last_call_status TEXT;"); }
    try { db.prepare("SELECT sale_price FROM deals LIMIT 1").get(); } catch (e) { 
        db.exec("ALTER TABLE deals ADD COLUMN sale_price REAL DEFAULT 0;");
        db.exec("ALTER TABLE deals ADD COLUMN buyer_id INTEGER;");
        db.exec("ALTER TABLE deals ADD COLUMN assignment_fee REAL DEFAULT 0;");
    }

    // 6. Buyers table
    db.exec(`
        CREATE TABLE IF NOT EXISTS buyers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            phone TEXT,
            email TEXT,
            city TEXT,
            budget REAL DEFAULT 0,
            buy_box TEXT DEFAULT '{}',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // 7. Background Queue table
    db.exec(`
        CREATE TABLE IF NOT EXISTS background_queue (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chat_id INTEGER NOT NULL,
            user_text TEXT,
            visual_context TEXT,
            is_voice_input INTEGER DEFAULT 0,
            status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
            retry_count INTEGER DEFAULT 0,
            last_error TEXT,
            response_text TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            processed_at DATETIME
        );
    `);

    // 8. Tasks table for persistent agent task tracking
    db.exec(`
        CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY,
            agent TEXT,
            task TEXT,
            status TEXT,
            result TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // 9. Lead Alerts table
    db.exec(`
        CREATE TABLE IF NOT EXISTS scraped_leads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            address TEXT NOT NULL,
            source TEXT,
            price REAL,
            estimated_arv REAL,
            estimated_repairs REAL,
            mao REAL,
            potential_profit REAL,
            days_on_market INTEGER,
            motivation_signals TEXT,
            url TEXT,
            alerted INTEGER DEFAULT 0,
            deal_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // 10. Search Criteria table
    db.exec(`
        CREATE TABLE IF NOT EXISTS lead_search_criteria (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            label TEXT NOT NULL,
            city TEXT,
            state TEXT,
            zip TEXT,
            max_price REAL DEFAULT 150000,
            min_arv REAL DEFAULT 100000,
            max_dom INTEGER DEFAULT 90,
            min_profit REAL DEFAULT 10000,
            active INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // 11. Outreach Sequences
    db.exec(`
        CREATE TABLE IF NOT EXISTS outreach_sequences (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            deal_id INTEGER NOT NULL,
            status TEXT DEFAULT 'pending',
            current_step INTEGER DEFAULT 0,
            next_run_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // 12. Outreach Logs
    db.exec(`
        CREATE TABLE IF NOT EXISTS outreach_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            deal_id INTEGER NOT NULL,
            type TEXT, -- 'sms', 'email'
            content TEXT,
            status TEXT, -- 'sent', 'failed'
            sent_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    console.log("[db] Database initialization complete.");
}

// ─── Operational Functions (SQLite) ───────────────────────────────────────────

/**
 * Save a message to the database
 */
export function saveMessage(chatId: number, role: "user" | "assistant", content: string) {
    const stmt = db.prepare("INSERT INTO messages (chat_id, role, content) VALUES (?, ?, ?)");
    return stmt.run(chatId, role, content);
}

/**
 * Perform FTS search
 */
export function searchMessages(query: string, limit = 5) {
    const sanitized = query.replace(/[^\p{L}\p{N} ]/gu, " ").trim();
    if (!sanitized) return [];
    const safeQuery = sanitized.split(/\s+/).filter(w => w.length > 2).join(" OR ");
    if (!safeQuery) return [];
    const stmt = db.prepare(`
        SELECT m.* FROM messages m
        JOIN messages_fts f ON m.id = f.rowid
        WHERE messages_fts MATCH ?
        ORDER BY rank
        LIMIT ?
    `);
    return stmt.all(safeQuery, limit);
}

/**
 * Get the most recent messages for a chat
 */
export function getRecentMessages(chatId: number, limit = 10) {
    const stmt = db.prepare(`
        SELECT role, content FROM (
            SELECT role, content, id FROM messages 
            WHERE chat_id = ? 
            ORDER BY id DESC 
            LIMIT ?
        ) ORDER BY id ASC
    `);
    const results = stmt.all(chatId, limit) as { role: string, content: string }[];
    return results.map(r => ({
        role: r.role as "user" | "assistant",
        content: r.content
    }));
}

export function addToQueue(chatId: number, text: string, context: any, isVoice: boolean) {
    const stmt = db.prepare(`
        INSERT INTO background_queue (chat_id, user_text, visual_context, is_voice_input)
        VALUES (?, ?, ?, ?)
    `);
    return stmt.run(chatId, text, JSON.stringify(context), isVoice ? 1 : 0);
}

export function getNextPendingTask() {
    const stmt = db.prepare(`
        SELECT * FROM background_queue 
        WHERE status = 'pending' AND processed_at IS NULL
        ORDER BY created_at ASC 
        LIMIT 1
    `);
    return stmt.get() as any;
}

export function markTaskAsProcessing(id: number) {
    const stmt = db.prepare("UPDATE background_queue SET status = 'processing', updated_at = CURRENT_TIMESTAMP WHERE id = ?");
    return stmt.run(id);
}

export function markTaskAsCompleted(id: number, responseText: string) {
    const stmt = db.prepare(`
        UPDATE background_queue 
        SET status = 'completed', response_text = ?, processed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
    `);
    return stmt.run(responseText, id);
}

export function updateTaskRetry(id: number, error: string) {
    const stmt = db.prepare(`
        UPDATE background_queue 
        SET retry_count = retry_count + 1, last_error = ?, updated_at = CURRENT_TIMESTAMP, status = 'pending'
        WHERE id = ?
    `);
    return stmt.run(error, id);
}

export function markTaskAsFailed(id: number, error: string) {
    const stmt = db.prepare(`
        UPDATE background_queue 
        SET status = 'failed', last_error = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
    `);
    return stmt.run(error, id);
}

// ─── Agent Intelligence (Supabase Master Brain) ───────────────────────────────

/**
 * Read global configuration or state shared across all agents
 */
export async function readGlobalMemory(key: string): Promise<string | null> {
  const client = getSupabase();
  if (!client) return null;

  const { data, error } = await client
    .from("hapda_memory")
    .select("value")
    .eq("domain", "global")
    .eq("key", key)
    .single();

  if (error || !data) return null;
  return data.value;
}

/**
 * Write global configuration or state
 */
export async function writeGlobalMemory(key: string, value: string): Promise<void> {
  const client = getSupabase();
  if (!client) return;

  const { error } = await client.from("hapda_memory").upsert({
    domain: "global",
    key,
    value,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    console.error(`[memory] writeGlobalMemory Error (${key}):`, error);
  } else {
    // Mirror to disk for Antigravity workspace persistence
    syncBrainToDisk().catch(() => {});
  }
}

/**
 * Read agent-specific short-term state
 */
export async function readAgentMemory(domain: AgentDomain, key: string): Promise<string | null> {
  const client = getSupabase();
  if (!client) return null;

  const { data, error } = await client
    .from("hapda_memory")
    .select("value")
    .eq("domain", domain)
    .eq("key", key)
    .single();

  if (error || !data) return null;
  return data.value;
}

/**
 * Write agent-specific short-term state
 */
export async function writeAgentMemory(domain: AgentDomain, key: string, value: string): Promise<void> {
  const client = getSupabase();
  if (!client) return;

  const { error } = await client.from("hapda_memory").upsert({
    domain,
    key,
    value,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    console.error(`[memory] writeAgentMemory Error (${domain}/${key}):`, error);
  } else {
    // Mirror to disk for Antigravity workspace persistence
    syncBrainToDisk().catch(() => {});
  }
}

/**
 * List all memory entries for a specific agent domain
 */
export async function listAgentMemory(domain: AgentDomain): Promise<{ key: string, value: string }[]> {
  const client = getSupabase();
  if (!client) return [];

  const { data, error } = await client
    .from("hapda_memory")
    .select("key, value")
    .eq("domain", domain);

  if (error || !data) return [];
  return data;
}

/**
 * Store long-term knowledge strings
 */
export async function writeKnowledge(domain: AgentDomain, topic: string, content: string, source: string = "system"): Promise<void> {
  const client = getSupabase();
  if (!client) return;

  const { error } = await client.from("hapda_knowledge").insert({
    domain,
    topic,
    content,
    source,
    created_at: new Date().toISOString(),
  });

  if (error) {
    console.error(`[memory] writeKnowledge Error (${topic}):`, error);
  }
}

/**
 * Retrieve specialized domain patterns
 */
export async function getDomainContext(domain: AgentDomain): Promise<string> {
  const client = getSupabase();
  if (!client) return `No context found (Supabase not configured) for domain: ${domain}`;

  const { data, error } = await client
    .from("hapda_knowledge")
    .select("topic, content")
    .eq("domain", domain)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error || !data) return `No context found for domain: ${domain}`;

  return data.map((k) => `### ${k.topic}\n${k.content}`).join("\n\n");
}

/**
 * Log a production or execution session
 */
export async function logSession(agent: string, summary: string, raw_output: any = null, meta: any = {}): Promise<void> {
  const client = getSupabase();
  if (!client) {
    log(`[memory] Cloud logging skipped (Supabase not configured): ${summary}`);
    return;
  }

  const { error } = await client.from("hapda_session_logs").insert({
    agent,
    summary,
    raw_output,
    meta,
    created_at: new Date().toISOString(),
  });

  if (error) {
    console.error("[memory] logSession Error:", error);
  }
}

/**
 * Get recent execution logs for a specific agent
 */
export async function getRecentLogs(agent: string, limit: number = 5): Promise<{ created_at: string, summary: string }[]> {
  const client = getSupabase();
  if (!client) return [];

  const { data, error } = await client
    .from("hapda_session_logs")
    .select("created_at, summary")
    .eq("agent", agent)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data as { created_at: string, summary: string }[];
}

/**
 * Broadcast a signal for other agents to catch
 */
export async function emitSignal(from_domain: AgentDomain, to_domain: AgentDomain, event: string, payload: any): Promise<void> {
  const client = getSupabase();
  if (!client) return;

  const { error } = await client.from("hapda_signals").insert({
    from_domain,
    to_domain,
    event,
    payload,
    handled: false,
    created_at: new Date().toISOString(),
  });

  if (error) {
    console.error(`[memory] emitSignal Error (${event}):`, error);
  }
}

/**
 * Get signals aimed at a specific domain
 */
export async function getUnhandledSignals(domain: AgentDomain): Promise<AgentSignal[]> {
  const client = getSupabase();
  if (!client) return [];

  const { data, error } = await client
    .from("hapda_signals")
    .select("*")
    .eq("to_domain", domain)
    .eq("handled", false)
    .order("created_at", { ascending: true });

  if (error || !data) return [];
  return data as AgentSignal[];
}

/**
 * ── Physical Brain Mirror (Antigravity Mapping) ─────────────────────────────
 */

/**
 * Mirror the cloud/SQL brain to physical files for local browsing
 */
export async function syncBrainToDisk(): Promise<void> {
  log("[memory] Syncing Master Brain to physical volume...");
  try {
    const domains: AgentDomain[] = ["global", "real_estate", "trading", "drama"];
    
    const client = getSupabase();
    if (!client) return;

    for (const domain of domains) {
      const { data, error } = await client
        .from("hapda_memory")
        .select("*")
        .eq("domain", domain);

      if (error || !data) continue;

      let content = `# 🧠 Agent Brain: ${domain.toUpperCase()}\n\n`;
      content += `Generated: ${new Date().toISOString()}\n\n`;
      content += `| Key | Value | Updated |\n`;
      content += `| --- | --- | --- |\n`;

      for (const row of data) {
        content += `| ${row.key} | \`${row.value}\` | ${row.updated_at} |\n`;
      }

      const fileName = `${domain}_memory.md`;
      const filePath = path.join(config.brainDir, fileName);
      fs.writeFileSync(filePath, content);
    }

    log("✅ Master Brain mirrored to: " + config.brainDir);
  } catch (err: any) {
    log(`[memory] syncBrainToDisk error: ${err.message}`, "error");
  }
}

/**
 * Mark a signal as processed
 */
export async function markSignalHandled(signalId: string): Promise<void> {
  const client = getSupabase();
  if (!client) return;

  const { error } = await client.from("hapda_signals").update({ handled: true }).eq("id", signalId);

  if (error) {
    console.error(`[memory] markSignalHandled Error (${signalId}):`, error);
  }
}

