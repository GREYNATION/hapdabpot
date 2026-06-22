// ============================================================
// src/agents/ContentSchedulerAgent.ts
// Multi-Channel Auto-Scheduler (TikTok & YouTube) for hapdabot
// GREYNATION · stuyza.com · Haphustlehard Media Empire
// ============================================================

import fs from 'fs';
import path from 'path';
import https from 'https';
import cron from 'node-cron';
import { Telegraf, Context } from 'telegraf';
import { fileURLToPath } from 'url';
import { sanitizeHTML } from '../core/telegramUtils.js';
import { log } from '../core/config.js';
import { getSupabase } from '../core/supabase.js';
import { getYouTubeService } from '../services/youtubeService.js';
import { HappyJuniorAgent } from './happyJunior/HappyJuniorAgent.js';
import { HAPPY_JUNIOR } from '../channels/happyJuniorConfig.js';

// ─── CONFIG ─────────────────────────────────────────────────
const rawToken = process.env.TIKTOK_ACCESS_TOKEN || '';
let cleanToken = rawToken.trim().replace(/^["']|["']$/g, '');
if (cleanToken.toLowerCase().startsWith('bearer ')) {
    cleanToken = cleanToken.slice(7).trim();
}
const TIKTOK_ACCESS_TOKEN = cleanToken;
const TELEGRAM_BOT_TOKEN  = process.env.TELEGRAM_BOT_TOKEN || '';
const ADMIN_CHAT_ID       = process.env.ADMIN_CHAT_ID || process.env.TELEGRAM_OWNER_ID || '';
const SPIDEY_VIDEO_DIR    = process.env.VIDEO_DIR || './videos/spidey';

const SPIDEY_SCHEDULE = { // Daily
    morning:   '0 7 * * *',    // 7AM EST
    afternoon: '0 15 * * *',   // 3PM EST
    evening:   '0 19 * * *',   // 7PM EST
};

const HAPPY_JUNIOR_SCHEDULE = { // Disney Jr. Cadence (Mon, Wed, Fri)
    morning:   '0 7 * * 1,3,5',    // 7AM EST
    afternoon: '0 15 * * 1,3,5',   // 3PM EST
    evening:   '0 19 * * 1,3,5',   // 7PM EST
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
    filename: string;
    posted:   boolean;
    postedAt?: string;
}

export type SpideyEpisode = EpisodeEntry;

interface PostResult {
    success:   boolean;
    publishId?: string;
    error?:    string;
}

// ─── SPIDEY REGISTRY ────────────────────────────────────────
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
async function initTikTokUpload(videoSizeBytes: number): Promise<{
    uploadUrl: string;
    publishId: string;
}> {
    const body = JSON.stringify({
        post_info: {
            title: '',
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

async function finalizePost(publishId: string, caption: string): Promise<string> {
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

async function postEpisodeToTikTok(ep: SpideyEpisode): Promise<PostResult> {
    const videoPath = path.join(SPIDEY_VIDEO_DIR, ep.filename);

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
        const { uploadUrl, publishId } = await initTikTokUpload(videoSizeBytes);
        await uploadVideoBytes(uploadUrl, videoPath, videoSizeBytes);

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
    private spideyEpisodes: SpideyEpisode[];
    private bot: Telegraf | null = null;
    private hjAgent = new HappyJuniorAgent();

    constructor() {
        this.spideyEpisodes = loadState();
        console.log('[ContentScheduler] Initialized. Spidey Episodes loaded:', this.spideyEpisodes.length);
    }

    attachBot(bot: Telegraf): void {
        this.bot = bot;

        bot.command('content', (ctx) => this.handleContentCommand(ctx));
        bot.command('schedule', (ctx) => this.handleScheduleCommand(ctx));
        bot.command('post_now', (ctx) => this.handlePostNow(ctx));
        bot.command('mark_ready', (ctx) => this.handleMarkReady(ctx));

        console.log('[ContentScheduler] Bot commands registered: /content /schedule /post_now /mark_ready');
    }

    startScheduler(): void {
        // --- Spidey Jr (TikTok - Daily) ---
        cron.schedule(SPIDEY_SCHEDULE.morning, () => this.runSpideyScheduledPost('morning'), { timezone: 'America/New_York' });
        cron.schedule(SPIDEY_SCHEDULE.afternoon, () => this.runSpideyScheduledPost('afternoon'), { timezone: 'America/New_York' });
        cron.schedule(SPIDEY_SCHEDULE.evening, () => this.runSpideyScheduledPost('evening'), { timezone: 'America/New_York' });

        // --- Happy Junior (YouTube - Mon/Wed/Fri) ---
        cron.schedule(HAPPY_JUNIOR_SCHEDULE.morning, () => this.runHappyJuniorScheduledPost('morning'), { timezone: 'America/New_York' });
        cron.schedule(HAPPY_JUNIOR_SCHEDULE.afternoon, () => this.runHappyJuniorScheduledPost('afternoon'), { timezone: 'America/New_York' });
        cron.schedule(HAPPY_JUNIOR_SCHEDULE.evening, () => this.runHappyJuniorScheduledPost('evening'), { timezone: 'America/New_York' });

        console.log('[ContentScheduler] ✅ Multi-Channel Cron jobs active: Spidey (Daily), Happy Jr (M/W/F)');
        notifyTelegram('🚀 <b>GREYNATION Multi-Channel Scheduler ONLINE</b>\n\nChannels:\n• 🕷️ Spidey Jr (TikTok - Daily)\n• 💛 Happy Junior (YouTube - M/W/F)');
    }

    /**
     * Legacy runner for older schedule testing if needed
     */
    private async runScheduledPost(window: string): Promise<void> {
        log(`[ContentScheduler] Running generic scheduled check for window: ${window}`);
        await this.runSpideyScheduledPost(window);
        await this.runHappyJuniorScheduledPost(window);
    }

    /**
     * Spidey Jr Scheduled Post Logic (TikTok)
     */
    private async runSpideyScheduledPost(window: string): Promise<void> {
        const ep = this.spideyEpisodes.find(e => {
            if (e.posted) return false;
            const videoPath = path.join(SPIDEY_VIDEO_DIR, e.filename);
            return fs.existsSync(videoPath);
        });

        if (!ep) {
            console.log(`[ContentScheduler] Spidey Jr: No ready episodes for ${window} post. Skipping.`);
            return;
        }

        console.log(`[ContentScheduler] Spidey Jr ${window} post: ${ep.ep} - ${ep.title}`);
        await notifyTelegram(`🎬 [Spidey Jr] <b>Posting ${sanitizeHTML(ep.ep)}: ${sanitizeHTML(ep.title)}</b>\nWindow: ${window}\nUploading to TikTok...`);

        const result = await postEpisodeToTikTok(ep);

        if (result.success) {
            ep.posted = true;
            ep.postedAt = new Date().toISOString();
            saveState(this.spideyEpisodes);

            const remaining = this.spideyEpisodes.filter(e => !e.posted).length;
            await notifyTelegram(
                `✅ <b>[Spidey Jr] ${sanitizeHTML(ep.ep)}: ${sanitizeHTML(ep.title)} POSTED!</b> ${ep.emoji}\n\n` +
                `📋 Publish ID: <code>${sanitizeHTML(result.publishId || '')}</code>\n` +
                `📅 Posted: ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })}\n` +
                `📦 Episodes remaining: ${remaining}/${this.spideyEpisodes.length}`
            );
        } else {
            await notifyTelegram(
                `❌ <b>[Spidey Jr] ${sanitizeHTML(ep.ep)} post FAILED</b>\n\nError: ${sanitizeHTML(result.error || 'Unknown error')}`
            );
        }
    }

    /**
     * Happy Junior Scheduled Post Logic (YouTube)
     */
    private async runHappyJuniorScheduledPost(window: string): Promise<void> {
        const supabase = getSupabase();
        if (!supabase) return;

        try {
            // Find the next episode with status = 'assembled' in the queue
            const { data: episodes, error } = await supabase
                .from('episode_queue')
                .select('*')
                .eq('channel', 'happy_junior')
                .eq('status', 'assembled')
                .order('episode_code', { ascending: true })
                .limit(1);

            if (error) {
                log(`[ContentScheduler] Happy Junior: Error querying queue: ${error.message}`, 'error');
                return;
            }

            if (!episodes || episodes.length === 0) {
                console.log(`[ContentScheduler] Happy Junior: No 'assembled' episodes for ${window} post.`);
                return;
            }

            const ep = episodes[0];
            const code = ep.episode_code;

            console.log(`[ContentScheduler] Happy Junior ${window} post: ${code} - ${ep.title}`);
            await notifyTelegram(`🎬 [Happy Junior] <b>Posting ${sanitizeHTML(code)}: ${sanitizeHTML(ep.title)}</b>\nWindow: ${window}\nUploading to YouTube (COPPA)...`);

            // Generate YouTube upload metadata
            const metadata = await this.hjAgent.generateMetadata(code);

            // Upload video
            const youtubeService = getYouTubeService();
            const uploadResult = await youtubeService.uploadVideo(metadata);

            // Update row in DB to status = 'posted'
            const { error: updateError } = await supabase
                .from('episode_queue')
                .update({
                    youtube_video_id: uploadResult.videoId,
                    youtube_title: metadata.title,
                    youtube_description: metadata.description,
                    youtube_tags: metadata.tags,
                    status: 'posted',
                    posted_at: new Date().toISOString()
                })
                .eq('channel', 'happy_junior')
                .eq('episode_code', code);

            if (updateError) {
                log(`[ContentScheduler] Happy Junior: Failed to update DB post status: ${updateError.message}`, 'error');
            }

            // Auto-playlist assignment
            try {
                // Determine playlist ID (e.g. Full Episodes playlist)
                let playlistId = ep.youtube_playlist_id;
                if (!playlistId) {
                    // Try to look up default playlist from config
                    playlistId = HAPPY_JUNIOR.playlists.full_episodes.id;
                }
                
                if (playlistId && playlistId !== 'full_episodes') { // Only call API if it has been replaced with a real YouTube ID
                    await youtubeService.addToPlaylist(uploadResult.videoId, playlistId);
                    log(`[ContentScheduler] Added ${uploadResult.videoId} to playlist ${playlistId}.`);
                }
            } catch (playlistErr: any) {
                log(`[ContentScheduler] Failed to add video to playlist: ${playlistErr.message}`, 'warn');
            }

            await notifyTelegram(
                `✅ <b>[Happy Junior] ${sanitizeHTML(code)}: ${sanitizeHTML(ep.title)} POSTED!</b> 🌟💛\n\n` +
                `📺 YouTube Video ID: <code>${sanitizeHTML(uploadResult.videoId)}</code>\n` +
                `🔗 Link: ${uploadResult.url}\n` +
                `📅 Posted: ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })}\n` +
                `👶 COPPA: Enforced (Made for Kids)`
            );

        } catch (err: any) {
            log(`[ContentScheduler] Happy Junior scheduled post failed: ${err.message}`, 'error');
            await notifyTelegram(`❌ <b>[Happy Junior] Scheduled post failed</b>\nError: ${sanitizeHTML(err.message)}`);
        }
    }

    // ─── TELEGRAM COMMAND HANDLERS ──────────────────────────────

    /** /content [channel] — Show status dashboard */
    private async handleContentCommand(ctx: Context): Promise<void> {
        const raw = (ctx.message as any).text.replace('/content', '').trim();
        const channelName = raw.toLowerCase() || 'spidey_jr';

        if (channelName === 'happy_junior' || channelName === 'hjr' || channelName === 'youtube') {
            await ctx.sendChatAction('typing');
            try {
                const dashboard = await this.hjAgent.getStatus();
                const statusEmoji = (s: string) => {
                    switch (s) {
                        case 'draft': return '📝';
                        case 'outlined': return '📋';
                        case 'scripted': return '📜';
                        case 'voiced': return '🎙️';
                        case 'posted': return '✅';
                        case 'error': return '❌';
                        default: return '⏳';
                    }
                };

                const lines = dashboard.episodes.map(
                    (ep: any) => `${statusEmoji(ep.status)} <b>${ep.code}</b> — ${sanitizeHTML(ep.title)} [${ep.status}]`
                );

                const count = dashboard.episodes.length;
                await ctx.reply(
                    `💛 <b>Happy Junior YouTube · Content Dashboard</b>\n\n` +
                    (lines.length > 0 ? lines.join('\n') : 'No episodes in queue. Use /episode new to create one.') +
                    `\n\n📊 <b>Total Episodes:</b> ${count}\n` +
                    `📅 <b>Schedule (Disney Jr. Cadence):</b> Mon/Wed/Fri at 7AM, 3PM, 7PM EST`,
                    { parse_mode: 'HTML' }
                );
            } catch (err: any) {
                await ctx.reply(`❌ Failed to retrieve Happy Junior dashboard: ${err.message}`);
            }
            return;
        }

        // Default Spidey Jr
        const lines = this.spideyEpisodes.map(ep => {
            const videoReady = fs.existsSync(path.join(SPIDEY_VIDEO_DIR, ep.filename));
            const statusIcon = ep.posted ? '✅' : videoReady ? '🎬' : '⏳';
            const postedInfo = ep.postedAt
                ? ` · Posted ${new Date(ep.postedAt).toLocaleDateString()}`
                : videoReady ? ' · Ready to post' : ' · Waiting for video';
            return `${statusIcon} <b>${sanitizeHTML(ep.ep)}</b> ${ep.emoji} ${sanitizeHTML(ep.title)}${postedInfo}`;
        });

        const posted   = this.spideyEpisodes.filter(e => e.posted).length;
        const ready    = this.spideyEpisodes.filter(e => !e.posted && fs.existsSync(path.join(SPIDEY_VIDEO_DIR, e.filename))).length;
        const pending  = this.spideyEpisodes.filter(e => !e.posted && !fs.existsSync(path.join(SPIDEY_VIDEO_DIR, e.filename))).length;

        await ctx.reply(
            `🕷️ <b>Spidey Jr. Season 1 · TikTok Dashboard</b>\n\n` +
            lines.join('\n') +
            `\n\n📊 <b>Summary:</b> ${posted} posted · ${ready} ready · ${pending} pending video\n` +
            `📅 <b>Schedule:</b> 7AM · 3PM · 7PM EST daily\n\n` +
            `<i>Use /content happy_junior to view the YouTube channel dashboard.</i>`,
            { parse_mode: 'HTML' }
        );
    }

    /** /schedule [channel] — Show next post windows */
    private async handleScheduleCommand(ctx: Context): Promise<void> {
        const raw = (ctx.message as any).text.replace('/schedule', '').trim();
        const channelName = raw.toLowerCase();

        const now = new Date();
        const est = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));

        if (channelName === 'happy_junior' || channelName === 'hjr' || channelName === 'youtube') {
            const supabase = getSupabase();
            let nextEpStr = 'No assembled episodes ready in queue.';
            if (supabase) {
                const { data } = await supabase
                    .from('episode_queue')
                    .select('episode_code, title')
                    .eq('channel', 'happy_junior')
                    .eq('status', 'assembled')
                    .order('episode_code', { ascending: true })
                    .limit(1);
                if (data && data.length > 0) {
                    nextEpStr = `🎬 <b>Next up:</b> ${data[0].episode_code} — ${sanitizeHTML(data[0].title)}`;
                }
            }

            await ctx.reply(
                `📅 <b>Happy Junior Post Schedule (YouTube)</b>\n\n` +
                `✨ <i>Disney Jr. Cadence: Mon / Wed / Fri</i> ✨\n\n` +
                `🌅 Morning: 7:00 AM EST\n` +
                `☀️ Afternoon: 3:00 PM EST\n` +
                `🌙 Evening: 7:00 PM EST\n\n` +
                `🕐 Current EST: ${est.toLocaleTimeString('en-US', { weekday: 'short' })}, ${est.toLocaleTimeString('en-US')}\n\n` +
                `${nextEpStr}\n\n` +
                `<i>Assemble episodes via /episode post to prepare them for scheduled posting.</i>`,
                { parse_mode: 'HTML' }
            );
            return;
        }

        // Default Spidey Jr
        const nextEp = this.spideyEpisodes.find(e => !e.posted && fs.existsSync(path.join(SPIDEY_VIDEO_DIR, e.filename)));

        await ctx.reply(
            `📅 <b>Spidey Jr. Post Schedule (TikTok)</b>\n\n` +
            `🌅 Morning: 7:00 AM EST\n` +
            `☀️ Afternoon: 3:00 PM EST\n` +
            `🌙 Evening: 7:00 PM EST\n\n` +
            `🕐 Current EST: ${est.toLocaleTimeString('en-US')}\n\n` +
            (nextEp
                ? `🎬 <b>Next up:</b> ${sanitizeHTML(nextEp.ep)} — ${nextEp.emoji} ${sanitizeHTML(nextEp.title)}`
                : `⏳ <b>No ready episodes.</b> Add video files to: <code>${sanitizeHTML(SPIDEY_VIDEO_DIR)}</code>`),
            { parse_mode: 'HTML' }
        );
    }

    /** /post_now [channel] [code] — Immediately post next or specific episode */
    private async handlePostNow(ctx: Context): Promise<void> {
        const raw = (ctx.message as any).text.replace('/post_now', '').trim();
        const parts = raw.split(/\s+/).filter(Boolean);
        const channelName = parts[0]?.toLowerCase() || 'spidey_jr';
        const targetCode = parts[1]?.toUpperCase();

        if (channelName === 'happy_junior' || channelName === 'hjr' || channelName === 'youtube') {
            await ctx.sendChatAction('typing');
            const supabase = getSupabase();
            if (!supabase) {
                await ctx.reply('❌ Supabase not initialized.');
                return;
            }

            try {
                let query = supabase
                    .from('episode_queue')
                    .select('*')
                    .eq('channel', 'happy_junior');

                if (targetCode) {
                    query = query.eq('episode_code', targetCode);
                } else {
                    query = query.eq('status', 'assembled').order('episode_code', { ascending: true });
                }

                const { data, error } = await query.limit(1);
                if (error || !data || data.length === 0) {
                    await ctx.reply(targetCode 
                        ? `❌ Episode ${targetCode} not found in Happy Junior queue.`
                        : `⏳ No assembled episodes ready in Happy Junior queue to post.`
                    );
                    return;
                }

                const ep = data[0];
                const code = ep.episode_code;

                await ctx.reply(`🚀 Posting <b>${sanitizeHTML(code)}: ${sanitizeHTML(ep.title)}</b> to YouTube...`, { parse_mode: 'HTML' });

                const metadata = await this.hjAgent.generateMetadata(code);
                const youtubeService = getYouTubeService();
                const uploadResult = await youtubeService.uploadVideo(metadata);

                await supabase
                    .from('episode_queue')
                    .update({
                        youtube_video_id: uploadResult.videoId,
                        youtube_title: metadata.title,
                        youtube_description: metadata.description,
                        status: 'posted',
                        posted_at: new Date().toISOString()
                    })
                    .eq('channel', 'happy_junior')
                    .eq('episode_code', code);

                await ctx.reply(`✅ <b>[Happy Junior] ${sanitizeHTML(code)} posted!</b>\nLink: ${uploadResult.url}`, { parse_mode: 'HTML' });
            } catch (err: any) {
                await ctx.reply(`❌ Upload failed: ${err.message}`);
            }
            return;
        }

        // Default Spidey Jr
        const ep = targetCode 
            ? this.spideyEpisodes.find(e => e.ep === targetCode)
            : this.spideyEpisodes.find(e => !e.posted && fs.existsSync(path.join(SPIDEY_VIDEO_DIR, e.filename)));

        if (!ep) {
            await ctx.reply('⏳ No Spidey Jr episodes ready to post.');
            return;
        }

        await ctx.reply(`🚀 Posting <b>${sanitizeHTML(ep.ep)}: ${sanitizeHTML(ep.title)}</b> to TikTok now...`, { parse_mode: 'HTML' });
        const result = await postEpisodeToTikTok(ep);

        if (result.success) {
            ep.posted = true;
            ep.postedAt = new Date().toISOString();
            saveState(this.spideyEpisodes);
            await ctx.reply(`✅ <b>${sanitizeHTML(ep.ep)} posted!</b>\nPublish ID: <code>${sanitizeHTML(result.publishId || '')}</code>`, { parse_mode: 'HTML' });
        } else {
            await ctx.reply(`❌ Post failed: ${sanitizeHTML(result.error || 'Unknown error')}`, { parse_mode: 'HTML' });
        }
    }

    /** /mark_ready [channel] <code> — Mark an episode as ready */
    private async handleMarkReady(ctx: Context): Promise<void> {
        const raw = (ctx.message as any).text.replace('/mark_ready', '').trim();
        const parts = raw.split(/\s+/).filter(Boolean);
        const channelName = parts[0]?.toLowerCase() || 'spidey_jr';
        const targetCode = parts[1]?.toUpperCase();

        if (channelName === 'happy_junior' || channelName === 'hjr' || channelName === 'youtube') {
            if (!targetCode) {
                await ctx.reply('⚠️ Usage: /mark_ready happy_junior <code>\nExample: /mark_ready happy_junior S01E01');
                return;
            }

            await ctx.sendChatAction('typing');
            const supabase = getSupabase();
            if (!supabase) {
                await ctx.reply('❌ Supabase not initialized.');
                return;
            }

            try {
                // Fetch the episode row
                const { data, error } = await supabase
                    .from('episode_queue')
                    .select('*')
                    .eq('channel', 'happy_junior')
                    .eq('episode_code', targetCode)
                    .limit(1);

                if (error || !data || data.length === 0) {
                    await ctx.reply(`❌ Episode ${targetCode} not found in Happy Junior queue.`);
                    return;
                }

                const ep = data[0];
                const videoPath = ep.final_video || path.join(HAPPY_JUNIOR.videoDir, `${targetCode}.mp4`);

                // Create folder if missing
                fs.mkdirSync(path.dirname(videoPath), { recursive: true });

                // Create minimal placeholder file if not exists
                if (!fs.existsSync(videoPath)) {
                    fs.writeFileSync(videoPath, Buffer.from('PLACEHOLDER_VIDEO'));
                }

                // Update status in Supabase to 'assembled' (ready for post)
                await supabase
                    .from('episode_queue')
                    .update({
                        status: 'assembled',
                        final_video: videoPath
                    })
                    .eq('channel', 'happy_junior')
                    .eq('episode_code', targetCode);

                await ctx.reply(
                    `🎬 <b>[Happy Junior] ${sanitizeHTML(targetCode)}</b> marked as ready/assembled!\n\n` +
                    `⚠️ Replace <code>${sanitizeHTML(videoPath)}</code> with your actual rendered video before scheduled posting.\n\n` +
                    `📂 Path: <code>${sanitizeHTML(videoPath)}</code>`,
                    { parse_mode: 'HTML' }
                );
            } catch (err: any) {
                await ctx.reply(`❌ Error marking ready: ${err.message}`);
            }
            return;
        }

        // Default Spidey Jr
        const epCode = parts[0]?.toUpperCase(); // fallback if channel param was omitted
        const ep = this.spideyEpisodes.find(e => e.ep === (targetCode || epCode));

        if (!ep) {
            await ctx.reply(`Episode not found. Use format: /mark_ready spidey_jr S01E01`);
            return;
        }

        const placeholderPath = path.join(SPIDEY_VIDEO_DIR, ep.filename);
        fs.mkdirSync(SPIDEY_VIDEO_DIR, { recursive: true });

        if (!fs.existsSync(placeholderPath)) {
            fs.writeFileSync(placeholderPath, Buffer.from('PLACEHOLDER'));
        }

        await ctx.reply(
            `🎬 <b>${sanitizeHTML(ep.ep)}: ${sanitizeHTML(ep.title)}</b> marked as ready!\n\n` +
            `⚠️ Replace <code>${sanitizeHTML(ep.filename)}</code> with your real video.\n\n` +
            `📂 Path: <code>${sanitizeHTML(placeholderPath)}</code>`,
            { parse_mode: 'HTML' }
        );
    }
}

export const contentScheduler = new ContentSchedulerAgent();
