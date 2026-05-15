// ============================================================
// src/agents/ContentSchedulerAgent.ts
// Spidey Jr. TikTok Auto-Scheduler for hapdabot
// GREYNATION · stuyza.com
// ============================================================

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as cron from 'node-cron';
import { Telegraf, Context } from 'telegraf';
import { fileURLToPath } from 'url';
import { sanitizeHTML } from '../core/telegramUtils.js';

// ─── CONFIG ─────────────────────────────────────────────────
const TIKTOK_ACCESS_TOKEN = process.env.TIKTOK_ACCESS_TOKEN!;
const TIKTOK_OPEN_ID      = process.env.TIKTOK_OPEN_ID!;
const TELEGRAM_BOT_TOKEN  = process.env.TELEGRAM_BOT_TOKEN!;
const ADMIN_CHAT_ID       = process.env.ADMIN_CHAT_ID!;
const VIDEO_UPLOAD_DIR    = process.env.VIDEO_DIR || './videos/spidey';

// Peak posting windows EST → UTC offset handled by Railway TZ env
// Kids audience: 7AM, 3PM, 8PM EST
const POST_SCHEDULE = {
  morning:   '0 12 * * *',   // 7AM EST  = 12:00 UTC
  afternoon: '0 20 * * *',   // 3PM EST  = 20:00 UTC
  evening:   '0 1  * * *',   // 8PM EST  = 01:00 UTC+1
};

// ─── TYPES ──────────────────────────────────────────────────
export interface EpisodeEntry {
  series:   string;
  ep:       string;
  title:    string;
  emoji:    string;
  theme:    string;
  hashtags: string[];
  caption:  string;
  filename: string;  // local file in series directory
  posted:   boolean;
  postedAt?: string;
}

export type SpideyEpisode = EpisodeEntry; // Backwards compat

interface PostResult {
  success:   boolean;
  publishId?: string;
  error?:    string;
}

// ─── SPIDEY SEASON 1 REGISTRY ──────────────────────────────
export const SEASON_1: EpisodeEntry[] = [
  {
    series: 'Spider Jr',
    ep: 'S01E01', title: 'First Swing!', emoji: '🌅',
    theme: 'Origin Story',
    hashtags: ['SpideyJr','KidsCartoon','SpiderManKids','AnimatedShorts','KidsYouTube','SuperheroKids','CartoonForToddlers','3DAnimation'],
    caption: '🌅✨ Spidey discovers his powers for the FIRST TIME! 🕷️💥\n\n#SpideyJr #KidsCartoon #SpiderManKids #AnimatedShorts #KidsYouTube #SuperheroKids #CartoonForToddlers #3DAnimation',
    filename: 's01e01_first_swing.mp4',
    posted: false
  },
  {
    series: 'Spider Jr',
    ep: 'S01E02', title: 'Butterfly Rescue', emoji: '🦋',
    theme: 'Kindness',
    hashtags: ['SpideyJr','KidsCartoon','Kindness','AnimatedShorts','KidsYouTube','NatureKids','GentleHero'],
    caption: '🦋💕 Even tiny wings deserve saving! Spidey shows us how to be gentle 🕷️\n\n#SpideyJr #KidsCartoon #Kindness #AnimatedShorts #KidsYouTube',
    filename: 's01e02_butterfly.mp4',
    posted: false
  },
  {
    series: 'Spider Jr',
    ep: 'S01E03', title: 'Birthday Surprise', emoji: '🎈',
    theme: 'Friendship',
    hashtags: ['SpideyJr','KidsCartoon','Birthday','AnimatedShorts','KidsYouTube','Friendship','SuperheroKids'],
    caption: '🎈🎁 Spidey delivers the BEST birthday surprise EVER! 🕷️🥳\n\n#SpideyJr #KidsCartoon #Birthday #AnimatedShorts #Friendship',
    filename: 's01e03_birthday.mp4',
    posted: false
  },
  {
    series: 'Spider Jr',
    ep: 'S01E04', title: 'Rainy Day Hero', emoji: '🌧️',
    theme: 'Empathy',
    hashtags: ['SpideyJr','KidsCartoon','RainyDay','AnimatedShorts','KidsYouTube','Empathy','DuckRescue'],
    caption: '🌧️🦆 Rain can\'t stop Spidey from saving the day! 🕷️☂️\n\n#SpideyJr #KidsCartoon #RainyDay #AnimatedShorts #KidsYouTube',
    filename: 's01e04_rainy.mp4',
    posted: false
  },
  {
    series: 'Spider Jr',
    ep: 'S01E05', title: 'Lost Puppy', emoji: '🐶',
    theme: 'Responsibility',
    hashtags: ['SpideyJr','KidsCartoon','LostPuppy','AnimatedShorts','KidsYouTube','PuppyLove','SuperheroKids'],
    caption: '🐶💛 No puppy gets left behind when Spidey is on patrol! 🕷️🐾\n\n#SpideyJr #KidsCartoon #LostPuppy #AnimatedShorts #PuppyLove',
    filename: 's01e05_puppy.mp4',
    posted: false
  },
  {
    series: 'Spider Jr',
    ep: 'S01E06', title: 'Rainbow After Rain', emoji: '🌈',
    theme: 'Hope & Wonder',
    hashtags: ['SpideyJr','KidsCartoon','Rainbow','AnimatedShorts','KidsYouTube','Magic','Wonder'],
    caption: '🌈✨ Spidey SWINGS across a RAINBOW! No way... 🕷️⚡\n\n#SpideyJr #KidsCartoon #Rainbow #AnimatedShorts #Magic',
    filename: 's01e06_rainbow.mp4',
    posted: false
  },
  {
    series: 'Spider Jr',
    ep: 'S01E07', title: 'Lunch Hero', emoji: '🍎',
    theme: 'Sharing',
    hashtags: ['SpideyJr','KidsCartoon','Sharing','AnimatedShorts','KidsYouTube','Funny','LunchTime'],
    caption: '🍎😂 Spidey accidentally becomes a LUNCH DELIVERY HERO 🕷️🥪\n\n#SpideyJr #KidsCartoon #Sharing #AnimatedShorts #Funny',
    filename: 's01e07_lunch.mp4',
    posted: false
  },
  {
    series: 'Spider Jr',
    ep: 'S01E08', title: 'Bedtime Patrol', emoji: '🌙',
    theme: 'Safety & Care',
    hashtags: ['SpideyJr','KidsCartoon','Bedtime','AnimatedShorts','KidsYouTube','SeasonFinale','GoodNight'],
    caption: '🌙⭐ Season 1 Finale! Spidey\'s last patrol before bedtime... 🕷️😴\n\n#SpideyJr #KidsCartoon #Bedtime #SeasonFinale #AnimatedShorts',
    filename: 's01e08_bedtime.mp4',
    posted: false
  }
];

// ─── GILDED CLAWS SEASON 1 REGISTRY ──────────────────────────────
export const GILDED_SEASON_1: EpisodeEntry[] = [
  {
    series: 'Gilded Claws',
    ep: 'S01E01', title: 'The Deal', emoji: '🖋️',
    theme: 'Infiltration',
    hashtags: ['GildedClaws','Drama','BillionaireRomance','MiniDrama','TikTokSeries','LuxuryLife','WolfFamily'],
    caption: '🖋️ My father owed the Blackmanes everything. I’m here to take it back. 🐺✨\n\n#GildedClaws #MiniDrama #BillionaireRomance #Luxury',
    filename: 'ep1_the_deal.mp4',
    posted: false
  },
  {
    series: 'Gilded Claws',
    ep: 'S01E02', title: 'The Invitation', emoji: '✉️',
    theme: 'High Society',
    hashtags: ['GildedClaws','Drama','EliteSociety','MiniDrama','TikTokSeries','GalaNight'],
    caption: '✉️ Tonight, I am whoever they need me to be. 🦊💃\n\n#GildedClaws #EliteSociety #Drama #Transformation',
    filename: 'ep2_invitation.mp4',
    posted: false
  },
  {
    series: 'Gilded Claws',
    ep: 'S01E03', title: 'First Contact', emoji: '💥',
    theme: 'Encounter',
    hashtags: ['GildedClaws','Drama','FirstMeeting','EnemiesToLovers','MiniDrama'],
    caption: '💥 Watch where you’re going, Roman. 🐺🦊\n\n#GildedClaws #FirstMeeting #Drama #Tension',
    filename: 'ep3_first_contact.mp4',
    posted: false
  }
];

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Persistent state file
const STATE_FILE = path.join(__dirname, '../../data/spidey_schedule.json');

// ─── STATE MANAGEMENT ────────────────────────────────────────
function loadState(): SpideyEpisode[] {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const raw = fs.readFileSync(STATE_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('[ContentScheduler] Failed to load state:', e);
  }
  return SEASON_1;
}

function saveState(episodes: SpideyEpisode[]): void {
  const dir = path.dirname(STATE_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(episodes, null, 2));
}

// ─── TIKTOK API ──────────────────────────────────────────────

/**
 * Step 1: Initialize a video upload session on TikTok
 * Returns the upload_url and publish_id for the video
 */
async function initTikTokUpload(videoSizeBytes: number): Promise<{
  uploadUrl: string;
  publishId: string;
}> {
  const body = JSON.stringify({
    post_info: {
      title: '',          // filled per-episode
      privacy_level: 'PUBLIC_TO_EVERYONE',
      disable_duet: false,
      disable_comment: false,
      disable_stitch: false,
      video_cover_timestamp_ms: 1000
    },
    source_info: {
      source: 'FILE_UPLOAD',
      video_size: videoSizeBytes,
      chunk_size: videoSizeBytes,
      total_chunk_count: 1
    }
  });

  const response = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TIKTOK_ACCESS_TOKEN}`,
      'Content-Type': 'application/json; charset=UTF-8'
    },
    body
  });

  const data = await response.json() as any;
  if (data.error?.code !== 'ok') {
    throw new Error(`TikTok init failed: ${JSON.stringify(data.error)}`);
  }

  return {
    uploadUrl: data.data.upload_url,
    publishId: data.data.publish_id
  };
}

/**
 * Step 2: Upload the actual video bytes to TikTok's upload URL
 */
async function uploadVideoBytes(uploadUrl: string, videoPath: string, videoSizeBytes: number): Promise<void> {
  const videoBuffer = fs.readFileSync(videoPath);

  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Range': `bytes 0-${videoSizeBytes - 1}/${videoSizeBytes}`,
      'Content-Length': videoSizeBytes.toString()
    },
    body: videoBuffer
  });

  if (!response.ok) {
    throw new Error(`TikTok upload failed: ${response.status} ${response.statusText}`);
  }
}

/**
 * Step 3: Finalize post with caption and hashtags
 * (TikTok Direct Post API v2 handles this via publish_id from init)
 */
async function finalizePost(publishId: string, caption: string): Promise<string> {
  // With TikTok's v2 Direct Post API, the video is published automatically
  // after upload completes. We poll status here.
  const response = await fetch('https://open.tiktokapis.com/v2/post/publish/status/fetch/', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TIKTOK_ACCESS_TOKEN}`,
      'Content-Type': 'application/json; charset=UTF-8'
    },
    body: JSON.stringify({ publish_id: publishId })
  });

  const data = await response.json() as any;
  return data.data?.status || 'PROCESSING_UPLOAD';
}

/**
 * Main post function — handles the full upload + publish flow
 */
async function postEpisodeToTikTok(ep: SpideyEpisode): Promise<PostResult> {
  const videoPath = path.join(VIDEO_UPLOAD_DIR, ep.filename);

  if (!fs.existsSync(videoPath)) {
    return {
      success: false,
      error: `Video file not found: ${videoPath}`
    };
  }

  const stat = fs.statSync(videoPath);
  const videoSizeBytes = stat.size;

  try {
    console.log(`[ContentScheduler] Uploading ${ep.ep}: ${ep.title}...`);

    // 1. Init upload session
    const { uploadUrl, publishId } = await initTikTokUpload(videoSizeBytes);

    // 2. Upload video bytes
    await uploadVideoBytes(uploadUrl, videoPath, videoSizeBytes);

    // 3. Poll for status (give TikTok 5s to process)
    await new Promise(r => setTimeout(r, 5000));
    const status = await finalizePost(publishId, ep.caption);

    console.log(`[ContentScheduler] ${ep.ep} publish status: ${status}`);

    return { success: true, publishId };

  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ─── TELEGRAM NOTIFICATIONS ──────────────────────────────────
async function notifyTelegram(message: string): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN || !ADMIN_CHAT_ID) return;

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const body = JSON.stringify({
    chat_id: ADMIN_CHAT_ID,
    text: message,
    parse_mode: 'HTML'
  });

  return new Promise((resolve) => {
    const req = https.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, (res) => { resolve(); });
    req.on('error', () => resolve());
    req.write(body);
    req.end();
  });
}

// ─── SCHEDULER CORE ──────────────────────────────────────────
export class ContentSchedulerAgent {
  private episodes: SpideyEpisode[];
  private bot: Telegraf | null = null;

  constructor() {
    this.episodes = loadState();
    console.log('[ContentScheduler] Initialized. Episodes loaded:', this.episodes.length);
  }

  /** Attach Telegram bot for /content commands */
  attachBot(bot: Telegraf): void {
    this.bot = bot;

    bot.command('content', (ctx) => this.handleContentCommand(ctx));
    bot.command('schedule', (ctx) => this.handleScheduleCommand(ctx));
    bot.command('post_now', (ctx) => this.handlePostNow(ctx));
    bot.command('mark_ready', (ctx) => this.handleMarkReady(ctx));

    console.log('[ContentScheduler] Bot commands registered: /content /schedule /post_now /mark_ready');
  }

  /** Start all cron jobs */
  startScheduler(): void {
    // Morning post: 7AM EST
    cron.schedule(POST_SCHEDULE.morning, () => this.runScheduledPost('morning'), {
      timezone: 'America/New_York'
    });

    // Afternoon post: 3PM EST
    cron.schedule(POST_SCHEDULE.afternoon, () => this.runScheduledPost('afternoon'), {
      timezone: 'America/New_York'
    });

    // Evening post: 8PM EST
    cron.schedule(POST_SCHEDULE.evening, () => this.runScheduledPost('evening'), {
      timezone: 'America/New_York'
    });

    console.log('[ContentScheduler] ✅ Cron jobs active: 7AM / 3PM / 8PM EST');
    notifyTelegram('🕷️ <b>Spidey Jr. Scheduler ONLINE</b>\n\nPosting: 7AM · 3PM · 8PM EST\nSeason 1 ready to roll!');
  }

  /** Pick next unposted episode with a ready video file */
  private getNextEpisode(): SpideyEpisode | null {
    return this.episodes.find(ep => {
      if (ep.posted) return false;
      const videoPath = path.join(VIDEO_UPLOAD_DIR, ep.filename);
      return fs.existsSync(videoPath);
    }) || null;
  }

  /** Execute a scheduled post */
  private async runScheduledPost(window: string): Promise<void> {
    const ep = this.getNextEpisode();

    if (!ep) {
      console.log(`[ContentScheduler] No ready episodes for ${window} post. Skipping.`);
      await notifyTelegram(`🕷️ <b>Spidey Jr. ${window} post skipped</b>\nNo video files ready. Render more episodes!`);
      return;
    }

    console.log(`[ContentScheduler] ${window} post: ${ep.ep} - ${ep.title}`);
    await notifyTelegram(`🎬 <b>Posting ${sanitizeHTML(ep.ep)}: ${sanitizeHTML(ep.title)}</b>\nWindow: ${window}\nUploading to TikTok...`);

    const result = await postEpisodeToTikTok(ep);

    if (result.success) {
      ep.posted = true;
      ep.postedAt = new Date().toISOString();
      saveState(this.episodes);

      const remaining = this.episodes.filter(e => !e.posted).length;
      await notifyTelegram(
        `✅ <b>${sanitizeHTML(ep.ep)}: ${sanitizeHTML(ep.title)} POSTED!</b> ${ep.emoji}\n\n` +
        `📋 Publish ID: <code>${sanitizeHTML(result.publishId || '')}</code>\n` +
        `📅 Posted: ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })}\n` +
        `📺 Caption: ${sanitizeHTML(ep.caption.slice(0, 80))}...\n\n` +
        `📦 Episodes remaining: ${remaining}/8`
      );
    } else {
      await notifyTelegram(
        `❌ <b>${sanitizeHTML(ep.ep)} post FAILED</b>\n\nError: ${sanitizeHTML(result.error || 'Unknown error')}\n\nCheck Railway logs for details.`
      );
    }
  }

  // ─── TELEGRAM COMMAND HANDLERS ──────────────────────────────

  /** /content — Show full episode status dashboard */
  private async handleContentCommand(ctx: Context): Promise<void> {
    const lines = this.episodes.map(ep => {
      const videoReady = fs.existsSync(path.join(VIDEO_UPLOAD_DIR, ep.filename));
      const statusIcon = ep.posted ? '✅' : videoReady ? '🎬' : '⏳';
      const postedInfo = ep.postedAt
        ? ` · Posted ${new Date(ep.postedAt).toLocaleDateString()}`
        : videoReady ? ' · Ready to post' : ' · Waiting for video';
      return `${statusIcon} <b>${sanitizeHTML(ep.ep)}</b> ${ep.emoji} ${sanitizeHTML(ep.title)}${postedInfo}`;
    });

    const posted   = this.episodes.filter(e => e.posted).length;
    const ready    = this.episodes.filter(e => !e.posted && fs.existsSync(path.join(VIDEO_UPLOAD_DIR, e.filename))).length;
    const pending  = this.episodes.filter(e => !e.posted && !fs.existsSync(path.join(VIDEO_UPLOAD_DIR, e.filename))).length;

    await ctx.reply(
      `🕷️ <b>Spidey Jr. Season 1 · Content Dashboard</b>\n\n` +
      lines.join('\n') +
      `\n\n📊 <b>Summary:</b> ${posted} posted · ${ready} ready · ${pending} pending video\n` +
      `\n📅 <b>Schedule:</b> 7AM · 3PM · 8PM EST daily` +
      `\n\n<i>Commands: /post_now · /mark_ready [ep] · /schedule</i>`,
      { parse_mode: 'HTML' }
    );
  }

  /** /schedule — Show next 3 post windows */
  private async handleScheduleCommand(ctx: Context): Promise<void> {
    const now = new Date();
    const est = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const nextEp = this.getNextEpisode();

    await ctx.reply(
      `📅 <b>Spidey Jr. Post Schedule</b>\n\n` +
      `🌅 Morning: 7:00 AM EST\n` +
      `☀️ Afternoon: 3:00 PM EST\n` +
      `🌙 Evening: 8:00 PM EST\n\n` +
      `🕐 Current EST: ${est.toLocaleTimeString('en-US')}\n\n` +
      (nextEp
        ? `🎬 <b>Next up:</b> ${sanitizeHTML(nextEp.ep)} — ${nextEp.emoji} ${sanitizeHTML(nextEp.title)}`
        : `⏳ <b>No ready episodes.</b> Add video files to: <code>${sanitizeHTML(VIDEO_UPLOAD_DIR)}</code>`),
      { parse_mode: 'HTML' }
    );
  }

  /** /post_now — Immediately post the next ready episode */
  private async handlePostNow(ctx: Context): Promise<void> {
    const ep = this.getNextEpisode();

    if (!ep) {
      await ctx.reply(
        '⏳ No episodes ready to post.\n\n' +
        'Add rendered .mp4 files to the videos/spidey directory, then use:\n' +
        '<code>/mark_ready S01E01</code> to flag an episode as available.',
        { parse_mode: 'HTML' }
      );
      return;
    }

    await ctx.reply(`🚀 Posting <b>${sanitizeHTML(ep.ep)}: ${sanitizeHTML(ep.title)}</b> ${ep.emoji} to TikTok now...`, { parse_mode: 'HTML' });
    const result = await postEpisodeToTikTok(ep);

    if (result.success) {
      ep.posted = true;
      ep.postedAt = new Date().toISOString();
      saveState(this.episodes);
      await ctx.reply(`✅ <b>${sanitizeHTML(ep.ep)} posted!</b>\nPublish ID: <code>${sanitizeHTML(result.publishId || '')}</code>`, { parse_mode: 'HTML' });
    } else {
      await ctx.reply(`❌ Post failed: ${sanitizeHTML(result.error || 'Unknown error')}`, { parse_mode: 'HTML' });
    }
  }

  /** /mark_ready S01E01 — Simulate video file ready (for testing without real video) */
  private async handleMarkReady(ctx: Context): Promise<void> {
    const msg = (ctx.message as any)?.text || '';
    const epCode = msg.split(' ')[1]?.toUpperCase();
    const ep = this.episodes.find(e => e.ep === epCode);

    if (!ep) {
      await ctx.reply(`Episode "${epCode}" not found. Use format: /mark_ready S01E01`);
      return;
    }

    // Create a placeholder file so the scheduler sees it as ready
    const videoDir = VIDEO_UPLOAD_DIR;
    if (!fs.existsSync(videoDir)) fs.mkdirSync(videoDir, { recursive: true });
    const placeholderPath = path.join(videoDir, ep.filename);

    if (!fs.existsSync(placeholderPath)) {
      // Write minimal valid placeholder (replace with real Veo output)
      fs.writeFileSync(placeholderPath, Buffer.from('PLACEHOLDER'));
    }

    await ctx.reply(
      `🎬 <b>${sanitizeHTML(ep.ep)}: ${sanitizeHTML(ep.title)}</b> marked as ready!\n\n` +
      `⚠️ Replace <code>${sanitizeHTML(ep.filename)}</code> with your real Veo-rendered video before the next scheduled post.\n\n` +
      `📂 Path: <code>${sanitizeHTML(placeholderPath)}</code>`,
      { parse_mode: 'HTML' }
    );
  }
}

// ─── EXPORT SINGLETON ────────────────────────────────────────
export const contentScheduler = new ContentSchedulerAgent();
