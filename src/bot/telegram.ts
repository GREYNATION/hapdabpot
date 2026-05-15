import { Telegraf, type Context } from 'telegraf';
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
import { FactoryDashboardState, DashboardStage } from '../core/factoryTypes.js';
import { WikiService } from '../services/wikiService.js';
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
import { VoiceService } from '../services/voiceService.js';
import { jarvisService } from '../services/jarvisService.js';

export class TelegramBot {
    public static instance: TelegramBot | null = null;
    private bot: Telegraf<Context>;
    private ownerIds: number[];
    private isBusy: boolean = false;
    private analysisSessions: Map<number, any> = new Map();
    private masterTrader = new MasterTraderAgent();
    private council = new CouncilOrchestrator();

    public getBot(): Telegraf<Context> {
        return this.bot;
    }

    constructor() {
        TelegramBot.instance = this;
        if (!config.telegramToken) {
            throw new Error("TELEGRAM_BOT_TOKEN is missing in environment variables.");
        }
        this.bot = new Telegraf(config.telegramToken);
        
        this.ownerIds = config.allowedUserIds || [];
        if (config.ownerId && !this.ownerIds?.includes(config.ownerId)) {
            this.ownerIds.push(config.ownerId);
        }

        this.setupHandlers();
        this.setupDashboardHandlers();

        // Initialize background watchers
        DealWatcher.init();

        log("[bot] Telegram handlers initialized.");
    }

    private checkOwner(ctx: Context): boolean {
        const userId = ctx.from?.id;
        if (!userId) return false;
        if (this.ownerIds.length === 0) return true;
        if (!this.ownerIds?.includes(userId)) {
            log(`[bot] Unauthorized access attempt by user ${userId}`);
            ctx.reply("âŒ You are not authorized to use this bot.");
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
            
            // If it's a markdown error, try regular text with escaping
            if (err.message?.includes("can't parse entities")) {
                const escaped = text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, "\\$&");
                return await ctx.reply(escaped).catch((e: any) => log(`[bot] Escaped reply also failed: ${e.message}`, "error"));
            }
            
            // Fallback for connection errors or other generic failures
            return await ctx.reply("âš ï¸ I'm having trouble responding right now. Please try again in secondary mode.");
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
                const buffer = Buffer.from(response.data);
                const base64 = buffer.toString('base64');
                attachments.push({
                    type: "image_url",
                    image_url: { url: `data:image/jpeg;base64,${base64}` }
                });

                if (caption.toLowerCase()?.includes("save")) {
                    const fileName = `Photo_${new Date().getTime()}.jpg`;
                    await WikiService.saveMedia(fileName, buffer);
                    await WikiService.saveFileNote(caption.replace(/save/gi, "").trim() || "Saved Photo", fileName, 'sources', ['photo-capture']);
                    ctx.reply(`ðŸ–¼ï¸ **Photo saved to Obsidian**`);
                }
            }

            if (msg.video || msg.video_note) {
                const videoId = msg.video?.file_id || msg.video_note?.file_id;
                const fileLink = await ctx.telegram.getFileLink(videoId);
                const videoPath = path.join(process.cwd(), `temp_video_${videoId}.mp4`);
                const frameDir = path.join(process.cwd(), `frames_${videoId}`);
                if (!fs.existsSync(frameDir)) fs.mkdirSync(frameDir, { recursive: true });

                const videoResponse = await axios.get(fileLink.toString(), { responseType: 'arraybuffer' });
                const videoBuffer = Buffer.from(videoResponse.data);
                fs.writeFileSync(videoPath, videoBuffer);

                // Use VoiceService for robust transcription
                const transcription = await VoiceService.transcribe(videoBuffer, '.mp4');
                caption = (caption + "\n\n[Walkthrough Transcript]: " + transcription).trim();

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
                fs.unlinkSync(videoPath); fs.rmSync(frameDir, { recursive: true, force: true });
            }
        } catch (err: any) { log(`[media] Failed: ${err.message}`, "error"); }
        return { text: caption, attachments };
    }

    private setupHandlers() {
        this.bot.start((ctx) => {
            if (!this.checkOwner(ctx)) return;
            ctx.reply("ðŸ¤– **Hapdabot Supreme v5.0**\n\nEquipped with Vision, Real-Time Trading, and Lead Intelligence. Send me a photo, video, or voice note to begin.");
        });

        this.bot.on(["message", "voice", "video", "video_note", "photo", "document"], async (ctx, next) => {
            const chatId = ctx.chat?.id;
            if (!chatId) return;
            const msg = ctx.message as any;
            
            // Allow commands to pass through to the router
            if (msg.text?.startsWith("/wiki")) {
                const query = msg.text.replace("/wiki", "").trim();
                if (!query) return ctx.reply("ðŸ” Please provide a search query. Example: /wiki real estate");
                
                await ctx.sendChatAction("typing");
                const results = await WikiService.search(query);
                if (results.length === 0) return ctx.reply("âŒ No wiki pages found for that query.");
                
                return ctx.reply(`ðŸ” **Wiki Search Results**:\n\n${results.map(r => `â€¢ ${r}`).join("\n")}\n\nUse the desktop Obsidian app to read the full pages.`);
            }

            if (msg.text?.startsWith("/save")) {
                const title = msg.text.replace("/save", "").trim() || `Chat_Summary_${new Date().getTime()}`;
                await ctx.sendChatAction("typing");
                
                const { getRecentMessages } = await import("../core/memory.js");
                const history = getRecentMessages(chatId, 15);
                const content = history.map(m => `### ${m.role.toUpperCase()}\n${m.content}`).join("\n\n");
                
                await WikiService.saveNote(title, content, 'sources', ['chat-log', 'telegram']);
                return ctx.reply(`âœ… **Conversation Captured**\n\nSaved to Obsidian as: **${title}**`);
            }
            
            if (msg.text?.startsWith("/note")) {
                const raw = msg.text.replace("/note", "").trim();
                if (!raw) return ctx.reply("ðŸ“” Please provide content. Format: `/note Title\\nContent` or just `/note Content` (timestamp will be title)");
                
                const parts = raw.split("\n");
                let title = parts[0];
                let content = parts.slice(1).join("\n");
                
                if (!content) {
                    content = title;
                    title = `Note_${new Date().getTime()}`;
                }
                
                await ctx.sendChatAction("typing");
                await WikiService.saveNote(title, content, 'sources', ['quick-note', 'telegram']);
                return ctx.reply(`ðŸ“” **Note Saved to Obsidian**\n\nTitle: ${title}`);
            }

            if (msg.text?.startsWith("/game")) {
                const prompt = msg.text.replace("/game", "").trim();
                if (!prompt) {
                    return ctx.reply(
                        `ðŸŽ® **Game Studio Commands**\n\n` +
                        `Use \`/game <prompt>\` to activate the studio.\n\n` +
                        `**Examples:**\n` +
                        `â€¢ \`/game brainstorm a roguelike\`\n` +
                        `â€¢ \`/game design a crafting system\`\n` +
                        `â€¢ \`/game review my core loop\`\n` +
                        `â€¢ \`/game plan a sprint for combat\`\n` +
                        `â€¢ \`/game scope check my RPG\`\n\n` +
                        `**Available workflows:** brainstorm, design-system, map-systems, art-bible, create-architecture, sprint-plan, code-review, qa-plan, release-checklist, and 60+ more.`
                    );
                }

                await ctx.sendChatAction("typing");

                try {
                    const { text, voiceBuffer } = await this.council.chatWithVoice(
                        `[GAME STUDIO REQUEST] ${prompt}`, chatId
                    );
                    await this.safeReply(ctx, `ðŸŽ® **Game Studio**\n\n${text}`);
                    if (voiceBuffer) {
                        return await ctx.replyWithVoice({ source: voiceBuffer });
                    }
                } catch (err: any) {
                    log(`[game] Studio error: ${err.message}`, "error");
                    return this.safeReply(ctx, `ðŸŽ® **Game Studio Error**: ${err.message}`);
                }
                return;
            }

            if (msg.text?.startsWith("/")) {
                return next();
            }

            let userText = "";
            let attachments: any[] = [];

            try {
                if ("voice" in msg) {
                    const fileLink = await ctx.telegram.getFileLink(msg.voice.file_id);
                    const buffer = await VoiceService.downloadTelegramFile(fileLink.toString());
                    userText = await VoiceService.transcribe(buffer, '.oga');
                    
                    if (userText.toLowerCase()?.includes("save this") || userText.toLowerCase()?.includes("note this")) {
                        const noteText = userText.replace(/save this/gi, "").replace(/note this/gi, "").trim();
                        const title = `Voice_Note_${new Date().getTime()}`;
                        await WikiService.saveNote(title, noteText, 'sources', ['voice-capture', 'telegram']);
                        await ctx.reply(`ðŸŽ™ï¸ **Voice Note Captured to Obsidian**\n\n"${noteText.substring(0, 50)}..."`);
                    }
                } else if ("video" in msg || "video_note" in msg || "photo" in msg) {
                    const media = await this.handleMediaMessage(ctx);
                    userText = media.text;
                    attachments = media.attachments;
                } else if ("document" in msg) {
                    const fileLink = await ctx.telegram.getFileLink(msg.document.file_id);
                    const docResponse = await axios.get(fileLink.toString(), { responseType: "arraybuffer" });
                    const buffer = Buffer.from(docResponse.data);
                    
                    const sharedDir = path.join(process.cwd(), "data", "shared");
                    if (!fs.existsSync(sharedDir)) fs.mkdirSync(sharedDir, { recursive: true });
                    const filePath = path.join(sharedDir, msg.document.file_name);
                    fs.writeFileSync(filePath, buffer);
                    
                    userText = `Uploaded document: ${msg.document.file_name}`;

                    if (msg.caption?.toLowerCase()?.includes("save")) {
                        await WikiService.saveMedia(msg.document.file_name, buffer);
                        await WikiService.saveFileNote(msg.caption.replace(/save/gi, "").trim() || msg.document.file_name, msg.document.file_name, 'sources', ['file-capture']);
                        ctx.reply(`ðŸ“Ž **File saved to Obsidian**: ${msg.document.file_name}`);
                    }
                } else if ("text" in msg) {
                    userText = msg.text;
                }

                // Process council chat

                if (userText || attachments.length > 0) {
                    await ctx.sendChatAction("typing");
                    
                    // Auto-capture to Obsidian Inbox (mirrors Python logic provided)
                    if (userText && userText.length > 10 && !msg.text?.startsWith("/") && !userText.toLowerCase()?.includes("save this")) {
                        const datePrefix = new Date().toISOString().split('T')[0];
                        const safeTitle = userText.substring(0, 30).replace(/[^a-z0-9]/gi, " ").trim();
                        const noteTitle = `${datePrefix}_${safeTitle || "Inbox_Note"}`;
                        await WikiService.saveNote(noteTitle, userText, 'sources', ['auto-capture', 'inbox']);
                        log(`[bot] Auto-captured message to Obsidian Inbox: ${noteTitle}`);
                    }
                    
                    try {
                        const { text, voiceBuffer } = await this.council.chatWithVoice(userText, chatId);
                        await this.safeReply(ctx, `ðŸ¤– **Hapdabot Council**\n\n${text}`);
                        if (voiceBuffer) {
                            return await ctx.replyWithVoice({ source: voiceBuffer });
                        }
                    } catch (councilErr: any) {
                        log(`[council] Processing failed: ${councilErr.message}`, "error");
                        console.error("[CORTEX ERROR]:", councilErr); // Log full stack for "Logic Tear" debugging
                        
                        if (councilErr.message?.toLowerCase()?.includes("rate limit") || councilErr.message?.includes("429")) {
                            return await this.safeReply(ctx, "â³ **The Council is currently saturated.**\n\nRate limits reached. I'll be back in ~60 seconds once the circuit breaker resets.");
                        }
                        return await this.safeReply(ctx, "ðŸ¤– **The Council encountered a logic tear.**\n\nI've logged the error. Trying to recover...");
                    }
                }
            } catch (err: any) { 
                log(`[bot] Top-level handler catch: ${err.message}`, "error");
                await this.safeReply(ctx, `âš ï¸ **System Alert**: ${err.message}`); 
            }
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
            if (status === "complete") return "[##########] COMPLETE âœ…";
            if (status === "running") return "[#####-----] BUILDING ðŸ› ï¸";
            if (status === "failed") return "[##########] FAILED âŒ";
            return "[----------] WAITING â³";
        };

        const lines = [
            "ðŸ“‘ WEBSITE FACTORY",
            "-------------------------------",
            `ðŸ—ï¸ Architect  ${getBar(state.stages.architect.status)}`,
            `ðŸ§µ Stitch     ${getBar(state.stages.stitch.status)}`,
            `ðŸ“Š Marketing  ${getBar(state.stages.marketing.status)}`,
            `ðŸ’» Developer  ${getBar(state.stages.developer.status)}`,
            `ðŸš€ Deploy     ${getBar(state.stages.deploy.status)}`,
            "-------------------------------",
            `Build ID: ${state.id}`,
            `Status: ${state.status.toUpperCase()}`,
            `Updated: ${new Date(state.timestamps.updatedAt).toLocaleTimeString()}`
        ];

        return lines.join("\n");
    }

    private async runBuild(prompt: string, ctx: Context) {
        if (this.isBusy) return ctx.reply("â³ Assembly line is currently busy...");
        
        let dashboardMsg: any = null;
        const chatId = ctx.chat?.id;

        try {
            this.isBusy = true;
            
            // Initial Dashboard View
            const res = await manager(prompt);
            if (!res.tasks || res.tasks[0]?.agent !== "factory") {
                return ctx.reply("ðŸ¤– Switching to standard task executor...");
            }

            const initialStatus = "Initiating AI Factory Assembly Line...";
            dashboardMsg = await ctx.reply(
                `ðŸ“‘ WEBSITE FACTORY\n-------------------------------\n${initialStatus}`
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
                "âœ… BUILD COMPLETE\n-------------------------------\nYour website has been assembled and deployed."
            ).catch(() => {});

        } catch (e: any) { 
            if (dashboardMsg) {
                await ctx.telegram.editMessageText(
                    chatId, 
                    dashboardMsg.message_id, 
                    undefined, 
                    `âŒ BUILD FAILED\n-------------------------------\nError: ${e.message}`
                ).catch(() => {});
            } else {
                ctx.reply(`âŒ Build failed: ${e.message}`); 
            }
        } finally { 
            this.isBusy = false; 
        }
    }

    public async launch(retries = 10, delayMs = 5000) {

        try {
            // dropPendingUpdates: true fixes 409 Conflict on Railway redeploys
            // (old instance is still polling when new one starts)
            await this.bot.launch({ dropPendingUpdates: true });
            log('[bot] Launched Hapdabot Supreme (conflict-safe mode).');
        } catch (err: any) {
            log(`[bot] Launch error: ${err.message}`, 'error');
            
            if (err.message?.includes('409') && retries > 0) {
                log(`[bot] Conflict detected (another instance running). Retrying in ${delayMs/1000}s... (${retries} retries left)`);
                setTimeout(() => this.launch(retries - 1, delayMs * 1.2), delayMs);
            } else {
                log(`[bot] Fatal launch failure or retries exhausted.`, 'error');
            }
        }

        // Recover from polling errors without crashing
        this.bot.catch((err: any) => {
            log(`[bot] Polling error (non-fatal): ${err.message}`, 'error');
        });
    }
    public stop(signal: string) { this.bot.stop(signal); }
}

