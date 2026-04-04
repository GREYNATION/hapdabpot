import { log } from "../core/config.js";
import { askAI } from "../core/ai.js";

// ── LTX Video 2.3 via fal.ai ──────────────────────────────────────────────────

async function generateLTXVideo(prompt: string, aspectRatio: "9:16" | "16:9" = "9:16"): Promise<string> {
  const res = await fetch("https://fal.run/fal-ai/ltx-video-v2.3/text-to-video", {
    method: "POST",
    headers: {
      "Authorization": `Key ${process.env.FAL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      negative_prompt: "blurry, low quality, watermark, text overlay",
      num_frames: 121,
      aspect_ratio: aspectRatio,
      num_inference_steps: 30,
      guidance_scale: 3.0,
    }),
  });

  if (!res.ok) throw new Error(`LTX API error: ${res.status} ${await res.text()}`);
  const data = await res.json();

  // Handle async polling
  if (data.request_id) {
    return await pollLTX(data.request_id);
  }

  return data.video?.url || data.url;
}

async function pollLTX(requestId: string): Promise<string> {
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 4000));

    const res = await fetch(`https://fal.run/fal-ai/ltx-video-v2.3/requests/${requestId}/status`, {
      headers: { "Authorization": `Key ${process.env.FAL_API_KEY}` },
    });
    const data = await res.json();

    if (data.status === "COMPLETED") {
      const result = await fetch(`https://fal.run/fal-ai/ltx-video-v2.3/requests/${requestId}`, {
        headers: { "Authorization": `Key ${process.env.FAL_API_KEY}` },
      });
      const final = await result.json();
      return final.video?.url || final.url;
    }

    if (data.status === "FAILED") throw new Error(`LTX failed: ${data.error}`);
    log(`[ContentAgent] Generating video... ${i + 1}/30`);
  }
  throw new Error("LTX Video timed out");
}

// ── Caption generation ────────────────────────────────────────────────────────

async function generateCaption(topic: string, platform: "tiktok" | "instagram" | "youtube"): Promise<string> {
  const rules = {
    tiktok: { tone: "casual, energetic, Gen-Z", tags: 5, cta: "Follow for daily real estate tips 🏠" },
    instagram: { tone: "aspirational, professional", tags: 15, cta: "Save this post 💾 | Link in bio" },
    youtube: { tone: "educational, SEO-optimized", tags: 3, cta: "Subscribe for more wholesale deals 🔔" },
  };

  const r = rules[platform];
  const response = await askAI(
    `Write a ${platform} caption about: "${topic}". Tone: ${r.tone}. Include ${r.tags} hashtags from: #realestatewholesaling #wholesalerealestate #realestateinvesting #cashbuyer #offmarket #rei #entrepreneur #hustle #financialfreedom #southjersey #brooklyn #philadelphia. End with: "${r.cta}". Return only the caption.`,
    "You are a real estate social media strategist."
  );

  return response.content.trim();
}

// ── Social posting ────────────────────────────────────────────────────────────

async function postToTikTok(videoBuffer: Buffer, caption: string): Promise<{ success: boolean; error?: string }> {
  if (!process.env.TIKTOK_ACCESS_TOKEN) return { success: false, error: "TIKTOK_ACCESS_TOKEN not set" };

  try {
    const initRes = await fetch("https://open.tiktokapis.com/v2/post/publish/video/init/", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.TIKTOK_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        post_info: { title: caption.slice(0, 150), privacy_level: "PUBLIC_TO_EVERYONE", disable_duet: false, disable_comment: false, disable_stitch: false },
        source_info: { source: "FILE_UPLOAD", video_size: videoBuffer.length, chunk_size: videoBuffer.length, total_chunk_count: 1 },
      }),
    });

    const init = await initRes.json();
    if (!initRes.ok) throw new Error(init.error?.message);

    await fetch(init.data.upload_url, {
      method: "PUT",
      headers: { "Content-Type": "video/mp4", "Content-Range": `bytes 0-${videoBuffer.length - 1}/${videoBuffer.length}` },
      body: videoBuffer as any,
    });

    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

async function postToInstagram(videoUrl: string, caption: string): Promise<{ success: boolean; error?: string }> {
  if (!process.env.INSTAGRAM_ACCESS_TOKEN || !process.env.INSTAGRAM_ACCOUNT_ID) {
    return { success: false, error: "Instagram env vars not set" };
  }

  try {
    const token = process.env.INSTAGRAM_ACCESS_TOKEN;
    const accountId = process.env.INSTAGRAM_ACCOUNT_ID;

    const containerRes = await fetch(`https://graph.facebook.com/v19.0/${accountId}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ media_type: "REELS", video_url: videoUrl, caption, access_token: token }),
    });

    const container = await containerRes.json();
    if (!containerRes.ok) throw new Error(container.error?.message);

    await new Promise(r => setTimeout(r, 15000)); // wait for processing

    const publishRes = await fetch(`https://graph.facebook.com/v19.0/${accountId}/media_publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creation_id: container.id, access_token: token }),
    });

    const published = await publishRes.json();
    if (!publishRes.ok) throw new Error(published.error?.message);

    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// ── Prompt templates ──────────────────────────────────────────────────────────

const VIDEO_PROMPTS = {
  dealAlert: (address: string, mao: number) =>
    `Cinematic aerial drone shot flying over a suburban neighborhood, zooming into a single family home. Text overlay shows "HOT DEAL: ${address} | MAO: $${mao.toLocaleString()}". Professional real estate video, golden hour lighting, smooth camera movement.`,
  motivational: () =>
    `Time-lapse of a distressed house being renovated into a beautiful home. Before and after transformation. Real estate investment success story. Cinematic quality, inspiring.`,
  wholesale101: () =>
    `Animated explainer showing the wholesale real estate process. House icons, dollar signs, arrows showing deal flow from motivated seller to investor. Clean modern style.`,
};

// ── ContentAgent ──────────────────────────────────────────────────────────────

export class ContentAgent {
  async execute(task: string, userId: string): Promise<string> {
    log(`[ContentAgent] Task: ${task}`);

    // Parse task for video generation
    const lower = task.toLowerCase();

    if (lower.includes("video") || lower.includes("tiktok") || lower.includes("reel") || lower.includes("post")) {
      const topic = task.replace(/make|create|generate|a|video|for|tiktok|instagram|youtube|post|reel/gi, "").trim() || "real estate wholesaling tips";
      return await this.createVideo(topic);
    }

    if (lower.includes("caption") || lower.includes("caption for")) {
      const topic = task.replace(/write|create|caption|for/gi, "").trim();
      const caption = await generateCaption(topic, "tiktok");
      return `📝 Caption:\n\n${caption}`;
    }

    if (lower.includes("ideas") || lower.includes("content ideas")) {
      return await this.suggestTopics();
    }

    // Fallback: general content strategy question
    const response = await askAI(task, "You are a real estate wholesaling content strategist for TikTok, Instagram, and YouTube.");
    return response.content;
  }

  async createVideo(topic: string, dryRun = false): Promise<string> {
    log(`[ContentAgent] Generating video: "${topic}"`);

    if (!process.env.FAL_API_KEY) {
      return `❌ FAL_API_KEY not set. Add it to your .env and Railway vars.\nGet a free key at: fal.ai`;
    }

    // Generate AI video prompt
    const promptRes = await askAI(
      `Write a cinematic LTX Video AI prompt for: "${topic}". Real estate, wealth, hustle aesthetic. Specific camera movements and lighting. Max 150 words. Return only the prompt.`,
      "You are a video director."
    );
    const videoPrompt = promptRes.content.trim();

    // Generate video
    const videoUrl = await generateLTXVideo(videoPrompt, "9:16");
    log(`[ContentAgent] Video ready: ${videoUrl}`);

    if (dryRun) {
      const caption = await generateCaption(topic, "tiktok");
      return `✅ *Video Generated (Preview)*\n\n🎥 ${videoUrl}\n\n📝 *Caption:*\n${caption.slice(0, 300)}...`;
    }

    // Generate captions for all platforms
    const [tiktokCaption, igCaption] = await Promise.all([
      generateCaption(topic, "tiktok"),
      generateCaption(topic, "instagram"),
    ]);

    // Download video buffer
    const videoRes = await fetch(videoUrl);
    const videoBuffer = Buffer.from(await videoRes.arrayBuffer());

    // Post to platforms
    const [tiktok, instagram] = await Promise.all([
      postToTikTok(videoBuffer, tiktokCaption),
      postToInstagram(videoUrl, igCaption),
    ]);

    const results = [
      `${tiktok.success ? "✅" : "❌"} TikTok${tiktok.error ? `: ${tiktok.error}` : ""}`,
      `${instagram.success ? "✅" : "❌"} Instagram${instagram.error ? `: ${instagram.error}` : ""}`,
    ].join("\n");

    return `🎬 *Video Posted*\n\n${results}\n\n🎥 ${videoUrl}\n\n📝 *TikTok Caption:*\n${tiktokCaption.slice(0, 200)}...`;
  }

  async dealAlertVideo(address: string, mao: number): Promise<string> {
    const prompt = VIDEO_PROMPTS.dealAlert(address, mao);
    const videoUrl = await generateLTXVideo(prompt, "9:16");
    const caption = await generateCaption(`Hot deal at ${address} — MAO $${mao.toLocaleString()}`, "tiktok");

    const videoRes = await fetch(videoUrl);
    const videoBuffer = Buffer.from(await videoRes.arrayBuffer());
    await postToTikTok(videoBuffer, caption);

    return videoUrl;
  }

  async suggestTopics(): Promise<string> {
    const response = await askAI(
      "Suggest 5 short-form video topics for a real estate wholesaling brand targeting South Jersey, Brooklyn, and Philadelphia. Numbered list, one per line.",
      "You are a social media strategist."
    );
    return `💡 *Content Ideas*\n\n${response.content}`;
  }
}
