// ============================================================
// OUT THE WAY â€” Posting Agent
// Prepares post payloads for TikTok, Instagram Reels, YouTube Shorts
// ============================================================

import fs from "fs";
import path from "path";
import { BaseAgent } from "../baseAgent.js";
import { log } from "../../core/config.js";
import type { Episode, PostPayload, AgentEvent } from "./types.js";
import type { MonitoringAgent } from "./monitoringAgent.js";

const POSTS_DIR = path.join(process.cwd(), "data", "outtheway", "posts");
const PLATFORMS: PostPayload["platform"][] = ["tiktok", "instagram", "youtube_shorts"];

export class PostingAgent extends BaseAgent {
    private monitor: MonitoringAgent;

    constructor(monitor: MonitoringAgent) {
        super("PostingAgent", "");
        this.monitor = monitor;
    }

    getName(): string { return "PostingAgent"; }

    getSystemPrompt(): string {
        return `You are the Posting Agent for "Out the Way" â€” a vertical AI drama series.
Your job is to prepare optimized post metadata for each social platform.
You understand platform-specific requirements and audience behavior:
- TikTok: Short punchy captions, trending sounds, fast hooks
- Instagram Reels: Aesthetic captions, line breaks, CTA at the end
- YouTube Shorts: Keyword-optimized title + description, chapter markers

Always return valid JSON only.`;
    }

    private emit(status: AgentEvent["status"], message: string): void {
        this.monitor.report({ agent: "posting", status, message, timestamp: "" });
    }

    async prepareAndQueue(episode: Episode, videoPath: string, marketingCaption: string, hashtags: string[]): Promise<PostPayload[]> {
        this.ensurePostsDir();
        this.emit("active", `Preparing posts for episode ${episode.episodeNumber}`);
        log(`[posting] Preparing ${PLATFORMS.length} platform posts for ep ${episode.episodeNumber}`);

        const prompt = `Prepare posting metadata for episode ${episode.episodeNumber} of "Out the Way":

Title: "${episode.title}"
Synopsis: "${episode.synopsis}"
Hook: "${episode.hook}"
Cliffhanger: "${episode.cliffhanger}"
Base caption: "${marketingCaption}"
Hashtags: ${hashtags.join(" ")}

Return ONLY a JSON array of 3 post objects (one per platform: tiktok, instagram, youtube_shorts):
[
  {
    "platform": "tiktok",
    "caption": "Platform-optimized caption",
    "hashtags": ["tag1", "tag2"],
    "bestPostTime": "Evening 7â€“9 PM EST",
    "audienceNote": "Short observation about expected engagement"
  },
  { "platform": "instagram", ... },
  { "platform": "youtube_shorts", ... }
]`;

        const payloads: PostPayload[] = [];

        try {
            const response = await this.ask(prompt);
            const rawContent = response.content?.trim() ?? "";
            const jsonStr = rawContent.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
            const platformData: any[] = JSON.parse(jsonStr);

            for (const p of platformData) {
                const payload: PostPayload = {
                    episodeNumber: episode.episodeNumber,
                    videoPath,
                    caption: p.caption ?? marketingCaption,
                    hashtags: p.hashtags ?? hashtags,
                    platform: p.platform as PostPayload["platform"],
                    status: "queued",
                    createdAt: new Date().toISOString()
                };

                // Save individual platform payload
                const filename = `ep${episode.episodeNumber}_${p.platform}.json`;
                const filePath = path.join(POSTS_DIR, filename);
                const fullPayload = { ...payload, bestPostTime: p.bestPostTime, audienceNote: p.audienceNote };
                fs.writeFileSync(filePath, JSON.stringify(fullPayload, null, 2), "utf-8");
                log(`[posting] ðŸ“¦ Post queued for ${p.platform}: ${filename}`);

                payloads.push(payload);
            }

            this.emit("completed", `${payloads.length} posts queued for episode ${episode.episodeNumber}`);

        } catch (err: any) {
            this.emit("failed", `Post preparation failed: ${err.message}`);
            log(`[posting] âŒ Failed: ${err.message}`, "error");
            throw err;
        }

        return payloads;
    }

    /**
     * INTEGRATION POINT: Actually post to each platform.
     * 
     * TikTok: Use TikTok Content Posting API v2
     *   POST https://open.tiktokapis.com/v2/post/publish/video/init/
     * 
     * Instagram/Reels: Meta Graph API
     *   POST https://graph.facebook.com/v19.0/{ig-user-id}/media
     *   then: POST .../media_publish
     * 
     * YouTube Shorts: YouTube Data API v3
     *   POST https://www.googleapis.com/upload/youtube/v3/videos
     * 
     * Each platform requires OAuth tokens â€” store in .env as:
     *   TIKTOK_ACCESS_TOKEN, INSTAGRAM_ACCESS_TOKEN, YOUTUBE_ACCESS_TOKEN
     */
    async postToplatform(payload: PostPayload): Promise<PostPayload> {
        log(`[posting] ðŸš€ Would post to ${payload.platform} â€” add API credentials to .env to enable`, "warn");

        // Update payload status
        payload.status = "queued";
        payload.postedAt = new Date().toISOString();

        return payload;
    }

    private ensurePostsDir(): void {
        if (!fs.existsSync(POSTS_DIR)) fs.mkdirSync(POSTS_DIR, { recursive: true });
    }
}

