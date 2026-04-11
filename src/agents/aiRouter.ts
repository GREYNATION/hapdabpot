import fetch from "node-fetch";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

export async function aiRoute(task: string) {
  if (!process.env.GROQ_API_KEY) {
    console.warn("⚠️  GROQ_API_KEY not set - AI routing unavailable");
    return null;
  }

  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: `
You are an AI router.

Available agents:
- TraderAgent (trading, forex, stocks, crypto)
- RealEstateAgent (properties, houses, deals)
- ContentAgent (TikTok, social media, content creation)
- DramaAgent (TikTok 3D mini-drama scripts, character direction, scene blocking)

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
      console.error("❌ Groq error:", data.error);
      return null;
    }

    return data.choices?.[0]?.message?.content?.trim();
  } catch (error) {
    console.error("❌ AI router failed:", error);
    return null;
  }
}
