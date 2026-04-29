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
