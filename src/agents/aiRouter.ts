import fetch from "node-fetch";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export async function aiRoute(task: string) {
  if (!process.env.OPENROUTER_API_KEY) {
    console.warn("⚠️ OPENROUTER_API_KEY not set - AI routing unavailable");
    return null;
  }

  try {
    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `
You are an AI router.

Available agents:
- TraderAgent (trading, forex, stocks, crypto)
- RealEstateAgent (properties, houses, deals)
- ContentAgent (TikTok, social media, content creation)

Respond ONLY with the agent name.
`
          },
          {
            role: "user",
            content: task
          }
        ]
      })
    });

    const data: any = await res.json();
    
    if (data.error) {
      console.error("❌ OpenRouter error:", data.error);
      return null;
    }

    return data.choices?.[0]?.message?.content?.trim();
  } catch (error) {
    console.error("❌ AI router failed:", error);
    return null;
  }
}