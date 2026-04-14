import Groq from "groq-sdk";
import { BrandProfile } from "./BrandAnalysisAgent.js";
import * as fs from "fs";
import * as path from "path";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export interface GeneratedSite {
  html: string;
  filename: string;
  filepath: string;
  previewUrl?: string;
}

export async function runWebsiteBuilder(
  profile: BrandProfile,
  outputDir: string = "./generated-sites"
): Promise<{ site: GeneratedSite; summary: string }> {
  const featuresHtml = profile.keyFeatures
    .map((f) => `<li>${f}</li>`)
    .join("\n");

  const primaryColor = profile.colorPalette[0] || "#1a1a2e";
  const accentColor = profile.colorPalette[2] || "#e94560";
  const bgColor = profile.colorPalette[1] || "#16213e";

  const prompt = `You are an expert web developer. Generate a complete, stunning single-page HTML website for this brand.

Brand Profile:
- Name: ${profile.businessName}
- Industry: ${profile.industry}
- Audience: ${profile.targetAudience}
- Core Message: ${profile.coreMessage}
- Tone: ${profile.tone}
- Primary Color: ${primaryColor}
- Accent Color: ${accentColor}
- Background: ${bgColor}
- Key Features: ${profile.keyFeatures.join(", ")}
- CTA: ${profile.callToAction}
- Sections: ${profile.pages.join(", ")}

Requirements:
1. Return ONLY the complete HTML file — no explanation, no markdown fences
2. Use inline CSS in a <style> block — no external CDN needed
3. Include smooth scroll, hover effects, and mobile-responsive design
4. Use Google Fonts (loaded via @import)
5. Include a sticky nav, hero with gradient, features grid, and contact form
6. Make it look premium and on-brand
7. Add subtle CSS animations (fade-in, slide-up on scroll with IntersectionObserver)
8. The contact form should just show an alert on submit (no backend needed)
9. Include a footer with copyright

Do NOT include any explanation. Output raw HTML only starting with <!DOCTYPE html>`;

  const response = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "system",
        content:
          "You are an expert frontend developer. Output only raw HTML. No markdown. No explanation. Start directly with <!DOCTYPE html>.",
      },
      { role: "user", content: prompt },
    ],
    temperature: 0.4,
    max_tokens: 6000,
  });

  let html =
    response.choices[0]?.message?.content ||
    buildFallbackHtml(profile, primaryColor, accentColor, bgColor, featuresHtml);

  // Strip any accidental markdown fences
  html = html.replace(/```html?/gi, "").replace(/```/g, "").trim();

  // Ensure it starts with doctype
  if (!html.toLowerCase().startsWith("<!doctype")) {
    const idx = html.toLowerCase().indexOf("<!doctype");
    if (idx > -1) html = html.slice(idx);
  }

  // Save to disk
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const slug = profile.businessName
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
  const filename = `${slug}-${Date.now()}.html`;
  const filepath = path.join(outputDir, filename);
  fs.writeFileSync(filepath, html, "utf-8");

  const site: GeneratedSite = { html, filename, filepath };

  const summary =
    `🌐 *Website Built Successfully!*\n\n` +
    `📄 File: \`${filename}\`\n` +
    `📏 Size: ${(html.length / 1024).toFixed(1)} KB\n` +
    `📋 Sections: ${profile.pages.join(" → ")}\n` +
    `🎨 Theme: ${profile.tone} | ${primaryColor}\n\n` +
    `✅ Ready to deploy to Railway, Vercel, or Netlify.`;

  return { site, summary };
}

function buildFallbackHtml(
  profile: BrandProfile,
  primary: string,
  accent: string,
  bg: string,
  featuresHtml: string
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>${profile.businessName}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Inter:wght@300;400;500&display=swap');
  :root { --primary: ${primary}; --accent: ${accent}; --bg: ${bg}; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Inter',sans-serif; background:var(--bg); color:#fff; }
  nav { position:sticky; top:0; z-index:99; background:rgba(0,0,0,.7); backdrop-filter:blur(12px); padding:1rem 2rem; display:flex; justify-content:space-between; align-items:center; }
  nav .logo { font-family:'Syne',sans-serif; font-size:1.4rem; font-weight:800; color:#fff; }
  .hero { min-height:100vh; display:flex; align-items:center; justify-content:center; text-align:center; padding:4rem 2rem; background:linear-gradient(135deg,var(--primary),var(--bg)); }
  .hero h1 { font-family:'Syne',sans-serif; font-size:clamp(2.5rem,6vw,5rem); font-weight:800; line-height:1.1; margin-bottom:1.5rem; }
  .hero p { font-size:1.2rem; opacity:.8; max-width:600px; margin:0 auto 2.5rem; }
  .cta-btn { background:var(--accent); color:#fff; border:none; padding:1rem 2.5rem; border-radius:50px; font-size:1.1rem; font-weight:600; cursor:pointer; transition:transform .2s,box-shadow .2s; }
  .cta-btn:hover { transform:translateY(-3px); box-shadow:0 10px 30px rgba(0,0,0,.3); }
  .features { padding:6rem 2rem; max-width:1100px; margin:0 auto; }
  .features h2 { font-family:'Syne',sans-serif; font-size:2.5rem; text-align:center; margin-bottom:3rem; }
  .grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(250px,1fr)); gap:2rem; }
  .card { background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.1); border-radius:16px; padding:2rem; transition:transform .2s; }
  .card:hover { transform:translateY(-5px); }
  footer { text-align:center; padding:2rem; opacity:.5; font-size:.9rem; border-top:1px solid rgba(255,255,255,.1); }
</style>
</head>
<body>
<nav><div class="logo">${profile.businessName}</div></nav>
<section class="hero">
  <div>
    <h1>${profile.coreMessage}</h1>
    <p>Serving ${profile.targetAudience} with excellence.</p>
    <button class="cta-btn" onclick="alert('Thanks! We will be in touch.')">${profile.callToAction}</button>
  </div>
</section>
<section class="features">
  <h2>What We Offer</h2>
  <div class="grid">${profile.keyFeatures.map(f => `<div class="card"><h3>${f}</h3></div>`).join('')}</div>
</section>
<footer><p>© ${new Date().getFullYear()} ${profile.businessName}. All rights reserved.</p></footer>
</body>
</html>`;
}
