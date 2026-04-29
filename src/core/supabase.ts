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
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const anonKey = process.env.SUPABASE_ANON_KEY;

    if (!url) {
      console.log("[supabase] âš ï¸ CRITICAL: SUPABASE_URL is missing in environment.");
      return null;
    }

    const key = serviceKey || anonKey;

    if (!key) {
      console.log("[supabase] âš ï¸ CRITICAL: Both SUPABASE_SERVICE_ROLE_KEY and SUPABASE_ANON_KEY are missing.");
      return null;
    }

    if (serviceKey) {
      console.log("[supabase] âœ… Initializing with SERVICE_ROLE access.");
    } else {
      console.log("[supabase] â„¹ï¸ Initializing with ANON/PUBLIC access.");
    }

    _supabase = createClient(url, key);
  }
  return _supabase;
}
