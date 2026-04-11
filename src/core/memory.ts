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

    db.exec(`
        CREATE TABLE IF NOT EXISTS background_queue (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chat_id INTEGER NOT NULL,
            user_text TEXT,
            visual_context TEXT,
            status TEXT DEFAULT 'pending', 
            retry_count INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

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
