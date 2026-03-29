import { createClient } from "@supabase/supabase-js";
import { getEmbedding } from "./embeddingService.js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log(`[MemoryService] Supabase URL: ${supabaseUrl ? '✅ Set' : '❌ Not set'}`);
console.log(`[MemoryService] Supabase Key: ${supabaseKey ? '✅ Set' : '❌ Not set'}`);

const supabase = supabaseUrl && supabaseKey 
  ? createClient(supabaseUrl, supabaseKey)
  : null;

if (supabase) {
  console.log(`[MemoryService] ✅ Supabase client created successfully`);
} else {
  console.log(`[MemoryService] ❌ Supabase client not created - missing URL or key`);
}

export async function saveMemory(
  userId: string,
  agent: string,
  content: string,
  metadata: any = {}
) {
  if (!supabase) {
    console.warn("⚠️ Supabase not configured - memory not saved");
    return;
  }

  try {
    const embedding = await getEmbedding(content);

    const { error } = await supabase.from("memories").insert({
      user_id: userId,
      agent,
      content,
      embedding,
      metadata
    });

    if (error) {
      console.error("❌ Memory save error:", error);
    }
  } catch (error) {
    console.error("❌ Memory save failed:", error);
  }
}

export async function getMemory(userId: string, limit = 5) {
  if (!supabase) {
    console.warn("⚠️ Supabase not configured - returning empty memory");
    return [];
  }

  const { data, error } = await supabase
    .from("memories")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("❌ Memory fetch error:", error);
    return [];
  }

  return data || [];
}

export async function getRelevantMemory(
  userId: string,
  query: string
) {
  if (!supabase) {
    console.warn("⚠️ Supabase not configured - returning empty memory");
    return [];
  }

  try {
    const embedding = await getEmbedding(query);
    
    if (embedding.length === 0) {
      console.warn("⚠️ Embedding generation failed - returning empty memory");
      return [];
    }

    const { data, error } = await supabase.rpc("match_memories", {
      query_embedding: embedding,
      match_count: 5,
      match_threshold: 0.7,
      p_user_id: userId
    });

    if (error) {
      console.error("❌ Memory search error:", error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error("❌ Memory search failed:", error);
    return [];
  }
}