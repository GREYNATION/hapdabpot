import { Telegraf, Context } from 'telegraf';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { log, config } from '../core/config.js';
import { CouncilOrchestrator } from '../core/orchestrator/councilOrchestrator.js';
import { saveMessage } from '../core/memory.js';
import { listApps, stopApp, getLogs } from '../core/processManager.js';
import { manager } from '../core/manager.js';
import { websiteFactory } from '../services/websiteFactory.js';
import { PropertyScraper } from '../services/PropertyScraper.js';
import { findMotivatedSellers } from '../services/universalLeadScraper.js';
import { CrmManager } from '../core/crm.js';
import { SupabaseCrm } from '../core/supabaseCrm.js';
import { openai } from '../core/ai.js';
import { FactoryDashboardState } from '../core/factoryTypes.js';
import { DealWatcher } from '../core/dealWatcher.js';
import { MasterTraderAgent } from '../agents/MasterTraderAgent.js';
import { realEstateAgent } from '../agents/realEstateAgent.js';
import { scanMarkets, analyzeWithAI, formatMarketsReport } from '../agents/predictionMarketAgent.js';
import { 
    isGoogleEnabled, 
    driveListFiles, 
    readDoc, 
    listEmails, 
    listEvents 
} from '../agents/googleWorkspaceAgent.js';
import ffmpeg from 'fluent-ffmpeg';

export class TelegramBot {
    private bot: Telegraf;
    private ownerIds: number[];
    private isBusy: boolean = false;
    private analysisSessions: Map<number, any> = new Map();
    private masterTrader = new MasterTraderAgent();
    private council = new CouncilOrchestrator();

    public getBot(): Telegraf {
        return this.bot;
    }

    constructor() {
        if (!config.telegramToken) {
            throw new Error("TELEGRAM_BOT_TOKEN is missing in environment variables.");
        }
        this.bot = new Telegraf(config.telegramToken);
        
        this.ownerIds = config.allowedUserIds || [];
        if (config.ownerId && !this.ownerIds.includes(config.ownerId)) {
            this.ownerIds.push(config.ownerId);
        }

        this.setupHandlers();
        this.setupDashboardHandlers();

        log("[bot] Telegram handlers initialized.");
    }

    private checkOwner(ctx: Context): boolean {
        const userId = ctx.from?.id;
        if (!userId) return false;
        if (this.ownerIds.length === 0) return true;
        if (!this.ownerIds.includes(userId)) {
            log(`[bot] Unauthorized access attempt by user ${userId}`);
            ctx.reply("❌ You are not authorized to use this bot.");
            return false;
        }
        return true;
    }

    private async safeReply(ctx: Context, text: string, isMarkdown: boolean = false) {
        try {
            const options: any = isMarkdown ? { parse_mode: 'MarkdownV2' } : {};
            return await ctx.reply(text, options);
        } catch (err: any) {
            log(`[bot] Reply failed: ${err.message}`, "error");
            return await ctx.reply(text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, "\\$&"));
        }
    }

    private async handleMediaMessage(ctx: Context): Promise<{ text: string, attachments: any[] }> {
        const msg = ctx.message as any;
        const attachments: any[] = [];
        let caption = msg.caption || "";

        try {
            if (msg.photo) {
                const photo = msg.photo[msg.photo.length - 1];
                const fileLink = await ctx.telegram.getFileLink(photo.file_id);
                const response = await axios.get(fileLink.toString(), { responseType: 'arraybuffer' });
                const base64 = Buffer.from(response.data).toString('base64');
                attachments.push({
                    type: "image_url",
                    image_url: { url: `data:image/jpeg;base64,${base64}` }
                });
            }

            if (msg.video || msg.video_note) {
                const videoId = msg.video?.file_id || msg.video_note?.file_id;
                const fileLink = await ctx.telegram.getFileLink(videoId);
                const videoPath = path.join(process.cwd(), `temp_video_${videoId}.mp4`);
                const frameDir = path.join(process.cwd(), `frames_${videoId}`);
                if (!fs.existsSync(frameDir)) fs.mkdirSync(frameDir, { recursive: true });

                const videoResponse = await axios.get(fileLink.toString(), { responseType: 'arraybuffer' });
                fs.writeFileSync(videoPath, Buffer.from(videoResponse.data));

                const audioPath = path.join(process.cwd(), `temp_audio_${videoId}.mp3`);
                await new Promise((res, rej) => {
                    ffmpeg(videoPath).toFormat('mp3').on('end', res).on('error', rej).save(audioPath);
                });

                const transcription = await openai.audio.transcriptions.create({
                    file: fs.createReadStream(audioPath),
                    model: "whisper-1",
                });
                caption = (caption + "\n\n[Walkthrough Transcript]: " + transcription.text).trim();

                await new Promise((res, rej) => {
                    ffmpeg(videoPath).screenshots({ count: 3, folder: frameDir, filename: 'frame-%i.jpg' }).on('end', res).on('error', rej);
                });

                const files = fs.readdirSync(frameDir);
                for (const file of files) {
                    const base64 = fs.readFileSync(path.join(frameDir, file), { encoding: 'base64' });
                    attachments.push({
                        type: "image_url",
                        image_url: { url: `data:image/jpeg;base64,${base64}` }
                    });
                }
                fs.unlinkSync(videoPath); fs.unlinkSync(audioPath); fs.rmSync(frameDir, { recursive: true, force: true });
            }
        } catch (err: any) { log(`[media] Failed: ${err.message}`, "error"); }
        return { text: caption, attachments };
    }

    private setupHandlers() {
        this.bot.start((ctx) => {
            if (!this.checkOwner(ctx)) return;
            ctx.reply("🤖 **Hapdabot Supreme v5.0**\n\nEquipped with Vision, Real-Time Trading, and Lead Intelligence. Send me a photo, video, or voice note to begin.");
        });

        this.bot.on(["message", "voice", "video", "video_note", "photo", "document"], async (ctx) => {
            const chatId = ctx.chat?.id;
            if (!chatId) return;
            const msg = ctx.message as any;
            if (msg.text?.startsWith("/")) return;

            let userText = "";
            let attachments: any[] = [];

            try {
                if ("voice" in msg) {
                    const fileLink = await ctx.telegram.getFileLink(msg.voice.file_id);
                    const voiceResponse = await axios.get(fileLink.toString(), { responseType: "arraybuffer" });
                    const voicePath = path.join(process.cwd(), `temp_voice_${chatId}.ogg`);
                    fs.writeFileSync(voicePath, Buffer.from(voiceResponse.data));
                    const transcription = await openai.audio.transcriptions.create({
                        file: fs.createReadStream(voicePath),
                        model: "whisper-1",
                    });
                    userText = transcription.text;
                    fs.unlinkSync(voicePath);
                } else if ("video" in msg || "video_note" in msg || "photo" in msg) {
                    const media = await this.handleMediaMessage(ctx);
                    userText = media.text;
                    attachments = media.attachments;
                } else if ("document" in msg) {
                    const fileLink = await ctx.telegram.getFileLink(msg.document.file_id);
                    const docResponse = await axios.get(fileLink.toString(), { responseType: "arraybuffer" });
                    const sharedDir = path.join(process.cwd(), "data", "shared");
                    if (!fs.existsSync(sharedDir)) fs.mkdirSync(sharedDir, { recursive: true });
                    const filePath = path.join(sharedDir, msg.document.file_name);
                    fs.writeFileSync(filePath, Buffer.from(docResponse.data));
                    userText = `Uploaded document: ${msg.document.file_name}`;
                } else if ("text" in msg) {
                    userText = msg.text;
                }

                // Process council chat

                if (userText || attachments.length > 0) {
                    await ctx.sendChatAction("typing");
                    
                    if ("voice" in msg || "audio" in msg) {
                        // Handle voice-to-voice council session
                        const { text, voiceBuffer } = await this.council.chatWithVoice(userText, chatId);
                        await this.safeReply(ctx, `🤖 **Hapdabot Council**\n\n${text}`);
                        return await ctx.replyWithVoice({ source: voiceBuffer });
                    } else {
                        // Standard chat
                        const response = await this.council.chat(userText, chatId);
                        return this.safeReply(ctx, `🤖 **Hapdabot Council**\n\n${response}`);
                    }
                }
            } catch (err: any) { await this.safeReply(ctx, `⚠️ Error: ${err.message}`); }
        });
    }

    private setupDashboardHandlers() {
        this.bot.action(/retry_build_(.+)/, (ctx) => {
            const prompt = ctx.match[1];
            return this.runBuild(prompt, ctx);
        });
    }

    private renderDashboard(state: FactoryDashboardState): string {
        const getBar = (status: string) => {
            if (status === "complete") return "[##########] COMPLETE ✅";
            if (status === "running") return "[#####-----] BUILDING 🛠️";
            if (status === "failed") return "[##########] FAILED ❌";
            return "[----------] WAITING ⏳";
        };

        const lines = [
            "📑 WEBSITE FACTORY",
            "-------------------------------",
            `🏗️ Architect  ${getBar(state.stages.architect.status)}`,
            `🧵 Stitch     ${getBar(state.stages.stitch.status)}`,
            `📊 Marketing  ${getBar(state.stages.marketing.status)}`,
            `💻 Developer  ${getBar(state.stages.developer.status)}`,
            `🚀 Deploy     ${getBar(state.stages.deploy.status)}`,
            "-------------------------------",
            `Build ID: ${state.id}`,
            `Status: ${state.status.toUpperCase()}`,
            `Updated: ${new Date(state.timestamps.updatedAt).toLocaleTimeString()}`
        ];

        return lines.join("\n");
    }

    private async runBuild(prompt: string, ctx: Context) {
        if (this.isBusy) return ctx.reply("⏳ Assembly line is currently busy...");
        
        let dashboardMsg: any = null;
        const chatId = ctx.chat?.id;

        try {
            this.isBusy = true;
            
            // Initial Dashboard View
            const res = await manager(prompt);
            if (!res.tasks || res.tasks[0]?.agent !== "factory") {
                return ctx.reply("🤖 Switching to standard task executor...");
            }

            const initialStatus = "Initiating AI Factory Assembly Line...";
            dashboardMsg = await ctx.reply(
                `📑 WEBSITE FACTORY\n-------------------------------\n${initialStatus}`
            );

            // Execute via the Website Factory (imported as manager in telegram.ts)
            // Wait, I need to use the websiteFactory instance directly if manager is just a router.
            // Looking at manager.ts, it returns { tasks: [{ agent: 'factory', task: ... }] }
            // So we need to call executor or websiteFactory directly.
            
            const { executeTask } = await import("../core/executor.js");
            
            await executeTask(res.tasks[0], async (state: any) => {
                if (typeof state === 'string') return;

                try {
                    const dashboardText = this.renderDashboard(state);
                    await ctx.telegram.editMessageText(
                        chatId, 
                        dashboardMsg.message_id, 
                        undefined, 
                        dashboardText
                    ).catch(() => {});
                } catch (e) {}
            });

            await ctx.telegram.editMessageText(
                chatId, 
                dashboardMsg.message_id, 
                undefined, 
                "✅ BUILD COMPLETE\n-------------------------------\nYour website has been assembled and deployed."
            ).catch(() => {});

        } catch (e: any) { 
            if (dashboardMsg) {
                await ctx.telegram.editMessageText(
                    chatId, 
                    dashboardMsg.message_id, 
                    undefined, 
                    `❌ BUILD FAILED\n-------------------------------\nError: ${e.message}`
                ).catch(() => {});
            } else {
                ctx.reply(`❌ Build failed: ${e.message}`); 
            }
        } finally { 
            this.isBusy = false; 
        }
    }

    public launch() { DealWatcher.init(); this.bot.launch(); log("[bot] Launched Hapdabot Supreme."); }
    public stop(signal: string) { this.bot.stop(signal); }
}
