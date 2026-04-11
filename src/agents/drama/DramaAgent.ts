// agents/drama/DramaAgent.ts
// TikTok 3D Mini-Drama Production Agent
// Net-new agent — does NOT touch existing RE or Trading code

import { callAI, systemMsg, userMsg, AIMessage, AITool, parseToolArgs } from "../../core/ai.js";
import {
  writeAgentMemory,
  readAgentMemory,
  writeKnowledge,
  getDomainContext,
  logSession,
  emitSignal,
} from "../../core/memory.js";

// ─── System Prompt ────────────────────────────────────────────────────────────

const DRAMA_SYSTEM_PROMPT = `You are the hapda_bot Drama Production Agent — a creative director and screenwriter for Hap Hustlehard's TikTok 3D mini-drama series.

Your specialties:
- Writing punchy, engaging short-form scripts (30s–3min episodes)
- 3D character direction and scene blocking
- TikTok hook writing (first 3 seconds MUST stop the scroll)
- Story arc planning across episode series
- Brand-safe content that drives profile growth

Production stack:
- OpenArt Worlds: 3D environment generation
- Tripo AI / Midjourney: Character generation  
- ElevenLabs: Voice synthesis (Text-to-Speech)
- Magic Hour AI: Lip-syncing
- CapCut Pro: Final assembly

Commands you understand:
/GHOST - Write in a specific character's voice
/SCENE - Generate a full scene breakdown
/HOOK - Write TikTok opening hooks
/SERIES - Plan a multi-episode arc
/BRIEF - Production brief for a single episode
/CAST - Describe characters with visual prompts

Always format scripts with: SCENE, CHARACTER, DIALOGUE, DIRECTION, VISUAL PROMPT blocks.`;

// ─── Tools ────────────────────────────────────────────────────────────────────

const DRAMA_TOOLS: AITool[] = [
  {
    type: "function",
    function: {
      name: "save_script",
      description: "Save a completed script or scene to memory",
      parameters: {
        type: "object",
        properties: {
          episode_title: { type: "string", description: "Episode title" },
          episode_number: { type: "string", description: "Episode number e.g. S01E03" },
          content: { type: "string", description: "Full script content" },
        },
        required: ["episode_title", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_series_bible",
      description: "Retrieve the series bible and existing episode history",
      parameters: {
        type: "object",
        properties: {
          series_name: { type: "string", description: "Name of the series" },
        },
        required: ["series_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_visual_prompt",
      description:
        "Generate an image/3D prompt for OpenArt Worlds or Midjourney",
      parameters: {
        type: "object",
        properties: {
          subject: {
            type: "string",
            description: "What to generate (character, scene, prop)",
          },
          style: {
            type: "string",
            description: "Visual style e.g. 3D cinematic, anime, hyper-real",
          },
          scene_context: {
            type: "string",
            description: "Scene description for context",
          },
        },
        required: ["subject", "style"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "log_production_idea",
      description: "Save a quick production idea or concept for later",
      parameters: {
        type: "object",
        properties: {
          idea: { type: "string", description: "The idea to save" },
          category: {
            type: "string",
            description: "Category: plot, character, visual, hook, music",
          },
        },
        required: ["idea"],
      },
    },
  },
];

// ─── Tool Handlers ────────────────────────────────────────────────────────────

async function handleToolCall(
  name: string,
  args: any
): Promise<string> {
  switch (name) {
    case "save_script": {
      const key = `script_${args.episode_number ?? Date.now()}`;
      await writeAgentMemory("drama", key, JSON.stringify(args));
      await writeKnowledge(
        "drama",
        `episode_${args.episode_number ?? "draft"}`,
        args.content as string,
        "DramaAgent"
      );
      return `✅ Script saved: ${args.episode_title}`;
    }

    case "get_series_bible": {
      const bible = await readAgentMemory(
        "drama",
        `series_bible_${args.series_name}`
      );
      const episodes = await getDomainContext("drama");
      return bible
        ? `📖 Series Bible:\n${bible}\n\nEpisode History:\n${episodes}`
        : `No series bible found for "${args.series_name}". Create one with /SERIES.`;
    }

    case "generate_visual_prompt": {
      const prompt = `[3D VISUAL PROMPT]
Subject: ${args.subject}
Style: ${args.style}
Context: ${args.scene_context ?? "standalone"}
Platform: OpenArt Worlds / Midjourney
Format: 16:9 cinematic, high detail, dramatic lighting
Negative: blur, low quality, watermark, text`;
      return prompt;
    }

    case "log_production_idea": {
      const ideasRaw = await readAgentMemory("drama", "production_ideas");
      const ideas = JSON.parse(ideasRaw ?? "[]") as any[];
      ideas.push({
        idea: args.idea,
        category: args.category ?? "general",
        ts: new Date().toISOString(),
      });
      await writeAgentMemory("drama", "production_ideas", JSON.stringify(ideas));
      return `💡 Idea logged under "${args.category ?? "general"}"`;
    }

    default:
      return `Unknown tool: ${name}`;
  }
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

export async function handle(message: string, _userId: string | number): Promise<string> {
  console.log(`[DramaAgent] Processing: "${message.slice(0, 60)}"`);

  // Load existing drama context
  const context = await getDomainContext("drama");

  const messages: AIMessage[] = [
    systemMsg(
      DRAMA_SYSTEM_PROMPT +
        (context ? `\n\n## Existing Production Context:\n${context}` : "")
    ),
    userMsg(message),
  ];

  const response = await callAI(messages, "drama", DRAMA_TOOLS);

  // Handle tool calls
  let finalResponse = response.content;
  if (response.toolCalls && response.toolCalls.length > 0) {
    const toolResults: string[] = [];
    for (const tc of response.toolCalls) {
      console.log(`[DramaAgent] Tool call: ${tc.function.name}`);
      const args = parseToolArgs(tc);
      const result = await handleToolCall(tc.function.name, args);
      toolResults.push(`[${tc.function.name}] ${result}`);
    }

    // If there was tool content + text, combine them
    if (toolResults.length > 0 && !finalResponse) {
      finalResponse = toolResults.join("\n");
    } else if (toolResults.length > 0) {
      finalResponse = `${finalResponse}\n\n${toolResults.join("\n")}`;
    }
  }

  // Emit signal if a new episode was completed
  if (
    message.toLowerCase().includes("/brief") ||
    message.toLowerCase().includes("episode")
  ) {
    await emitSignal("drama", "all", "new_episode_ready", {
      summary: message.slice(0, 100),
      ts: new Date().toISOString(),
    });
  }

  await logSession(
    "drama",
    `Drama request: ${message.slice(0, 80)}`,
    finalResponse
  );

  return finalResponse || "🎬 Script generated. Use /BRIEF for full production breakdown.";
}
