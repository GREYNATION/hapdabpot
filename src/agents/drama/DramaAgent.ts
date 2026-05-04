// src/agents/drama/DramaAgent.ts
// GILDED CLAWS — DramaAgent for hapdabot / gravity-claw
// GREYNATION / Hapdabot Productions

import { askAI } from "../../core/ai.js";
import { log } from "../../core/config.js";
import { produceDynamicEpisode } from "../cinema/CinemaAgent.js";

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

export interface EpisodeScript {
  season: number;
  episode: number;
  title: string;
  scenes: Scene[];
  muapiPrompts: MuapiPrompt[];
  subtitles: Subtitle[];
  tiktokHook: string;
}

export interface Scene {
  id: number;
  location: string;
  characters: string[];
  dialogue: DialogueLine[];
  voiceover?: string;
}

export interface DialogueLine {
  character: string;
  line: string;
  emotion: string;
}

export interface MuapiPrompt {
  character: string;
  emotion: string;
  outfit: string;
  background: string;
  fullPrompt: string;
}

export interface Subtitle {
  text: string;
  startMs: number;
  endMs: number;
}

export interface DramaAgentConfig {
  series: string;
  season: number;
  episodeCount: number;
  genre: string;
  setting: string;
  characters: CharacterProfile[];
}

export interface CharacterProfile {
  name: string;
  species: string;
  role: "lead" | "antagonist" | "support" | "villain";
  basePrompt: string;
}

// ─────────────────────────────────────────────
// SERIES CONFIG — GILDED CLAWS
// ─────────────────────────────────────────────

export const GILDED_CLAWS_CONFIG: DramaAgentConfig = {
  series: "Gilded Claws",
  season: 3,
  episodeCount: 60,
  genre: "Romance & Deception",
  setting: "Wealthy Elite Society — Elitewood",
  characters: [
    {
      name: "Luna Vale",
      species: "White arctic fox, curly golden hair, warm brown eyes",
      role: "lead",
      basePrompt:
        "3D animated white arctic fox female character, curly voluminous golden blonde hair, large warm brown expressive eyes, long lashes, small dark nose, elegant neck, soft white fur, slim figure",
    },
    {
      name: "Roman Blackmane",
      species: "Dark charcoal grey wolf, silver-streaked fur, steel-blue eyes",
      role: "lead",
      basePrompt:
        "3D animated dark charcoal grey wolf male character, sharp angular jaw, silver-streaked dark fur, piercing steel-blue eyes, tall imposing frame, perfectly groomed, commanding presence",
    },
    {
      name: "Eli Blackmane",
      species: "Wolf-fox hybrid, lighter grey fur, amber fox eyes",
      role: "support",
      basePrompt:
        "3D animated wolf-fox hybrid male, lighter grey fur with subtle warm undertones, fox-shaped amber eyes unusual in a wolf face, young 20s, rugged working-class clothing transitioning to fitted suit, conflicted expression",
    },
    {
      name: "Victor Blackmane",
      species: "Black panther with human face, silver slicked hair",
      role: "villain",
      basePrompt:
        "3D animated black panther male character with an unsettlingly realistic human face, silver hair perfectly slicked back, sharp cheekbones, thin cruel smile that never reaches his small pale eyes, immaculate dark suit",
    },
    {
      name: "Dame Elara Blackmane",
      species: "Elderly lioness, silver-white mane, amber eyes",
      role: "support",
      basePrompt:
        "3D animated elderly lioness female character, silver-white mane styled in an elegant updo, deep amber knowing eyes, dignified wrinkles, regal posture, graceful aged beauty, pearls always present",
    },
  ],
};

const GLOBAL_STYLE_SUFFIX =
  "Pixar-style 3D animation render, photorealistic fur and skin texture, expressive cinematic face, vertical 9:16 format, dramatic rim lighting, shallow depth of field bokeh background, luxury aesthetic, ultra-high detail, emotional storytelling composition";

// ─────────────────────────────────────────────
// DRAMA AGENT CLASS
// ─────────────────────────────────────────────

export class DramaAgent {
  private config: DramaAgentConfig;

  constructor(config: DramaAgentConfig = GILDED_CLAWS_CONFIG) {
    this.config = config;
  }

  // ── Generate a single episode script ──────────────────────────────────────

  async generateEpisode(
    episodeNumber: number,
    context?: string
  ): Promise<EpisodeScript> {
    const prompt = this.buildEpisodePrompt(episodeNumber, context);

    const response = await askAI(prompt, "You are a lead screenwriter for Gilded Claws.", {
      model: "claude-3-5-sonnet-20241022",
      temperature: 0.8
    });

    return this.parseEpisodeResponse(response.content, episodeNumber);
  }

  // ── Generate a batch of episodes ──────────────────────────────────────────

  async generateEpisodeBatch(
    startEp: number,
    endEp: number,
    context?: string
  ): Promise<EpisodeScript[]> {
    const episodes: EpisodeScript[] = [];
    for (let ep = startEp; ep <= endEp; ep++) {
      log(`[DramaAgent] Generating S${this.config.season}E${ep}...`);
      const episode = await this.generateEpisode(ep, context);
      episodes.push(episode);
    }
    return episodes;
  }

  // ── Generate Muapi Visual Prompts ─────────────────────────────────────────

  async generateMuapiPrompts(
    episodeNumber: number,
    sceneSummary: string
  ): Promise<MuapiPrompt[]> {
    const prompt = `Generate 3 distinct visual prompt cards for Muapi.ai based on this scene: "${sceneSummary}"
Series: ${this.config.series}
Characters available: ${this.config.characters.map((c) => c.name).join(", ")}

For each prompt, specify:
CHARACTER: [Name]
EMOTION: [Specific facial expression]
OUTFIT: [Detailed clothing]
BACKGROUND: [The setting detail]

Follow the character profiles and style suffix: ${GLOBAL_STYLE_SUFFIX}`;

    const response = await askAI(prompt, "You are a lead visual engineer and prompt expert for Muapi.ai.", {
      model: "claude-3-5-sonnet-20241022",
      temperature: 0.7
    });

    return this.parseMuapiPrompts(response.content);
  }

  // ── Generate TikTok Hook ──────────────────────────────────────────────────

  async generateTikTokHook(episodeSummary: string): Promise<string> {
    const prompt = `Write a viral, emotionally manipulative TikTok hook (one sentence) for this episode: "${episodeSummary}"`;
    const response = await askAI(prompt, "You are a social media growth expert specializing in viral TikTok drama hooks.", {
      model: "claude-3-5-sonnet-20241022",
      temperature: 0.9
    });

    return response.content.trim().replace(/^"|"$/g, "");
  }

  // ── Generate Season Outline ───────────────────────────────────────────────

  async generateSeasonOutline(seasonNumber: number): Promise<string> {
    const prompt = `Generate a high-level 60-episode arc for Season ${seasonNumber} of ${this.config.series}.
Genre: ${this.config.genre}
Setting: ${this.config.setting}
Focus on the rivalry between Luna and Victor, and the mystery of Eli's true parentage.`;

    const response = await askAI(prompt, "You are a senior series producer for Gilded Claws.", {
      model: "claude-3-5-sonnet-20241022",
      temperature: 0.7
    });

    return response.content;
  }

  // ── Handle Telegram commands ───────────────────────────────────────────────

  async handleTelegramCommand(
    command: string,
    args: string[],
    ctx?: any
  ): Promise<string> {
    try {
      switch (command) {
        case "/drama_episode": {
          const num = parseInt(args[0]) || 1;
          const context = args.slice(1).join(" ");
          const script = await this.generateEpisode(num, context);
          return this.formatEpisodeForTelegram(script);
        }

        case "/drama_batch": {
          const start = parseInt(args[0]) || 1;
          const end = parseInt(args[1]) || start + 2;
          let report = `🎬 *Batch Production Started (Episodes ${start}-${end})*\n\n`;
          for (let i = start; i <= end; i++) {
            const script = await this.generateEpisode(i);
            report += `✅ S${script.season}E${script.episode}: ${script.title}\n`;
          }
          return report + `\nDone. Scripts are ready for visual prompting.`;
        }

        case "/drama_hook": {
          const summary = args.join(" ");
          const hook = await this.generateTikTokHook(summary);
          return `🎣 *TikTok Hook:* "${hook}"`;
        }

        case "/drama_prompts": {
          const ep = parseInt(args[0]) || 1;
          const scene = args.slice(1).join(" ");
          const prompts = await this.generateMuapiPrompts(ep, scene);
          return this.formatPromptsForTelegram(prompts);
        }

        case "/drama_season": {
          const num = parseInt(args[0]) || 3;
          const outline = await this.generateSeasonOutline(num);
          return `📅 *S${num} Season Outline*\n\n${outline}`;
        }

        case "/drama_status":
          return this.getProductionStatus();

        case "/drama_produce": {
          const num = parseInt(args[0]) || 1;
          const script = await this.generateEpisode(num);
          
          if (ctx) await ctx.reply(`🎬 *Script Ready:* S${script.season}E${script.episode} - "${script.title}"\nStarting visual production...`, { parse_mode: 'Markdown' });

          // Trigger visual production
          const clips = await produceDynamicEpisode(
            this.config.series,
            script.episode,
            script.title,
            script.scenes
          );
          
          // Post clips if ctx is available
          if (ctx && clips.length > 0) {
            for (const clip of clips) {
              await ctx.reply(clip).catch((e: any) => log(`[Drama] Clip post failed: ${e.message}`, "error"));
            }
          }
          
          return `✅ *Visual Production Complete for S${script.season}E${script.episode}*\n\nGenerated ${clips.length} scenes.`;
        }

        default:
          return `❌ Unknown drama command: ${command}`;
      }
    } catch (err: any) {
      return `❌ Drama Error: ${err.message}`;
    }
  }

  // ─────────────────────────────────────────────
  // PRIVATE HELPERS
  // ─────────────────────────────────────────────

  private buildEpisodePrompt(episodeNumber: number, context?: string): string {
    return `Write Episode ${episodeNumber} of Season ${this.config.season} of ${this.config.series}.
${context ? `CONTEXT/NOTES: ${context}` : ""}
Format the response as follows:
TITLE: [Episode title]
TIKTOK_HOOK: [One-line hook for the caption]
SCENE 1:
[LOCATION: ...]
[CHARACTERS: ...]
CHARACTER: Dialogue line (emotion)
...`;
  }

  private parseEpisodeResponse(raw: string, episodeNumber: number): EpisodeScript {
    const titleMatch = raw.match(/TITLE:\s*(.+)/);
    const title = titleMatch ? titleMatch[1].trim() : `Episode ${episodeNumber}`;
    const hookMatch = raw.match(/TIKTOK_HOOK:\s*(.+)/);
    const tiktokHook = hookMatch ? hookMatch[1].trim() : "";

    const scenes: Scene[] = [];
    const sceneBlocks = raw.split(/SCENE \d+:/);
    sceneBlocks.slice(1).forEach((block, idx) => {
      const locationMatch = block.match(/\[LOCATION:\s*(.+?)\]/);
      const charactersMatch = block.match(/\[CHARACTERS:\s*(.+?)\]/);
      const dialogue: DialogueLine[] = [];
      const dialogueRegex = /^([A-Z][A-Z\s]+):\s*(.+?)(?:\s*\((.+?)\))?$/gm;
      let match;
      while ((match = dialogueRegex.exec(block)) !== null) {
        dialogue.push({
          character: match[1].trim(),
          line: match[2].trim(),
          emotion: match[3]?.trim() || "neutral",
        });
      }
      scenes.push({
        id: idx + 1,
        location: locationMatch ? locationMatch[1] : "Unknown",
        characters: charactersMatch ? charactersMatch[1].split(",").map((c) => c.trim()) : [],
        dialogue,
      });
    });

    const subtitles: Subtitle[] = scenes.flatMap(s => s.dialogue.map(d => ({ text: `${d.character}: ${d.line}`, startMs: 0, endMs: 0 })));

    return { season: this.config.season, episode: episodeNumber, title, scenes, muapiPrompts: [], subtitles, tiktokHook };
  }

  private parseMuapiPrompts(raw: string): MuapiPrompt[] {
    const prompts: MuapiPrompt[] = [];
    const blocks = raw.split(/CHARACTER:\s*/).slice(1);
    blocks.forEach((block) => {
      const charMatch = block.match(/^(.+)/);
      const emotionMatch = block.match(/EMOTION:\s*(.+)/);
      const outfitMatch = block.match(/OUTFIT:\s*(.+)/);
      const bgMatch = block.match(/BACKGROUND:\s*(.+)/);

      if (charMatch && emotionMatch && outfitMatch && bgMatch) {
        const charName = charMatch[1].trim();
        const profile = this.config.characters.find(c => c.name === charName);
        const fullPrompt = `${profile?.basePrompt || charName}, ${emotionMatch[1].trim()}, wearing ${outfitMatch[1].trim()}, ${bgMatch[1].trim()}, ${GLOBAL_STYLE_SUFFIX}`;
        prompts.push({ character: charName, emotion: emotionMatch[1].trim(), outfit: outfitMatch[1].trim(), background: bgMatch[1].trim(), fullPrompt });
      }
    });
    return prompts;
  }

  private formatEpisodeForTelegram(episode: EpisodeScript): string {
    const header = `🎬 *GILDED CLAWS* — S${episode.season}E${episode.episode}\n📺 *${episode.title}*\n\n`;
    const scenes = episode.scenes.map((s) => {
      const dialogue = s.dialogue.map((d) => `*${d.character}:* "${d.line}"`).join("\n");
      return `📍 _${s.location}_\n${dialogue}`;
    }).join("\n\n---\n\n");
    return header + scenes + (episode.tiktokHook ? `\n\n🎣 *Hook:* ${episode.tiktokHook}` : "");
  }

  private formatPromptsForTelegram(prompts: MuapiPrompt[]): string {
    return `🎨 *Muapi.ai Prompts:*\n\n` + prompts.map((p) => `👤 *${p.character}*\n\`\`\`\n${p.fullPrompt}\n\`\`\``).join("\n\n");
  }

  private getProductionStatus(): string {
    const cast = this.config.characters.map(c => c.name).join(", ");
    return `🎬 **GILDED CLAWS — PRODUCTION STATUS**\n\n` +
           `📺 **Series:** ${this.config.series}\n` +
           `📅 **Season:** ${this.config.season}\n` +
           `📝 **Episodes:** ${this.config.episodeCount}\n` +
           `👥 **Cast:** ${cast}\n\n` +
           `**Available Commands:**\n` +
           `/drama_episode, /drama_batch, /drama_hook, /drama_prompts, /drama_season`;
  }
}

// ─────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────

export function isDramaCommand(message: string): boolean {
  // If it's already a slash command, let the router handle it
  if (message.startsWith("/")) return false;
  
  const keywords = ["drama", "gilded claws", "episode", "script", "production status"];
  const lower = message.toLowerCase();
  return keywords.some(kw => lower.includes(kw));
}

export async function routeToDramaAgent(message: string, chatId: string): Promise<string> {
  const agent = new DramaAgent();
  if (message.startsWith("/drama_")) {
    const parts = message.split(" ");
    return agent.handleTelegramCommand(parts[0], parts.slice(1));
  }
  
  const routingPrompt = `You are the Drama Orchestrator. Map the user intent to ONE of these commands:
  - /drama_produce [ep_number]: Create a full video episode (default 1)
  - /drama_episode [ep_number]: Generate just the script text
  - /drama_status: Show production status
  - /drama_season: Generate a new season outline
  
  User said: "${message}"
  
  Respond with ONLY the command and arguments. Example: /drama_produce 1`;

  const response = await askAI(routingPrompt, "Drama Command Router", { model: "claude-3-5-sonnet-20241022", maxTokens: 50 });
  const cmdLine = response.content.trim().replace(/\//g, "/").split(" ");
  return agent.handleTelegramCommand(cmdLine[0], cmdLine.slice(1));
}

/**
 * Compatibility wrapper for agentRouter.ts
 */
export const handle = routeToDramaAgent;
