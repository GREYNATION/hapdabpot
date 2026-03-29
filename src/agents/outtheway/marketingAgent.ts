// ============================================================
// OUT THE WAY â€” Marketing Agent
// Generates captions, hashtags, teaser clips, promo content
// ============================================================

import fs from "fs";
import path from "path";
import { BaseAgent } from "../baseAgent.js";
import { log } from "../../core/config.js";
import type { Episode, MarketingPackage, AgentEvent } from "./types.js";
import type { MonitoringAgent } from "./monitoringAgent.js";

const MARKETING_DIR = path.join(process.cwd(), "data", "outtheway", "marketing");

export class MarketingAgent extends BaseAgent {
    private monitor: MonitoringAgent;

    constructor(monitor: MonitoringAgent) {
        super("MarketingAgent", "");
        this.monitor = monitor;
    }

    getName(): string { return "MarketingAgent"; }

    getSystemPrompt(): string {
        return `You are the Marketing Agent for "Out the Way" â€” a vertical AI drama series with authentic Black storytelling.

Your job is to create viral, culture-native marketing content for every episode:

PLATFORM AUDIENCES:
- TikTok / Reels: Gen Z + Millennials, love raw emotion, cliffhangers, relatability
- Twitter/X: Dialogue-focused snippets, screenshot-able lines, quote culture
- YouTube Shorts: Consistent watchers, hook them in 1 second

CAPTION WRITING RULES:
- Always start with the hook (emotion bait â€” NOT the plot)
- Use line breaks for impact
- End with a CTA ("part 2 dropping soon" / "follow for more")
- Sound authentic, not corporate

HASHTAG STRATEGY:
- 5â€“10 niche tags (e.g., #BlackDrama, #OutTheWay, #AIShorts, #UrbanStories)
- 3â€“5 broad discovery tags (e.g., #shorts, #drama, #miniseries)

Always return valid JSON only.`;
    }

    private emit(status: AgentEvent["status"], message: string, output?: string): void {
        this.monitor.report({ agent: "marketing", status, message, timestamp: "", output });
    }

    async generatePackage(episode: Episode, finalVideoPath: string): Promise<MarketingPackage> {
        this.ensureMarketingDir();
        this.emit("active", `Generating marketing package for episode ${episode.episodeNumber}`);
        log(`[marketing] Creating marketing package for ep ${episode.episodeNumber}`);

        const prompt = `Generate a complete marketing package for episode ${episode.episodeNumber} of "Out the Way".

Show title: "Out the Way"
Episode title: "${episode.title}"
Episode number: ${episode.episodeNumber}
Hook: "${episode.hook}"
Synopsis: "${episode.synopsis}"
Cliffhanger: "${episode.cliffhanger}"

Return ONLY a JSON object:
{
  "caption": "Multi-line caption that starts with emotional hook, breaks for impact, ends with CTA",
  "hashtags": ["OutTheWay", "BlackDrama", ...up to 15 total],
  "twitterLine": "One perfect quote from this episode for Twitter/X (â‰¤ 240 chars)",
  "teaserScript": "Short 8â€“10 second voiceover teaser script for the episode",
  "thumbnailPrompt": "AI image generation prompt for the episode thumbnail (vertical 9:16, faces, emotion)",
  "emotionBait": "The single most shareable emotional moment from this episode (1 sentence)",
  "platforms": ["tiktok", "instagram", "youtube_shorts"]
}`;

        try {
            const response = await this.ask(prompt);
            const rawContent = response.content?.trim() ?? "";
            const jsonStr = rawContent.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
            const data = JSON.parse(jsonStr);

            const pkg: MarketingPackage = {
                episodeNumber: episode.episodeNumber,
                caption: data.caption,
                hashtags: data.hashtags,
                teaserClipPath: undefined, // Set after teaser clip is generated
                platforms: data.platforms ?? ["tiktok", "instagram", "youtube_shorts"],
                createdAt: new Date().toISOString()
            };

            // Save full package (including extras like twitter line, thumbnail prompt)
            const fullPackage = { ...pkg, ...data, finalVideoPath };
            const pkgPath = path.join(MARKETING_DIR, `ep_${episode.episodeNumber}_marketing.json`);
            fs.writeFileSync(pkgPath, JSON.stringify(fullPackage, null, 2), "utf-8");
            log(`[marketing] ðŸ“£ Marketing package saved: ${pkgPath}`);

            // Save caption to standalone text file for easy copy-paste
            const captionPath = path.join(MARKETING_DIR, `ep_${episode.episodeNumber}_caption.txt`);
            const captionText = [
                `=== OUT THE WAY â€” Episode ${episode.episodeNumber}: ${episode.title} ===`,
                ``,
                `CAPTION:`,
                data.caption,
                ``,
                `HASHTAGS:`,
                data.hashtags.join(" "),
                ``,
                `TWITTER LINE:`,
                data.twitterLine ?? "",
                ``,
                `TEASER SCRIPT:`,
                data.teaserScript ?? "",
                ``,
                `EMOTION BAIT:`,
                data.emotionBait ?? "",
            ].join("\n");

            fs.writeFileSync(captionPath, captionText, "utf-8");
            log(`[marketing] ðŸ“‹ Caption text saved: ${captionPath}`);

            this.emit("completed", `Marketing package ready for episode ${episode.episodeNumber}`, pkgPath);
            return pkg;

        } catch (err: any) {
            this.emit("failed", `Marketing generation failed: ${err.message}`);
            log(`[marketing] âŒ Failed: ${err.message}`, "error");
            throw err;
        }
    }

    private ensureMarketingDir(): void {
        if (!fs.existsSync(MARKETING_DIR)) fs.mkdirSync(MARKETING_DIR, { recursive: true });
    }
}

