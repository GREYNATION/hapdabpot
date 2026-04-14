import { createClient, SupabaseClient } from "@supabase/supabase-js";
import "dotenv/config";

let _supabase: SupabaseClient | null = null;

/**
 * Fetches or initializes the master Supabase client.
 * This client is shared across all agents and the central brain.
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
