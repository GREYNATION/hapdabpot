import { askAI } from "../ai.js";
import { log } from "../config.js";

/**
 * AI Negotiator (The Closer)
 * Handles autonomous SMS conversations with property owners to reach an agreement.
 */
export async function aiNegotiate(message: string, deal: any): Promise<string> {
    const { address, arv, repairs, max_offer } = deal;
    
    log(`[AI Closer] Negotiating for ${address}. Seller said: "${message}"`);

    const prompt = `
You are a professional real estate investor named "Claw". You are negotiating to buy the property at ${address}.

FEASIBILITY:
- After Repair Value (ARV): $${(arv || 0).toLocaleString()}
- Estimated Repairs: $${(repairs || 0).toLocaleString()}
- **STRICT MAX OFFER: $${(max_offer || 0).toLocaleString()}** (NEVER go above this number).

NEGOTIATION RULES:
1. Be friendly, empathetic, and professional. 
2. Build trust. Sound like a real person, not a robot or a high-pressure salesperson.
3. If they ask for more than your Max Offer, politely explain that based on the repairs and current market, you can't reach that number, but you are a reliable cash buyer.
4. Your goal is to move Toward a FIRM AGREEMENT on price and terms.
5. Keep your responses concise (under 40 words).
6. No emojis, asterisks, or markdown. Just plain text for SMS.

SELLER MESSAGE:
"${message}"

RESPOND TO SELLER:
`;

    try {
        const response = await askAI(prompt, "You are a professional but friendly real estate investor focused on reaching a win-win agreement.");
        return response.content.trim();
    } catch (err: any) {
        log(`[AI Closer] Negotiation Error: ${err.message}`, "error");
        return "I'm interested in your property. Let's talk more about the price soon.";
    }
}
