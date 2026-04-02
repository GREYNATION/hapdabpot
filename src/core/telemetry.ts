import { getSupabase } from "./supabaseMemory.js";
import { log } from "./config.js";

export async function logEvent(event: any) {
    try {
        const supabase = getSupabase();
        await supabase.from("bot_events").insert({
            type: event.type,
            source: event.source,
            message: event.message,
            data: event.data || {},
            created_at: new Date()
        });
    } catch (e: any) {
        log(`[telemetry] Failed to log bot event: ${e.message}`, "error");
    }
}
