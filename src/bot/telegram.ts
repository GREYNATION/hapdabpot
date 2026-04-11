import { Telegraf, Context } from 'telegraf';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { log, config } from '../core/config.js';
import { orchestrator } from '../agents/orchestrator/OrchestratorAgent.js';
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
        this.setupAnalysisHandlers();
        this.setupLeadGenHandlers();
        this.setupStatusHandlers();
        this.setupAppHandlers();
        this.setupBuildHandler();
        this.setupDashboardHandlers();
        this.setupTradingHandlers();
        this.setupGoogleHandlers();

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
                    model: "whisper-large-v3",
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
                        model: "whisper-large-v3",
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

                if (this.analysisSessions.has(chatId) && userText) return this.processAnalysisStep(ctx, chatId, userText);

                if (userText || attachments.length > 0) {
                    await ctx.sendChatAction("typing");
                    const res = await orchestrator.route(userText, attachments);
                    return this.safeReply(ctx, `🤖 HapdaBot\n\n${res.response}`);
                }
            } catch (err: any) { await this.safeReply(ctx, `⚠️ Error: ${err.message}`); }
        });
    }

    private setupAnalysisHandlers() {
        this.bot.command('analyze', (ctx) => {
            if (!this.checkOwner(ctx)) return;
            const address = ctx.message.text.split(" ").slice(1).join(" ");
            if (!address) return ctx.reply("🏠 Usage: /analyze [address]");
            this.analysisSessions.set(ctx.chat.id, { address, step: 'arv' });
            ctx.reply(`📋 Analyzing: ${address}\n\nWhat is the estimated ARV?`);
        });
    }

    private async processAnalysisStep(ctx: Context, chatId: number, text: string) {
        const session = this.analysisSessions.get(chatId);
        const val = parseFloat(text.replace(/[^0-9.]/g, ""));
        if (session.step === 'arv') { session.arv = val; session.step = 'repairs'; return ctx.reply("🛠️ Estimated Repair Cost?"); }
        if (session.step === 'repairs') { session.repairs = val; session.step = 'price'; return ctx.reply("💰 Asking Price?"); }
        if (session.step === 'price') {
            const mao = (session.arv * 0.7) - session.repairs;
            ctx.reply(`📊 Report: ${session.address}\n\nMAO: $${mao.toLocaleString()}\nAsking: $${val.toLocaleString()}\n\n${val <= mao ? "🔥 GREAT DEAL" : "⚠️ MARGINAL"}`);
            this.analysisSessions.delete(chatId);
        }
    }

    private setupLeadGenHandlers() {
        this.bot.command('scrape', async (ctx) => {
            if (!this.checkOwner(ctx)) return;
            await ctx.reply("🔎 Searching for high-motivation signals in target markets...");
            try {
                const leads = await findMotivatedSellers();
                await ctx.reply(`✅ Found ${leads.length} fresh prospects. Enriched in CRM.`);
            } catch (err: any) { ctx.reply(`⚠️ Scraping failed: ${err.message}`); }
        });

        this.bot.command('leads', async (ctx) => {
            if (!this.checkOwner(ctx)) return;
            try {
                const leads = CrmManager.listDeals(10);
                const msg = leads.map((l: any) => `📍 ${l.address} | Score: ${l.dealScore || 'N/A'}`).join("\n");
                ctx.reply(`📂 **Active Leads:**\n\n${msg || "No leads in database."}`);
            } catch (err: any) { ctx.reply(`⚠️ CRM Error: ${err.message}`); }
        });
    }

    private setupStatusHandlers() {
        this.bot.command('stats', (ctx) => {
            if (!this.checkOwner(ctx)) return;
            try {
                const stats = CrmManager.getStats();
                const apps = listApps();
                ctx.reply(`📊 **System Health**\n\nLeads: ${stats.leads}\nContracts: ${stats.contracts}\nApps: ${apps.length} active\nBuilds: ${this.isBusy ? 'Busy' : 'Idle'}`);
            } catch (err: any) { ctx.reply(`⚠️ Stats failed: ${err.message}`); }
        });
    }

    private setupAppHandlers() {
        this.bot.command("apps", (ctx) => {
            if (!this.checkOwner(ctx)) return;
            const apps = listApps();
            const list = apps.map((a: any) => `🟢 ${a.id} (P:${a.port})`).join("\n");
            ctx.reply(`📋 **Managed Apps:**\n\n${list || "None"}`);
        });
        this.bot.command("stop", (ctx) => {
            if (!this.checkOwner(ctx)) return;
            const id = ctx.message.text.split(" ")[1];
            if (!id) return ctx.reply("❌ Usage: /stop [appId]");
            ctx.reply(stopApp(id));
        });
    }

    private setupBuildHandler() {
        this.bot.command("build", (ctx) => {
            if (!this.checkOwner(ctx)) return;
            const prompt = ctx.message.text.split(" ").slice(1).join(" ");
            if (!prompt) return ctx.reply("🏗️ Usage: /build [task]");
            this.runBuild(prompt, ctx);
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

    private setupTradingHandlers() {
        this.bot.command('trade', async (ctx) => {
            if (!this.checkOwner(ctx)) return;
            try {
                const { liveBalance } = await this.masterTrader.getLiveAccountState();
                ctx.reply(`💹 **Tradovate Account**\n\nBalance: $${liveBalance?.marginBalance?.toFixed(2) ?? '0.00'}`);
            } catch (e: any) { ctx.reply(`⚠️ Tradovate error: ${e.message}`); }
        });
        this.bot.command('markets', async (ctx) => {
            if (!this.checkOwner(ctx)) return;
            await ctx.reply("📡 Scanning prediction markets...");
            try {
                const { filtered } = await scanMarkets();
                ctx.reply(formatMarketsReport(filtered));
            } catch (err: any) { ctx.reply(`⚠️ Market scan failed: ${err.message}`); }
        });
    }

    private setupGoogleHandlers() {
        this.bot.command('google', async (ctx) => {
            if (!this.checkOwner(ctx)) return;
            if (!isGoogleEnabled()) return ctx.reply("⚠️ Google not configured.");
            const [action, ...args] = ctx.message.text.split(" ").slice(1);
            if (!action) return ctx.reply("📂 Usage: /google [drive|gmail|cal] [args]");
            try {
                switch (action.toLowerCase()) {
                    case 'drive': ctx.reply(await driveListFiles(args.join(" "))); break;
                    case 'gmail': ctx.reply(await listEmails(args.join(" ") || "is:unread")); break;
                    case 'cal': ctx.reply(await listEvents(7)); break;
                    default: ctx.reply("❌ Unknown service: drive, gmail, cal.");
                }
            } catch (err: any) { ctx.reply(`⚠️ Google error: ${err.message}`); }
        });
    }

    public launch() { DealWatcher.init(); this.bot.launch(); log("[bot] Launched Hapdabot Supreme."); }
    public stop(signal: string) { this.bot.stop(signal); }
}
