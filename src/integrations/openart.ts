// integrations/openart.ts — OpenArt Worlds API
// Replaces: ~/antigravity_scripts/openart_worlds.py
// Used by DramaAgent for 3D environment generation

export interface OpenArtGenerationRequest {
  prompt: string;
  negative_prompt?: string;
  width?: number;
  height?: number;
  num_images?: number;
  style?: "3d_cinematic" | "anime" | "hyper_real" | "cartoon" | "photorealistic";
}

export interface OpenArtGenerationResult {
  success: boolean;
  image_urls?: string[];
  error?: string;
  prompt_used: string;
}

// ─── OpenArt Worlds API ───────────────────────────────────────────────────────

export async function generateEnvironment(
  req: OpenArtGenerationRequest
): Promise<OpenArtGenerationResult> {
  const apiKey = process.env.OPENART_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      error: "OPENART_API_KEY not set in Railway environment variables",
      prompt_used: req.prompt,
    };
  }

  // Map style to OpenArt Worlds style tag
  const styleMap: Record<string, string> = {
    "3d_cinematic": "3D Cinematic",
    anime: "Anime",
    hyper_real: "Hyper Realistic",
    cartoon: "Cartoon",
    photorealistic: "Photorealistic",
  };
  const styleTag = styleMap[req.style ?? "3d_cinematic"];

  const fullPrompt = `${req.prompt}, ${styleTag}, high detail, dramatic lighting, 16:9 aspect ratio`;

  try {
    const response = await fetch("https://openart.ai/api/v1/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        prompt: fullPrompt,
        negative_prompt:
          req.negative_prompt ??
          "blur, low quality, watermark, text, cropped, deformed",
        width: req.width ?? 1280,
        height: req.height ?? 720,
        num_images: req.num_images ?? 1,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return {
        success: false,
        error: `OpenArt API error ${response.status}: ${err}`,
        prompt_used: fullPrompt,
      };
    }

    const data = await response.json();
    const imageUrls: string[] = data.images ?? data.urls ?? [];

    return {
      success: true,
      image_urls: imageUrls,
      prompt_used: fullPrompt,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
      prompt_used: fullPrompt,
    };
  }
}

// ─── ElevenLabs TTS ───────────────────────────────────────────────────────────

export interface TTSRequest {
  text: string;
  voice_id?: string; // ElevenLabs voice ID
  model?: "eleven_multilingual_v2" | "eleven_monolingual_v1";
}

export interface TTSResult {
  success: boolean;
  audio_base64?: string;
  error?: string;
}

export async function generateVoice(req: TTSRequest): Promise<TTSResult> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      error: "ELEVENLABS_API_KEY not set in Railway environment variables",
    };
  }

  const voiceId = req.voice_id ?? "21m00Tcm4TlvDq8ikWAM"; // Default: Rachel
  const model = req.model ?? "eleven_multilingual_v2";

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": apiKey,
        },
        body: JSON.stringify({
          text: req.text,
          model_id: model,
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      return {
        success: false,
        error: `ElevenLabs error ${response.status}: ${err}`,
      };
    }

    const audioBuffer = await response.arrayBuffer();
    const audioBase64 = Buffer.from(audioBuffer).toString("base64");

    return { success: true, audio_base64: audioBase64 };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ─── Magic Hour Lip Sync ──────────────────────────────────────────────────────

export interface LipSyncRequest {
  video_url: string;
  audio_base64: string;
}

export interface LipSyncResult {
  success: boolean;
  job_id?: string;
  output_url?: string;
  error?: string;
}

export async function lipSync(req: LipSyncRequest): Promise<LipSyncResult> {
  const apiKey = process.env.MAGIC_HOUR_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      error: "MAGIC_HOUR_API_KEY not set in Railway environment variables",
    };
  }

  try {
    const response = await fetch("https://api.magichour.ai/v1/lip-sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        video_url: req.video_url,
        audio: req.audio_base64,
        output_format: "mp4",
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return {
        success: false,
        error: `Magic Hour error ${response.status}: ${err}`,
      };
    }

    const data = await response.json();
    return {
      success: true,
      job_id: data.job_id,
      output_url: data.output_url,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ─── Production Pipeline Helper ───────────────────────────────────────────────
// Chains: Script → TTS → [manual video step] → Lip Sync
// Returns a production brief with all assets

export async function runProductionPipeline(
  scriptLines: { character: string; dialogue: string }[],
  sceneDescription: string
): Promise<{
  scene_image?: OpenArtGenerationResult;
  audio_clips: TTSResult[];
  production_notes: string;
}> {
  // 1. Generate scene environment
  const sceneImage = await generateEnvironment({
    prompt: sceneDescription,
    style: "3d_cinematic",
  });

  // 2. Generate voice for each line
  const audioClips: TTSResult[] = [];
  for (const line of scriptLines) {
    const tts = await generateVoice({ text: line.dialogue });
    audioClips.push(tts);
  }

  const successCount = audioClips.filter((a) => a.success).length;

  return {
    scene_image: sceneImage,
    audio_clips: audioClips,
    production_notes: [
      `Scene render: ${sceneImage.success ? "✅" : "❌ " + sceneImage.error}`,
      `Voice lines: ${successCount}/${scriptLines.length} generated`,
      `Next step: Export video from OpenArt, then run lip sync via Magic Hour`,
      `Prompt used: ${sceneImage.prompt_used}`,
    ].join("\n"),
  };
}
