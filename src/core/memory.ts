import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { config, log } from "./config.js";
import { initLeadsTable } from "../db/leads.js";
import { getSupabase } from "./supabase.js";

// ─── Database Initialization ───────────────────────────────────────────

// Ensure directory exists for SQLite
// Resolve path RELATIVE TO RUNTIME (important)
const dbPath = path.resolve(process.env.DB_PATH || './data/memory.db');

// Ensure directory exists
const dir = path.dirname(dbPath);

if (!fs.existsSync(dir)) {
  console.log('Creating DB directory:', dir);
  fs.mkdirSync(dir, { recursive: true });
}

// Create DB
export const db = new Database(dbPath);
console.log('DB connected at:', dbPath);
console.log('CWD:', process.cwd());

/**
 * Returns the singleton database instance.
 */
export const getDb = () => db;


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

export interface Observation {
  id: string;
  session_id: string;
  domain: string;
  content: string;
  importance: number;
  metadata: any;
  created_at: string;
}

/**
 * Initialize the local database schema (for operational data)
 */
export function initDb() {
  log("[db] Initializing local database at: " + config.dbPath);

  db.exec(`
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chat_id INTEGER NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

  db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
            content,
            content='messages',
            content_rowid='id'
        );
    `);

  // 6. Stuyza Agency Leads table (Modular)
  initLeadsTable(db);

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
            zip_code TEXT,
            profit REAL DEFAULT 0,
            surplus REAL DEFAULT 0,
            price REAL DEFAULT 0,
            sale_price REAL DEFAULT 0,
            buyer_id INTEGER,
            assignment_fee REAL DEFAULT 0,
            outcome TEXT,
            notes TEXT,
            last_call_status TEXT,
            invoice_prompted INTEGER DEFAULT 0,
            acquisition_score INTEGER DEFAULT 0,
            summary_why_it_matters TEXT,
            summary_risk_level TEXT,
            summary_opportunity TEXT,
            summary_market_signals TEXT,
            summary_strategy TEXT,
            intelligence_status TEXT DEFAULT 'pending',
            intelligence_retries INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

  // 8. Real Estate Buyers table
  db.exec(`
        CREATE TABLE IF NOT EXISTS buyers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            phone TEXT,
            email TEXT,
            city TEXT,
            budget REAL,
            buy_box TEXT, -- JSON criteria
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

  // 9. Outreach Sequences table
  db.exec(`
        CREATE TABLE IF NOT EXISTS outreach_sequences (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            deal_id INTEGER NOT NULL,
            status TEXT DEFAULT 'active',
            current_step INTEGER DEFAULT 0,
            next_run_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

  // 10. Outreach Logs table
  db.exec(`
        CREATE TABLE IF NOT EXISTS outreach_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            deal_id INTEGER NOT NULL,
            type TEXT NOT NULL, -- 'sms', 'call', 'email'
            content TEXT,
            status TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

  // 11. Lead Search Criteria (Modular)
  db.exec(`
        CREATE TABLE IF NOT EXISTS lead_search_criteria (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            label TEXT NOT NULL,
            state TEXT NOT NULL,
            city TEXT NOT NULL,
            zip_codes TEXT, -- Comma-separated list of target ZIPs
            max_price REAL DEFAULT 500000,
            min_profit REAL DEFAULT 20000,
            active INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

  // 12. Scraped Leads table (Cache)
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
            motivation_signals TEXT, -- JSON
            url TEXT,
            alerted INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

  // 13. Real Estate Leads table (Parcel-based)
  db.exec(`
        CREATE TABLE IF NOT EXISTS leads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            parcel TEXT UNIQUE,
            address TEXT,
            owner TEXT,
            distress_type TEXT,
            score INTEGER,
            mao REAL DEFAULT 0,
            status TEXT DEFAULT 'NEW',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

  // 14. Seed Default Criteria
  const existing = db.prepare("SELECT COUNT(*) as count FROM lead_search_criteria").get() as any;
  if (existing?.count === 0) {
    // 🏗️ Seed Cleveland as the primary Gold Mine
    db.prepare("INSERT INTO lead_search_criteria (label, state, city, zip_codes, max_price, min_profit) VALUES (?, ?, ?, ?, ?, ?)").run(
        'Cleveland Gold Mine', 
        'OH', 
        'Cleveland', 
        '44102,44105,44108,44110,44112,44128', 
        250000, 
        25000
    );
    db.prepare("INSERT INTO lead_search_criteria (label, state, city, max_price, min_profit) VALUES (?, ?, ?, ?, ?)").run('Houston Surplus', 'TX', 'Houston', 600000, 25000);
    log("[db] Seeded Cleveland Gold Mine and Houston default search criteria.");
  }

  log("[db] Database initialization complete.");
}

// ─── Operational Functions (SQLite) ───────────────────────────────────────────

export function saveMessage(chatId: number, role: "user" | "assistant", content: string) {
  const stmt = db.prepare("INSERT INTO messages (chat_id, role, content) VALUES (?, ?, ?)");
  return stmt.run(chatId, role, content);
}

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

// ─── Agent Intelligence (Supabase Master Brain) ───────────────────────────────

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

export async function writeGlobalMemory(key: string, value: string): Promise<void> {
  const client = getSupabase();
  if (!client) return;

  const { error } = await client.from("hapda_memory").upsert({
    domain: "global",
    key,
    value,
    updated_at: new Date().toISOString(),
  });
}

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

export async function writeAgentMemory(domain: AgentDomain, key: string, value: string): Promise<void> {
  const client = getSupabase();
  if (!client) return;

  const { error } = await client.from("hapda_memory").upsert({
    domain,
    key,
    value,
    updated_at: new Date().toISOString(),
  });
}

export async function writeKnowledge(domain: AgentDomain, key: string, value: string, source: string): Promise<void> {
  const client = getSupabase();
  if (!client) return;
  await client.from("hapda_knowledge").upsert({
    domain,
    key,
    content: value,
    source,
    updated_at: new Date().toISOString()
  });
}

// ─── Episodic Memory (Advanced) ─────────────────────────────────────────────

export async function createSession(userId: string, title?: string): Promise<string | null> {
  const client = getSupabase();
  if (!client) return null;

  const { data, error } = await client
    .from("hapda_sessions")
    .insert({ user_id: userId, title, metadata: { source: "hapdabot" } })
    .select("id")
    .single();

  if (error) {
    log(`[memory] Failed to create session: ${error.message}`, "error");
    return null;
  }
  return data.id;
}

export async function addObservation(sessionId: string, domain: string, content: string, importance: number = 1): Promise<void> {
  const client = getSupabase();
  if (!client) return;

  const { error } = await client.from("hapda_observations").insert({
    session_id: sessionId,
    domain,
    content,
    importance,
    metadata: { timestamp: new Date().toISOString() }
  });

  if (error) log(`[memory] Observation error: ${error.message}`, "error");
}

export async function getTimeline(sessionId: string, limit: number = 20): Promise<Observation[]> {
  const client = getSupabase();
  if (!client) return [];

  const { data, error } = await client
    .from("hapda_observations")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true })
    .limit(limit);

  return (data || []) as Observation[];
}

/**
 * SearchOrchestrator — Coordinates Semantic and Temporal Retrieval
 */
export class SearchOrchestrator {
    static async search(query: string, domain: string, limit: number = 5): Promise<string> {
        const client = getSupabase();
        if (!client) return "";

        log(`[memory] Searching for relevant context in domain: ${domain}...`);

        // 1. Semantic Search (Keyword fallback for now, Vector integration next)
        const { data: results } = await client
            .from("hapda_observations")
            .select("content, importance")
            .eq("domain", domain)
            .ilike("content", `%${query}%`)
            .order("importance", { ascending: false })
            .limit(limit);

        if (!results || results.length === 0) return "No relevant previous context found.";

        let context = "[Relevant Memories]\n";
        results.forEach((r, i) => {
            context += `${i + 1}. ${r.content}\n`;
        });

        return context;
    }
}

export async function getDomainContext(domain: AgentDomain): Promise<string> {
  const client = getSupabase();
  if (!client) return "";

  const { data: memory } = await client.from("hapda_memory").select("key, value").eq("domain", domain);
  const { data: knowledge } = await client.from("hapda_knowledge").select("key, content").eq("domain", domain);

  let context = `[Domain Memory: ${domain}]\n`;
  memory?.forEach(m => context += `- ${m.key}: ${m.value}\n`);
  context += `\n[Domain Knowledge: ${domain}]\n`;
  knowledge?.forEach(k => context += `- ${k.key}: ${k.content}\n`);

  return context;
}

export async function emitSignal(source: AgentDomain, target: AgentDomain, event: string, payload: any): Promise<void> {
  const client = getSupabase();
  if (!client) return;
  await client.from("hapda_signals").insert({
    source,
    target,
    event,
    payload,
    created_at: new Date().toISOString()
  });
}

export async function logSession(agent: string, summary: string, raw_output: any = null, meta: any = {}): Promise<void> {
  const client = getSupabase();
  if (!client) return;
  await client.from("hapda_session_logs").insert({
    agent,
    summary,
    raw_output,
    meta,
    created_at: new Date().toISOString(),
  });
}

/**
 * Persists a structured markdown note to the wiki directory.
 */
export async function wikiSave(filename: string, content: string) {
  const wikiDir = path.resolve('./vault/wiki');
  if (!fs.existsSync(wikiDir)) {
    fs.mkdirSync(wikiDir, { recursive: true });
  }

  // Sanitize filename and ensure .md extension
  const cleanFilename = filename.replace(/[^a-z0-9_\-\.]/gi, '_').toLowerCase();
  const safeFilename = cleanFilename.endsWith('.md') ? cleanFilename : `${cleanFilename}.md`;
  const filePath = path.join(wikiDir, safeFilename);

  fs.writeFileSync(filePath, content);
  
  log(`[wiki] Saved note to: ${filePath}`);
  
  // Log the action to session logs
  await logSession("knowledge-librarian", `Saved wiki note: ${safeFilename}`, { path: filePath });

  return { success: true, path: filePath };
}
