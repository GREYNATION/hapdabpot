import fetch from "node-fetch";

export async function getEmbedding(text: string): Promise<number[]> {
  if (!process.env.OPENAI_API_KEY) {
    console.warn("âš ï¸ OPENAI_API_KEY not set - embedding unavailable");
    return [];
  }

  try {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: text
      })
    });

    const data: any = await res.json();
    
    if (data.error) {
      console.error("âŒ OpenAI embedding error:", data.error);
      return [];
    }

    return data.data?.[0]?.embedding || [];
  } catch (error) {
    console.error("âŒ Embedding service failed:", error);
    return [];
  }
}
