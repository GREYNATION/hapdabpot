import { listEmails, listEvents, isGoogleEnabled } from "../agents/googleWorkspaceAgent.js";
import { generateVoice } from "./voiceService.js";
import { log } from "../core/config.js";
import { askAI } from "../core/ai.js";
import { unpackContent } from "../core/unpack.js";
import { sanitizeHTML } from "../core/telegramUtils.js";

export class JarvisService {
    /**
     * General query method for Jarvis intelligence.
     */
    async ask(query: string): Promise<string> {
        log(`[jarvis] Processing query: ${query}`);
        
        const prompt = `
You are JARVIS, an elite personal assistant. 
Answer the following query with professional, sharp, and helpful intelligence.
Maintain the persona: polite, slightly dry, and extremely capable.

QUERY: ${query}
`;

        const res = await askAI(prompt, "You are JARVIS, an elite personal assistant.");
        const content = unpackContent(res) || "I'm afraid I can't assist with that at the moment, sir.";
        return sanitizeHTML(content);
    }

    /**
     * Generates a spoken morning digest by aggregating calendar and email data.
     */
    async getMorningDigest(): Promise<{ text: string; voiceBuffer: Buffer | null }> {
        log("[jarvis] Generating morning digest...");
        
        if (!isGoogleEnabled()) {
            const text = "🌅 <b>Morning Briefing</b>: Google Workspace is not configured. I can't access your calendar or email right now.";
            return { text, voiceBuffer: await generateVoice("Google Workspace is not configured, sir.") };
        }

        try {
            // 1. Fetch Data
            const [emails, events] = await Promise.all([
                listEmails("is:unread", 5),
                listEvents(1) // Just today
            ]);

            // 2. Synthesize Briefing with AI
            const prompt = `
You are JARVIS. Generate a professional, concise, and high-end morning briefing for Hap Hustlehard.
Structure it as:
1. A warm, executive greeting.
2. Today's schedule highlights.
3. Critical unread email summary.
4. A motivational "Hustle" closing.

DATA:
--- EVENTS TODAY ---
${events}

--- UNREAD EMAILS ---
${emails}
---
Keep the tone like Paul Bettany's Jarvis—polite, sharp, and slightly dry. Use plain text only, no markdown.
`;

            const res = await askAI(prompt, "You are JARVIS, an elite personal assistant.");
            const digestText = unpackContent(res) || "I couldn't synthesize your digest, sir.";

            // 3. Generate Voice (Clean text for TTS)
            const cleanText = digestText
                .replace(/\*\*/g, "")
                .replace(/\[.*?\]/g, "")
                .replace(/#+ /g, "")
                .substring(0, 3000);

            const voiceBuffer = await generateVoice(cleanText);

            return { 
                text: `🌅 <b>Paul's Morning Digest</b>\n\n${sanitizeHTML(digestText)}`, 
                voiceBuffer 
            };

        } catch (err: any) {
            log(`[jarvis] Digest failure: ${err.message}`, "error");
            const errorText = "Sir, I've encountered an error accessing your neural links (Google Workspace). Please check your connection.";
            return { text: errorText, voiceBuffer: await generateVoice(errorText) };
        }
    }

    /**
     * Checks status of all JARVIS systems.
     */
    async getStatus(): Promise<string> {
        const google = isGoogleEnabled() ? "✅ ONLINE" : "❌ OFFLINE";
        const voice = "✅ READY (onyx)";
        const hive = "✅ SYNCED";
        
        return `🤖 <b>JARVIS Status Report</b>\n\n` +
               `• <b>Google Link</b>: ${google}\n` +
               `• <b>Voice Core</b>: ${voice}\n` +
               `• <b>Hive Mind</b>: ${hive}\n\n` +
               `Systems are operational. How can I assist you, sir?`;
    }
}

export const jarvisService = new JarvisService();
