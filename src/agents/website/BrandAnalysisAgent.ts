import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export interface BrandProfile {
  businessName: string;
  industry: string;
  targetAudience: string;
  coreMessage: string;
  tone: string;
  colorPalette: string[];
  keyFeatures: string[];
  callToAction: string;
  pages: string[];
}

export async function runBrandAnalysis(
  userPrompt: string
): Promise<{ profile: BrandProfile; summary: string }> {
  const response = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "system",
        content: `You are a brand strategist. Analyze the business description and return ONLY valid JSON — no markdown, no explanation.
Return this exact shape:
{
  "businessName": string,
  "industry": string,
  "targetAudience": string,
  "coreMessage": string,
  "tone": string (e.g. "professional", "bold", "warm", "luxury"),
  "colorPalette": string[] (3 hex colors that match the brand),
  "keyFeatures": string[] (3-5 bullet points about what the business offers),
  "callToAction": string (primary CTA text, e.g. "Get a Free Offer"),
  "pages": string[] (list of page sections: ["hero", "about", "services", "contact"])
}`,
      },
      {
        role: "user",
        content: `Analyze this business and create a brand profile:\n${userPrompt}`,
      },
    ],
    temperature: 0.3,
  });

  const raw = response.choices[0]?.message?.content || "{}";
  let profile: BrandProfile;

  try {
    profile = JSON.parse(raw);
  } catch {
    profile = {
      businessName: "My Business",
      industry: "Real Estate",
      targetAudience: "Homeowners & Investors",
      coreMessage: "Fast, fair cash offers on any property.",
      tone: "professional",
      colorPalette: ["#1a1a2e", "#16213e", "#e94560"],
      keyFeatures: ["Fast closings", "No repairs needed", "Cash offers"],
      callToAction: "Get Your Free Offer",
      pages: ["hero", "about", "services", "testimonials", "contact"],
    };
  }

  const summary =
    `✅ *Brand Analysis Complete*\n\n` +
    `🏢 *${profile.businessName}*\n` +
    `📌 Industry: ${profile.industry}\n` +
    `🎯 Audience: ${profile.targetAudience}\n` +
    `💬 Tone: ${profile.tone}\n` +
    `🎨 Colors: ${profile.colorPalette.join(", ")}\n` +
    `📋 Sections: ${profile.pages.join(" → ")}`;

  return { profile, summary };
}
