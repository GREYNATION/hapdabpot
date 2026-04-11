import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { getEmbedding } from "./embeddingService.js";
import dotenv from "dotenv";

dotenv.config();

export interface Credential {
  key: string;
  value: string;
  service?: string;
  metadata?: any;
}

export class MemoryManager {
  private supabase: SupabaseClient;

  constructor() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
    }

    this.supabase = createClient(url, key);
  }

  /**
   * CREDENTIALS
   */

  async setCredential(cred: Credential) {
    const { data, error } = await this.supabase
      .from("credentials")
      .upsert(cred, { onConflict: "key" });

    if (error) throw error;
    return data;
  }

  async getCredential(key: string): Promise<string | null> {
    const { data, error } = await this.supabase
      .from("credentials")
      .select("value")
      .eq("key", key)
      .maybeSingle();

    if (error) {
      console.error(`[MemoryManager] Error fetching credential ${key}:`, error);
      return null;
    }
    return data?.value || null;
  }

  /**
   * MEMORIES (Vector)
   */

  async saveMemory(userId: string, agent: string, content: string, metadata: any = {}) {
    try {
      const embedding = await getEmbedding(content);

      const { error } = await this.supabase.from("memories").insert({
        user_id: userId,
        agent,
        content,
        embedding,
        metadata
      });

      if (error) throw error;
    } catch (error) {
      console.error("[MemoryManager] Save memory failed:", error);
      throw error;
    }
  }

  async getRecentMemories(userId: string, limit = 5) {
    const { data, error } = await this.supabase
      .from("memories")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  }

  async getRelevantMemory(userId: string, query: string, limit = 5) {
    try {
      const embedding = await getEmbedding(query);
      
      const { data, error } = await this.supabase.rpc("match_memories", {
        query_embedding: embedding,
        match_count: limit,
        match_threshold: 0.7,
        p_user_id: userId
      });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("[MemoryManager] Search memory failed:", error);
      return [];
    }
  }
}

// Export singleton instance
export const memoryManager = new MemoryManager();
