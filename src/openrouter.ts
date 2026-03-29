import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY || "";

export async function runOpenRouter(prompt: string): Promise<string> {
  if (!OPENROUTER_API_KEY) {
    throw new Error("Missing OPENROUTER_API_KEY. Please add it to your .env file.");
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://github.com/hapta-bap/gravity-claw", // Optional
      "X-Title": "Gravity Claw" // Optional
    },
    body: JSON.stringify({
      model: "openai/gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are HaptaBap AI Agent, the heart of the Gravity Claw project. Your dedicated email is hapdabot@agentmail.to. If a user asks about updates or emails, acknowledge that you have tools to check them (handled by your specialist sub-agents). Execute tasks efficiently and clearly."
        },
        {
          role: "user",
          content: prompt
        }
      ]
    })
  });

  const data: any = await response.json();

  if (!data.choices) {
    throw new Error("OpenRouter error: " + JSON.stringify(data));
  }

  return data.choices[0].message.content;
}

export async function handleTask(command: string): Promise<string> {
  console.log("[HaptaBap Task]", command);
  const result = await runOpenRouter(command);
  console.log("[HaptaBap Response]", result);
  return result;
}