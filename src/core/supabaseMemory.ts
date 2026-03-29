// ============================================================
// Supabase Vector Memory
// Stores and retrieves semantic memories using pgvector + OpenAI embeddings
//
// Supabase SQL setup (run once in SQL Editor):
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
import { config, log, openai as sharedOpenAI } from "./config.js";
import { getRecentMessages } from "./memory.js";

// â”€â”€ Lazy singletons â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
let supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
    if (!supabase) {
        const url = process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
        if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY must be set");
        supabase = createClient(url, key);
    }
    return supabase;
}

function getOpenAI(): OpenAI {
    // Always use the shared, hardened client from config.ts
    return sharedOpenAI;
}

// â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export interface Memory {
    id: number;
    content: string;
    similarity: number;
}

// â”€â”€ Embedding â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function getEmbedding(text: string): Promise<number[]> {
    const res = await getOpenAI().embeddings.create({
        model: "text-embedding-3-small",
        input: text,
    });
    return res.data[0].embedding;
}

// â”€â”€ Store a new memory (named export for direct use) â”€â”€â”€â”€â”€â”€
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
        log(`[memory] âœ… Stored memory for user ${userId}: "${message.slice(0, 60)}..."`);
    } catch (err: any) {
        log(`[memory] âš ï¸  Failed to store memory: ${err.message}`, "warn");
    }
}

// â”€â”€ Retrieve similar memories â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
        log(`[memory] âš ï¸  Failed to retrieve memories: ${err.message}`, "warn");
        return [];
    }
}

// â”€â”€ Full chat() wrapper: memory â†’ prompt â†’ AI â†’ store â”€â”€â”€â”€
export async function chat(userId: string, message: string, chatId?: number): Promise<string> {
    try {
        // 1. Retrieve relevant past vector memories (long-term)
        const memories = await getMemories(userId, message);
        const memoryText = memories.map(m => m.content).join("\n");

        // 2. Load the last 10 messages from SQL (short-term)
        const history = chatId ? getRecentMessages(chatId, 10) : [];

        // 3. Build messages array
        const systemPrompt = `You are hapdabot. You have persistent memory of past conversations with this user. You are an advanced AI Trading Assistant and wholesale real estate agent.
${memoryText ? `\nRelevant past memories from long-term storage:\n${memoryText}\n` : ""}`;

        const messages = [
            { role: "system", content: systemPrompt },
            ...history.map(m => ({ role: m.role, content: m.content })),
            { role: "user", content: message }
        ];

        // 4. Generate response
        const response = await getOpenAI().chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: messages as any[],
        });

        const reply = response.choices[0]?.message?.content ?? "I couldn't generate a response.";

        // 5. Save the user's message to vector memory (non-blocking)
        saveMemory(userId, message).catch(() => {});

        return reply;
    } catch (err: any) {
        log(`[error] Supabase Chat failed: ${err.message}`, "error");
        if (err.status === 401 || err.message.includes("401") || err.message.includes("unauthorized")) {
            return "âš ï¸ AI service temporarily unavailable. Try again in a moment.";
        }
        return "I encountered an error. Please try again later.";
    }
}

// â”€â”€ Check if Supabase is configured â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function isSupabaseEnabled(): boolean {
    return !!(process.env.SUPABASE_URL && (process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY));
}

