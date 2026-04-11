import { callAI, systemMsg, userMsg, AIMessage, AITool, parseToolArgs } from "../../core/ai.js";
import {
  writeAgentMemory,
  readAgentMemory,
  writeKnowledge,
  getDomainContext,
  logSession,
  emitSignal,
} from "../../core/memory.js";

const DRAMA_SYSTEM_PROMPT = `You are the Drama Production Agent for Hap.
Specialties: 30s-3min TikTok 3D mini-drama scripts, scroll-stopping hooks.
Commands: /GHOST, /SCENE, /HOOK, /SERIES, /BRIEF, /CAST.`;

const DRAMA_TOOLS: AITool[] = [
  {
    type: "function",
    function: {
      name: "save_script",
      description: "Save a completed script or scene to memory",
      parameters: {
        type: "object",
        properties: {
          episode_title: { type: "string", description: "The title of the episode" },
          episode_number: { type: "string", description: "The number of the episode in the series" },
          content: { type: "string", description: "The full script content" },
        },
        required: ["episode_title", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_visual_prompt",
      description: "Generate a 3D prompt for OpenArt Worlds",
      parameters: {
        type: "object",
        properties: {
          subject: { type: "string", description: "The main subject of the visual" },
          style: { type: "string", description: "The artistic style (e.g. 3D Render, Pixar)" },
        },
        required: ["subject", "style"],
      },
    },
  },
];

async function handleToolCall(name: string, args: any): Promise<string> {
  switch (name) {
    case "save_script":
      await writeAgentMemory("drama", `script_${args.episode_number || Date.now()}`, JSON.stringify(args));
      return `✅ Script saved: ${args.episode_title}`;
    case "generate_visual_prompt":
      return `[3D VISUAL PROMPT] Subject: ${args.subject}, Style: ${args.style}`;
    default:
      return `Unknown tool: ${name}`;
  }
}

export async function handle(message: string, _userId: string | number): Promise<string> {
  const context = await getDomainContext("drama");
  const messages: AIMessage[] = [
    systemMsg(DRAMA_SYSTEM_PROMPT + (context ? `\n\nContext:\n${context}` : "")),
    userMsg(message),
  ];

  const response = await callAI(messages, "drama", DRAMA_TOOLS);

  const calls = response.tool_calls || response.toolCalls;
  let finalResponse = response.content;
  if (calls) {
    for (const tc of calls) {
      const result = await handleToolCall(tc.function.name, parseToolArgs(tc));
      finalResponse += `\n\n${result}`;
    }
  }

  await logSession("drama", `Drama request: ${message.slice(0, 50)}`, finalResponse);
  return finalResponse || "🎬 Scene generated.";
}
