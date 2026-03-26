// ============================================================
// Supabase Vector Memory
// Stores and retrieves semantic memories using pgvector + OpenAI embeddings
//
// Supabase SQL setup (run once in SQL Editor):
// ─────────────────────────────────────────────
// CREATE EXTENSION IF NOT EXISTS vector;
//
// CREATE TABLE IF NOT EXISTS memories (
//   id        BIGSERIAL PRIMARY KEY,
//   user_id   TEXT NOT NULL,
//   content   TEXT NOT NULL,
//   embedding vector(1536),
//   created_at TIMESTAMPTZ DEFAULT NOW()
// );
//
// CREATE OR REPLACE FUNCTION match_memories(
//   query_embedding vector(1536),
//   match_threshold float,
//   match_count     int,
//   p_user_id       text
// )
// RETURNS TABLE (id bigint, content text, similarity float)
// LANGUAGE sql STABLE AS $$
//   SELECT id, content,
//          1 - (embedding <=> query_embedding) AS similarity
//   FROM   memories
//   WHERE  user_id = p_user_id
//     AND  1 - (embedding <=> query_embedding) > match_threshold
//   ORDER  BY embedding <=> query_embedding
//   LIMIT  match_count;
// $$;
// ============================================================

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { log } from "./config.js";

// ── Lazy singletons ────────────────────────────────────────
let supabase: SupabaseClient | null = null;
let openai: OpenAI | null = null;

function getSupabase(): SupabaseClient {
    if (!supabase) {
        const url = process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_KEY;
        if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_KEY must be set");
        supabase = createClient(url, key);
    }
    return supabase;
}

function getOpenAI(): OpenAI {
    if (!openai) {
        openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
            baseURL: process.env.OPENAI_BASE_URL,
        });
    }
    return openai;
}

// ── Types ──────────────────────────────────────────────────
export interface Memory {
    id: number;
    content: string;
    similarity: number;
}

// ── Embedding ─────────────────────────────────────────────
async function getEmbedding(text: string): Promise<number[]> {
    const res = await getOpenAI().embeddings.create({
        model: "text-embedding-3-small",
        input: text,
    });
    return res.data[0].embedding;
}

// ── Store a new memory (named export for direct use) ──────
export async function storeMemory(userId: string, content: string): Promise<void> {
    return saveMemory(userId, content);
}

async function saveMemory(userId: string, message: string): Promise<void> {
    try {
        const embedding = await getEmbedding(message);
        const { error } = await getSupabase()
            .from("memories")
            .insert({ user_id: userId, content: message, embedding });
        if (error) throw error;
        log(`[memory] ✅ Stored memory for user ${userId}: "${message.slice(0, 60)}..."`);
    } catch (err: any) {
        log(`[memory] ⚠️  Failed to store memory: ${err.message}`, "warn");
    }
}

// ── Retrieve similar memories ─────────────────────────────
export async function getMemories(
    userId: string,
    message: string,
    threshold = 0.75,
    count = 5
): Promise<Memory[]> {
    try {
        const embedding = await getEmbedding(message);
        const { data, error } = await getSupabase().rpc("match_memories", {
            query_embedding: embedding,
            match_threshold: threshold,
            match_count: count,
            p_user_id: userId,
        });
        if (error) throw error;
        return (data ?? []) as Memory[];
    } catch (err: any) {
        log(`[memory] ⚠️  Failed to retrieve memories: ${err.message}`, "warn");
        return [];
    }
}

// ── Full chat() wrapper: memory → prompt → AI → store ────
export async function chat(userId: string, message: string): Promise<string> {
    // 1. Retrieve relevant past memories
    const memories = await getMemories(userId, message);
    const memoryText = memories.map(m => m.content).join("\n");

    // 2. Build prompt with memory context
    const prompt = `You are hapda_bot — a sharp, capable AI assistant.
${
    memoryText
        ? `\nRelevant past memories:\n${memoryText}\n`
        : ""
}
User: ${message}`;

    // 3. Generate response
    const response = await getOpenAI().chat.completions.create({
        model: (process.env.OPENAI_MODEL ?? "gpt-4o-mini"),
        messages: [{ role: "user", content: prompt }],
    });

    const reply = response.choices[0]?.message?.content ?? "I couldn't generate a response.";

    // 4. Save the user's message to memory (non-blocking)
    saveMemory(userId, message).catch(() => {});

    return reply;
}

// ── Check if Supabase is configured ──────────────────────
export function isSupabaseEnabled(): boolean {
    return !!(process.env.SUPABASE_URL && process.env.SUPABASE_KEY);
}
