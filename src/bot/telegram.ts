import { Telegraf, Context, Markup } from "telegraf";
import { CrmManager } from "../core/crm.js";
import { ai, manager } from "../core/manager.js";
import { simpleChat } from "../core/ai.js";
import { executeTask } from "../core/executor.js";
import { initDb, saveMessage } from "../core/memory.js";
import { storeMemory, getMemories, chat as supabaseChat, isSupabaseEnabled } from "../core/supabaseMemory.js";
import { openai, config, log } from "../core/config.js";
import { DashboardPatch, FactoryDashboardState, DashboardStatus } from "../core/factoryTypes.js";
// ... existing imports ...
import { SKILLS } from "../core/skills.js";
import { ResearcherAgent } from "../agents/researcherAgent.js";
import { MarketerAgent } from "../agents/marketerAgent.js";
import { MasterTraderAgent } from "../agents/MasterTraderAgent.js";
import { orchestrator } from "../agents/orchestratorAgent.js";
import { realEstateAgent } from "../agents/realEstateAgent.js";
import { scanMarkets, formatMarketsReport, analyzeWithAI } from "../agents/predictionMarketAgent.js";
import {
    driveListFiles, driveSearch, readDoc, createDoc,
    createPresentation, createSheet, appendSheet,
    listEmails, sendEmail, listEvents, createEvent,
    isGoogleEnabled
} from "../agents/googleWorkspaceAgent.js";
import { PropertyScraper } from "../core/scraper.js";
import { findMotivatedSellers, formatLeads } from "../services/universalLeadScraper.js";
import { SkipTracer } from "../core/skiptrace.js";
import { executeContactSeller } from "../services/outreachService.js";
import fs from "fs";
import path from "path";
import axios from "axios";
import ffmpeg from "fluent-ffmpeg";
import { agentMail } from "../services/agentmail.js";
import { getTasks } from "../core/taskMemory.js";
import { listApps, stopApp, getLogs } from "../core/processManager.js";
import { DealWatcher } from '../core/dealWatcher.js';
import { setupInvoiceHandlers } from './invoiceHandlers.js';
import { registerLeadAlertHandlers } from '../cron/leadAlerts.js';
import { SupabaseCrm } from "../core/supabaseCrm.js";

interface AnalysisSession {
    address: string;
    step: 'arv' | 'repairs' | 'askingPrice';
    arv?: number;
    repairs?: number;
}

export class TelegramBot {
    private bot: Telegraf;
    private marketer = new MarketerAgent();
    private masterTrader = new MasterTraderAgent();
    private analysisSessions = new Map<number, AnalysisSession>();
    private isBusy = false;

    public getBot(): Telegraf {
        return this.bot;
    }

    constructor() {
        if (!config.telegramToken) throw new Error("TELEGRAM_BOT_TOKEN is missing");

        this.bot = new Telegraf(config.telegramToken);

        initDb();
        this.setupMiddleware();
        this.setupCrmHandlers();
        this.setupSkillHandlers();
        this.setupAnalysisHandlers();
        this.setupLeadGenHandlers();
        this.setupStatusHandlers();
        this.setupTaskHandlers();
        this.setupProcessHandlers();
        this.setupBuildHandler();
        this.setupTradingHandlers();
        this.setupApprovalHandlers();
        setupInvoiceHandlers(this.bot);
        registerLeadAlertHandlers(this.bot);
        this.setupHandlers();

        // Global Bot Error Handler
        this.bot.catch((err: any, ctx: Context) => {
            log(`[bot] ERROR for ${ctx.updateType}: ${err.message}`, "error");
            console.error(err);
        });
    }

    private setupMiddleware() {
        this.bot.use(async (ctx: any, next) => {
            const userId = ctx.from?.id;
            const isOwner = userId === config.ownerId;

            log(`[security] Checking access for userID: ${userId}. Owner: ${isOwner}`);

            // Allow anyone in the allowed list, but set an owner flag
            if (userId && config.allowedUserIds.includes(Number(userId))) {
                ctx.state.isOwner = isOwner;
                return next();
            }

            log(`[security] Blocked access from unauthorized user ID: ${userId}`, "warn");
        });
    }

    private checkOwner(ctx: any): boolean {
        if (!ctx.state.isOwner) {
            this.safeReply(ctx, "Ã¢Å¡Â Ã¯Â¸Â Access Denied: This command requires Owner privileges.");
            return false;
        }
        return true;
    }

    private renderProgressBar(status: DashboardStatus): string {
        switch (status) {
            case "complete": return "[â–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆ] DONE";
            case "running":  return "[â–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–‘â–‘â–‘â–‘] RUNNING";
            case "failed":   return "[â–ˆâ–ˆâ–ˆâ–ˆâ–‘â–‘â–‘â–‘â–‘â–‘] FAILED";
            case "pending":  
            default:         return "[â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘] WAITING";
        }
    }

    private renderDashboard(state: FactoryDashboardState): string {
        return `
ðŸ­ WEBSITE FACTORY
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ðŸ§  Architect     ${this.renderProgressBar(state.stages.architect.status)}
ðŸŽ¨ Stitch        ${this.renderProgressBar(state.stages.stitch.status)}
ðŸ“ Marketing     ${this.renderProgressBar(state.stages.marketing.status)}
ðŸ’» Developer     ${this.renderProgressBar(state.stages.developer.status)}
ðŸš€ Deployment    ${this.renderProgressBar(state.stages.deploy.status)}

Status: ${state.status.toUpperCase()}
Build ID: ${state.id}
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
${state.logs.slice(-3).join("\n")}
        `.trim();
    }

    private async safeReply(ctx: any, text: string, isMarkdown: boolean = false) {
        if (!text) return;
        const CHUNK_SIZE = 4000;

        if (text.length <= CHUNK_SIZE) {
            return isMarkdown ? ctx.replyWithMarkdownV2(text) : ctx.reply(text);
        }

        log(`[bot] Message too long (${text.length} chars). Splitting into chunks...`, "warn");

        let start = 0;
        while (start < text.length) {
            let end = start + CHUNK_SIZE;
            if (end > text.length) end = text.length;

            // Try to split at the last newline within the chunk to be cleaner
            if (end < text.length) {
                const lastNewline = text.lastIndexOf("\n", end);
                if (lastNewline > start) {
                    end = lastNewline;
                }
            }

            const chunk = text.substring(start, end).trim();
            if (chunk) {
                try {
                    if (isMarkdown) {
                        await ctx.replyWithMarkdownV2(chunk);
                    } else {
                        await ctx.reply(chunk);
                    }
                } catch (e: any) {
                    log(`[error] Failed to send chunk: ${e.message}`, "error");
                    // Fallback to plain text if markdown fails on a chunk
                    if (isMarkdown) await ctx.reply(chunk);
                }
            }
            start = end;
            // Small delay to prevent rate hitting
            if (start < text.length) await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    private setupCrmHandlers() {
        // [COMMAND] /scan [city] - Scans for new deals
        this.bot.command("scan", async (ctx) => {
            if (!this.checkOwner(ctx)) return;
            const args = ctx.message.text.split(" ").slice(1);
            const city = args.join(" ").trim() || "Camden NJ";

            await this.safeReply(ctx, `Ã°Å¸Â¤â€“ Starting market scan for "${city}"... this may take a moment.`);

            try {
                const count = await SupabaseCrm.scanMarket(city);
                return this.safeReply(ctx, `Ã¢Å“â€¦ Found ${count} new potential deals in ${city}. All leads have been analyzed and saved to Supabase.`);
            } catch (err: any) {
                log(`[bot] /scan failed: ${err.message}`, "error");
                return this.safeReply(ctx, `Ã¢ Å’ Market scan failed: ${err.message}`);
            }
        });

        this.bot.command("deal", async (ctx) => {
            if (!this.checkOwner(ctx)) return;
            const args = ctx.message.text.split(" ").slice(1);
            const subCommand = args[0]?.toLowerCase();

            switch (subCommand) {
                case "add": {
                    const params = args.slice(1).join(" ").split("|").map(s => s.trim());
                    if (params.length < 1) {
                        return this.safeReply(ctx, "Ã¢ÂÅ’ Usage: /deal add [address] | [seller] | [phone] | [arv] | [repairs]");
                    }
                    const [address, seller, phone, arv, repairs] = params;

                    // 1. Save to SQLite (Legacy)
                    const dealId = CrmManager.addDeal({
                        address,
                        seller_name: seller,
                        seller_phone: phone,
                        arv: parseFloat(arv) || 0,
                        repair_estimate: parseFloat(repairs) || 0
                    });

                    // 2. Save to Supabase (New)
                    await SupabaseCrm.insertDeal({
                        address,
                        seller,
                        phone,
                        arv: parseFloat(arv) || 0,
                        repairs: parseFloat(repairs) || 0
                    });

                    const deal = CrmManager.getDeal(dealId);
                    return this.safeReply(ctx, `Ã¢Å“â€¦ Deal added to both CRM and Supabase!\nID: ${dealId}\nAddress: ${address}\nMax Offer: $${deal?.max_offer.toLocaleString()}`);
                }

                case "update": {
                    const id = parseInt(args[1]);
                    const updateStr = args.slice(2).join(" ");
                    if (isNaN(id) || !updateStr.includes("=")) {
                        return this.safeReply(ctx, "Ã¢ÂÅ’ Usage: /deal update [id] [field]=[value]\nFields: status, buyer, arv, repairs, profit, seller, phone");
                    }
                    const [fieldRaw, value] = updateStr.split("=").map(s => s.trim());
                    const fieldMap: any = {
                        status: "status",
                        buyer: "assigned_buyer",
                        arv: "arv",
                        repairs: "repair_estimate",
                        profit: "profit",
                        seller: "seller_name",
                        phone: "seller_phone"
                    };
                    const field = fieldMap[fieldRaw.toLowerCase()];
                    if (!field) return this.safeReply(ctx, `Ã¢ÂÅ’ Unknown field: ${fieldRaw}`);

                    let parsedValue: any = value;
                    if (["arv", "repair_estimate", "profit"].includes(field)) parsedValue = parseFloat(value);

                    try {
                        CrmManager.updateDeal(id, { [field]: parsedValue });
                        const deal = CrmManager.getDeal(id);
                        return this.safeReply(ctx, `Ã¢Å“â€¦ Deal ${id} updated!\nNew ${fieldRaw}: ${value}\nNew Max Offer: $${deal?.max_offer.toLocaleString()}`);
                    } catch (e: any) {
                        return this.safeReply(ctx, `Ã¢ÂÅ’ Error: ${e.message}`);
                    }
                }

                case "list": {
                    const deals = CrmManager.listDeals();
                    if (deals.length === 0) return this.safeReply(ctx, "Ã°Å¸â€œâ€š No deals found.");
                    const list = deals.map(d => `ID ${d.id}: ${d.address} (${d.status.toUpperCase()})`).join("\n");
                    return this.safeReply(ctx, `Ã°Å¸â€œâ€¹ Recent Deals:\n${list}`);
                }

                case "view": {
                    const id = parseInt(args[1]);
                    if (isNaN(id)) return this.safeReply(ctx, "Ã¢ÂÅ’ Usage: /deal view [id]");
                    const deal = CrmManager.getDeal(id);
                    if (!deal) return this.safeReply(ctx, "Ã¢ÂÅ’ Deal not found.");

                    const msg = `Ã°Å¸ÂÂ  Deal #${deal.id}\n` +
                        `Ã°Å¸â€œÂ Address: ${deal.address}\n` +
                        `Ã°Å¸â€˜Â¤ Seller: ${deal.seller_name || "N/A"} (${deal.seller_phone || "N/A"})\n` +
                        `Ã°Å¸â€™Â° ARV: $${deal.arv.toLocaleString()}\n` +
                        `Ã°Å¸â€ºÂ  Repairs: $${deal.repair_estimate.toLocaleString()}\n` +
                        `Ã°Å¸â€œâ€° Max Offer: $${deal.max_offer.toLocaleString()}\n` +
                        `Ã°Å¸â€œÅ  Status: ${deal.status.toUpperCase()}\n` +
                        `Ã°Å¸Â¤Â Buyer: ${deal.assigned_buyer || "Unassigned"}\n` +
                        `Ã°Å¸â€™Âµ Profit: $${deal.profit.toLocaleString()}`;
                    return this.safeReply(ctx, msg);
                }

                case "stats": {
                    const stats = await SupabaseCrm.getStats();
                    const msg = `Ã°Å¸â€œÅ  **CRM DASHBOARD (Supabase)**\n` +
                        `Ã¢â€ Ã¢â€ Ã¢â€ Ã¢â€ Ã¢â€ Ã¢â€ Ã¢â€ Ã¢â€ Ã¢â€ Ã¢â€ Ã¢â€ Ã¢â€ Ã¢â€ Ã¢â€ Ã¢â€ Ã¢â€ \n` +
                        `Ã°Å¸â€œâ€¹ Total Leads: ${stats.leads}\n` +
                        `Ã°Å¸Â¤  Under Contract: ${stats.underContract}\n` +
                        `Ã°Å¸â€™Â° Total Revenue: $${stats.revenue.toLocaleString()}`;
                    return this.safeReply(ctx, msg, true);
                }

                default:
                    return this.safeReply(ctx, "Ã°Å¸ÂÂ¢ Real Estate Wholesale CRM\n\nUsage:\n/deal add [addr] | [seller] | [phone] | [arv] | [repairs]\n/deal list\n/deal view [id]\n/deal update [id] [field]=[value]");
            }
        });
        
        // [COMMAND] /contact [id] - Generate and log outreach for a specific deal
        this.bot.command("contact", async (ctx) => {
            if (!this.checkOwner(ctx)) return;
            const args = ctx.message.text.split(" ").slice(1);
            const dealId = parseInt(args[0]);

            if (isNaN(dealId)) {
                return this.safeReply(ctx, "Ã¢ Å’ Usage: /contact [dealId]\nExample: /contact 5");
            }

            await ctx.sendChatAction("typing");

            try {
                const deal = CrmManager.getDeal(dealId);
                if (!deal) return this.safeReply(ctx, `Ã¢ Å’ Deal #${dealId} not found.`);

                const message = await this.generateSellerMessage(deal);

                // Telemetry: Log the outreach event
                const { logEvent } = await import("../core/telemetry.js");
                await logEvent({
                    type: "outreach_sent",
                    source: "crm",
                    message: `Personalized contact generated for ${deal.address}`,
                    data: {
                        deal_id: deal.id,
                        address: deal.address,
                        seller: deal.seller_name
                    }
                });

                return this.safeReply(ctx, `Ã°Å¸â€œÂ§ **OUTREACH GENERATED**\n\n${message}`, true);
            } catch (err: any) {
                log(`[bot] /contact failed: ${err.message}`, "error");
                return this.safeReply(ctx, `Ã¢ Å’ Error contacting seller: ${err.message}`);
            }
        });

        // [COMMAND] /deals - List recent telemetry-logged deals
        this.bot.command("deals", async (ctx) => {
            if (!this.checkOwner(ctx)) return;
            await ctx.sendChatAction("typing");
            
            try {
                const supabase = (await import("../core/supabaseMemory.js")).getSupabase();
                const { data: events, error } = await supabase
                    .from("bot_events")
                    .select("*")
                    .eq("type", "deal_found")
                    .order("created_at", { ascending: false })
                    .limit(10);

                if (error) throw error;
                
                const response = this.formatDealsTelemetry(events || []);
                return this.safeReply(ctx, response, true);
            } catch (err: any) {
                log(`[bot] /deals failed: ${err.message}`, "error");
                return this.safeReply(ctx, `Ã¢ Å’ Failed to fetch deals: ${err.message}`);
            }
        });

        // Invoice command
        this.bot.command("invoice", async (ctx) => {
            if (!this.checkOwner(ctx)) return;
            const args = ctx.message.text.split(" ").slice(1);
            const subCommand = args[0]?.toLowerCase();

            switch (subCommand) {
                case "list": {
                    const pendingInvoices = (global as any).pendingInvoices || [];
                    if (pendingInvoices.length === 0) {
                        return this.safeReply(ctx, "Ã°Å¸â€œÂ­ No pending invoices.");
                    }

                    const list = pendingInvoices.map((inv: any) =>
                        `Ã°Å¸â€™Â° ${inv.address} - $${inv.amount.toLocaleString()} (Deal #${inv.dealId})`
                    ).join("\n");

                    return this.safeReply(ctx, `Ã°Å¸â€œâ€¹ *Pending Invoices*\n\n${list}`, true);
                }

                case "send": {
                    const dealId = parseInt(args[1]);
                    if (isNaN(dealId)) {
                        return this.safeReply(ctx, "Ã¢ÂÅ’ Usage: /invoice send [dealId]");
                    }

                    await this.safeReply(ctx, `Ã°Å¸â€â€ž Sending invoice for deal #${dealId}...`);
                    const success = await DealWatcher.confirmAndSendInvoice(dealId);

                    if (success) {
                        return this.safeReply(ctx, `Ã¢Å“â€¦ Invoice sent for deal #${dealId}!`);
                    } else {
                        return this.safeReply(ctx, `Ã¢ÂÅ’ Failed to send invoice. Check Stripe configuration.`);
                    }
                }

                case "test": {
                    // Create a test deal and move to Under Contract
                    const dealId = CrmManager.addDeal({
                        address: '456 Test Ave, Queens, NY 11375',
                        seller_name: 'Test Seller',
                        arv: 400000,
                        repair_estimate: 40000,
                        status: 'lead'
                    });

                    CrmManager.updateDeal(dealId, { status: 'contract' });
                    await DealWatcher.checkDealStatus(dealId);

                    return this.safeReply(ctx, `Ã¢Å“â€¦ Test deal #${dealId} created and set to "Under Contract". Invoice should be ready for confirmation.`);
                }

                default:
                    return this.safeReply(ctx, "Ã°Å¸â€™Â° Invoice Management\n\nUsage:\n/invoice list - Show pending invoices\n/invoice send [dealId] - Send invoice for deal\n/invoice test - Create test deal and invoice");
            }
        });
    }

    private setupSkillHandlers() {
        this.bot.command("skills", async (ctx) => {
            const list = SKILLS.map(s => {
                // Escape MarkdownV2 special characters
                const name = s.name.replace(/[_*[\]()~`>#+\-=|{}.!]/g, "\\$&");
                const id = s.id.replace(/[_*[\]()~`>#+\-=|{}.!]/g, "\\$&");
                const desc = s.description.replace(/[_*[\]()~`>#+\-=|{}.!]/g, "\\$&");
                return `Ã¢â‚¬Â¢ *${name}* (\`${id}\`): ${desc}`;
            }).join("\n");

            const message = `Ã°Å¸â€ºÂ  *Gravity Claw Specialist Skills*\n\n${list}\n\n_Ask about these topics to trigger them automatically\\!_`;
            return this.safeReply(ctx, message, true);
        });
    }

    private setupAnalysisHandlers() {
        this.bot.command("analyze", async (ctx) => {
            if (!this.checkOwner(ctx)) return;
            const address = ctx.message.text.split(" ").slice(1).join(" ").trim();
            if (!address) {
                return this.safeReply(ctx, "Ã°Å¸ÂÂ  Please provide an address to analyze.\nUsage: /analyze [address]");
            }

            await this.safeReply(ctx, `Ã°Å¸â€Â Analyzing ${address}... searching for comparables...`);

            // Use Researcher to get snippets
            const researcher = new ResearcherAgent();
            const searchResults = await researcher.executeTool("web_search", { query: `${address} recent sales listings` });

            await this.safeReply(ctx, searchResults);

            this.analysisSessions.set(ctx.chat.id, {
                address,
                step: 'arv'
            });

            await this.safeReply(ctx, "Ã°Å¸â€œË† Got the data! Now, let's look at the numbers.\n\nWhat is the **After Repair Value (ARV)** for this property?");
        });
    }

    private setupHandlers() {
        this.bot.on(["message", "voice", "video", "video_note", "photo", "document"], async (ctx) => {
            const chatId = (ctx.chat as any)?.id;
            if (!chatId) return;
            const from = ctx.from;
            const msg = ctx.message as any;

            let userText = "";
            let isVoiceInput = false;
            let visualContext: any = null;

            log(`[bot] Update received! Type: ${ctx.updateType}, Chat: ${chatId}, From: ${from?.id}`);

            try {
                if ("voice" in msg) {
                    isVoiceInput = true;
                    if (msg.voice.file_size && msg.voice.file_size > 20 * 1024 * 1024) {
                        throw new Error("Voice file is too large (>20MB) to download. Please send a shorter message.");
                    }
                    await ctx.sendChatAction("record_voice");
                    const fileLink = await ctx.telegram.getFileLink(msg.voice.file_id);
                    const voiceResponse = await axios.get(fileLink.toString(), { responseType: "arraybuffer" });
                    const voicePath = path.join(process.cwd(), `temp_voice_${chatId}.ogg`);
                    fs.writeFileSync(voicePath, Buffer.from(voiceResponse.data));

                    log("[bot] Transcribing voice...");
                    const transcription = await openai.audio.transcriptions.create({
                        file: fs.createReadStream(voicePath),
                        model: "whisper-large-v3", // Groq compatibility
                    });
                    userText = transcription.text;
                    if (fs.existsSync(voicePath)) fs.unlinkSync(voicePath);
                    log(`[bot] Transcribed: ${userText}`);
                } else if ("video" in msg || "video_note" in msg) {
                    isVoiceInput = true;
                    const videoData = msg.video || msg.video_note;
                    if (videoData.file_size && videoData.file_size > 20 * 1024 * 1024) {
                        throw new Error("Video file is too large (>20MB). Please try a shorter video.");
                    }
                    await ctx.sendChatAction("record_voice");
                    const fileLink = await ctx.telegram.getFileLink(videoData.file_id);
                    const videoPath = path.join(process.cwd(), `temp_video_${chatId}.mp4`);
                    const audioPath = path.join(process.cwd(), `temp_audio_${chatId}.mp3`);

                    log("[bot] Downloading video...");
                    const videoResponse = await axios.get(fileLink.toString(), { responseType: "arraybuffer" });
                    fs.writeFileSync(videoPath, Buffer.from(videoResponse.data));

                    log("[bot] Extracting audio...");
                    await new Promise((resolve, reject) => {
                        ffmpeg(videoPath)
                            .audioBitrate("32k")
                            .audioChannels(1)
                            .toFormat("mp3")
                            .on("end", resolve)
                            .on("error", reject)
                            .save(audioPath);
                    });

                    log("[bot] Transcribing video audio...");
                    const transcription = await openai.audio.transcriptions.create({
                        file: fs.createReadStream(audioPath),
                        model: "whisper-large-v3", // Groq compatibility
                    });
                    userText = transcription.text;
                    if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
                    if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
                    visualContext = `The user sent a video. The audio says: "${userText}".`;
                    log(`[bot] Video Transcribed: ${userText}`);
                } else if ("photo" in msg) {
                    log("[bot] Processing photo...");
                    const photo = msg.photo[msg.photo.length - 1];
                    const fileLink = await ctx.telegram.getFileLink(photo.file_id);
                    const response = await axios.get(fileLink.toString(), { responseType: "arraybuffer" });
                    const base64Image = Buffer.from(response.data).toString("base64");
                    const caption = msg.caption || "Describe everything you see in this image in detail.";

                    const multimodalPrompt = [
                        { type: "text", text: caption },
                        { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
                    ];

                    log(`[bot] Photo encoded (${response.data.byteLength} bytes). Routing to visionAgent...`);

                    // Route directly to vision Ã¢â‚¬â€ bypass the text handler below
                    const reply = (t: string) => this.safeReply(ctx, t);
                    return this.runBuild(multimodalPrompt, reply, ctx);
                } else if ("document" in msg) {
                    if (msg.document.file_size && msg.document.file_size > 20 * 1024 * 1024) {
                        throw new Error("Document is too large (>20MB) to download.");
                    }
                    log(`[bot] Processing document: ${msg.document.file_name}...`);
                    const fileLink = await ctx.telegram.getFileLink(msg.document.file_id);
                    const docResponse = await axios.get(fileLink.toString(), { responseType: "arraybuffer" });

                    // Save to shared data folder
                    const sharedDir = path.join(process.cwd(), "data", "shared");
                    if (!fs.existsSync(sharedDir)) fs.mkdirSync(sharedDir, { recursive: true });
                    const safeName = msg.document.file_name.replace(/[^a-zA-Z0-9.-]/g, "_");
                    const filePath = path.join(sharedDir, safeName);
                    fs.writeFileSync(filePath, Buffer.from(docResponse.data));

                    const fileContent = Buffer.from(docResponse.data).toString("utf-8"); // Assume text/utf-8 for now
                    userText = msg.caption || `I've uploaded '${msg.document.file_name}' to the shared data folder. Please analyze it.`;
                    visualContext = `DATA INPUT (File: ${msg.document.file_name} saved to shared folder):\n\n${fileContent.substring(0, 5000)}`;
                    log(`[bot] Document persisted and loaded, length: ${fileContent.length}`);
                } else if ("text" in msg) {
                    userText = msg.text;
                }

                // Handle Analysis Session
                const session = this.analysisSessions.get(chatId);
                if (session && userText && !userText.startsWith("/")) {
                    const val = parseFloat(userText.replace(/[^0-9.]/g, ""));

                    if (session.step === 'arv') {
                        if (isNaN(val)) return this.safeReply(ctx, "Ã¢ÂÅ’ Please enter a valid number for the ARV.");
                        session.arv = val;
                        session.step = 'repairs';
                        return this.safeReply(ctx, "Ã°Å¸â€ºÂ  Thanks! What is the estimated **Repair Cost**?");
                    }

                    if (session.step === 'repairs') {
                        if (isNaN(val)) return this.safeReply(ctx, "Ã¢ÂÅ’ Please enter a valid number for the Repair Cost.");
                        session.repairs = val;
                        session.step = 'askingPrice';
                        return this.safeReply(ctx, "Ã°Å¸â€™Â° Almost done! What is the **Seller's Asking Price**?");
                    }

                    if (session.step === 'askingPrice') {
                        if (isNaN(val)) return this.safeReply(ctx, "Ã¢ÂÅ’ Please enter a valid number for the Asking Price.");

                        const arv = session.arv || 0;
                        const repairs = session.repairs || 0;
                        const asking = val;
                        const mao = (arv * 0.7) - repairs;

                        let verdict = "";
                        if (asking <= mao) {
                            verdict = `Ã°Å¸â€Â¥ **THIS IS A GOOD DEAL!**\n\nYour Maximum Allowable Offer (MAO) is **$${mao.toLocaleString()}**. Since the asking price is $${asking.toLocaleString()}, you have a potential profit spread.`;
                        } else {
                            verdict = `Ã¢Å¡Â Ã¯Â¸Â **CAUTION: NOT A GREAT DEAL.**\n\nYour Maximum Allowable Offer (MAO) is **$${mao.toLocaleString()}**, which is lower than the asking price of $${asking.toLocaleString()}. You would need to negotiate significantly.`;
                        }

                        const result = `Ã°Å¸â€œÅ  **Deal Analysis: ${session.address}**\n\n` +
                            `Ã¢â‚¬Â¢ ARV: $${arv.toLocaleString()}\n` +
                            `Ã¢â‚¬Â¢ Repairs: $${repairs.toLocaleString()}\n` +
                            `Ã¢â‚¬Â¢ MAO (70% Rule): $${mao.toLocaleString()}\n` +
                            `Ã¢â‚¬Â¢ Asking Price: $${asking.toLocaleString()}\n\n` +
                            verdict + `\n\n*Suggested Offer: $${Math.min(asking, mao).toLocaleString()}*`;

                        // Save to CRM Database
                        let matchedBuyer = null;
                        try {
                            const profit = Math.max(0, mao - asking);

                            // 1. Save to SQLite
                            const dealId = CrmManager.addDeal({
                                address: session.address,
                                arv: arv,
                                repair_estimate: repairs,
                                max_offer: mao,
                                profit: profit,
                                status: asking <= mao ? 'contract' : 'lead'
                            });

                            // 2. Save to Supabase
                            await SupabaseCrm.insertDeal({
                                address: session.address,
                                seller: "Unknown (Analyzed)",
                                phone: "N/A",
                                arv: arv,
                                repairs: repairs
                            });

                            log(`[bot] Deal saved to both databases: ID ${dealId}`);

                            // Check for buyers
                            const matches = CrmManager.findMatchingBuyers(session.address);
                            if (matches.length > 0) {
                                matchedBuyer = matches[0].name;
                            }
                        } catch (dbErr: any) {
                            log(`[error] Failed to save deal to CRM: ${dbErr.message}`, "error");
                        }

                        const finalResult = result + (matchedBuyer ? `\n\nÃ°Å¸Å½Â¯ **POTENTIAL BUYER MATCH: ${matchedBuyer}**` : "");

                        this.analysisSessions.delete(chatId);
                        return this.safeReply(ctx, finalResult);
                    }
                }

                if (!userText && !visualContext) return;

                const text = userText;
                const reply = (t: string) => this.safeReply(ctx, t);

                // 1. SYSTEM COMMANDS
                if (text === "/apps") return reply(this.formatApps(listApps()));
                if (text.startsWith("/stop")) return reply(stopApp(text.split(" ")[1]));
                if (text.startsWith("/logs")) return reply(getLogs(text.split(" ")[1]));

                // 2. BUILD COMMAND
                if (text.startsWith("/build")) {
                    return this.runBuild(text.replace("/build ", ""), reply, ctx);
                }

                // 3. AUTO-DETECT BUILD
                const taskKeywords = ["build", "api", "app", "scrape"];
                if (taskKeywords.some(k => text.toLowerCase().includes(k))) {
                    return this.runBuild(text, reply, ctx);
                }

                // 4. Ã°Å¸â€™Â¬ NORMAL CHAT Ã¢â‚¬â€ with OrchestratorAgent
                const userId = String(ctx.from?.id ?? "unknown");

                // Save user message to SQL history
                if (chatId) saveMessage(chatId, "user", text);

                log(`[bot] Ã°Å¸â€™Â¬ Chat debug: Key=${config.openaiApiKey?.slice(0, 10)}... Base=${config.openaiBaseUrl}`);

                // Show typing indicator
                await ctx.sendChatAction("typing");

                try {
                    let response: string;
                    const routeResult = await orchestrator.route(text);
                    response = routeResult.response;

                    if (chatId) saveMessage(chatId, "assistant", response);

                    return reply(`ðŸ¤– HapdaBot\n\n${response}`);
                } catch (e: any) {
                    await reply(`âŒ Something went wrong: ${e.message}`);
                }

            } catch (err: any) {
                log(`[error] Handler failed: ${err.message}`, "error");
                await this.safeReply(ctx, `Ã¢Å¡Â Ã¯Â¸Â Error: ${err.message}`);
            }
        });

        // Ã°Å¸â€œÂ· PHOTO HANDLER (Visual Intelligence)
        this.bot.on("photo", async (ctx) => {
            if (!this.checkOwner(ctx)) return;
            const caption = ctx.message.caption || "Describe everything you see in this image in detail.";
            const reply = (t: string) => this.safeReply(ctx, t);

            try {
                const photo = ctx.message.photo[ctx.message.photo.length - 1];
                const fileLink = await this.bot.telegram.getFileLink(photo.file_id);
                const imageUrl = fileLink.toString();

                log(`[bot] Photo file_id: ${photo.file_id}, fetching...`);

                // Telegram URLs require auth Ã¢â‚¬â€ must download and base64-encode
                const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
                const base64 = Buffer.from(response.data).toString('base64');
                const dataUrl = `data:image/jpeg;base64,${base64}`;

                log(`[bot] Image encoded. Size: ${response.data.byteLength} bytes, base64 length: ${base64.length}`);

                const multimodalPrompt = [
                    { type: "text", text: caption },
                    {
                        type: "image_url",
                        image_url: { url: dataUrl }
                    }
                ];

                return this.runBuild(multimodalPrompt, reply, ctx);
            } catch (err: any) {
                log(`[error] Photo handling failed: ${err.message}`, "error");
                await reply(`âŒ Failed to process image: ${err.message}`);
            }
        });
    }

    private setupLeadGenHandlers() {
        // [COMMAND] /scrape - Pulls latest deeds and skip traces them
        this.bot.command('scrape', async (ctx) => {
            if (!this.checkOwner(ctx)) return;
            await ctx.reply("ðŸ” Searching NYC Open Data for latest Brooklyn deeds...");

            const leads = await PropertyScraper.fetchLatestDeeds('3', 3); // Top 3 from BK

            if (leads.length === 0) {
                return ctx.reply("âŒ No new deeds found in the last refresh.");
            }

            for (const lead of leads) {
                const dealId = await CrmManager.addDeal({
                    address: lead.address,
                    status: 'lead',
                    notes: `Scraped from NYC Open Data (Deed recorded: ${lead.docDate})`
                } as any);

                await ctx.reply(`ðŸ†• New Lead: ${lead.address}\nOwner: ${lead.ownerName}\n\nðŸ•µï¸ Initiating AI Skip Trace...`);

                const contact = await SkipTracer.trace(lead.ownerName, lead.address);
                if (contact.phone || contact.email) {
                    await SkipTracer.updateLeadWithContact(dealId, contact);
                    await ctx.reply(`âœ… Trace Success!\nPhone: ${contact.phone || 'N/A'}\nEmail: ${contact.email || 'N/A'}`);
                } else {
                    await ctx.reply("âš ï¸ Skip trace returned no direct contact info. Manual research required.");
                }
            }

            await ctx.reply("âœ… Scrape complete. Check your WholesaleOS dashboard for full details.");
        });

        // [COMMAND] /leads - Programmatic scraping of motivated sellers
        this.bot.command('leads', async (ctx) => {
            if (!this.checkOwner(ctx)) return;
            const args = ctx.message.text.split(" ").slice(1);
            const state = args[0] || undefined;
            const city = args[1] || undefined;

            await ctx.reply(`ðŸ” Searching for motivated sellers... ${state ? `in ${state}` : "across all markets"} ${city ? `(${city})` : ""}`);
            await ctx.sendChatAction("typing");

            try {
                const leads = await findMotivatedSellers(state, city);
                const response = formatLeads(leads);
                return this.safeReply(ctx, response);
            } catch (e: any) {
                log(`[bot] /leads command failed: ${e.message}`, "error");
                return ctx.reply(`âŒ Scraping failed: ${e.message}`);
            }
        });

        // [COMMAND] /outreach - Generates SMS/Email template for a lead
        this.bot.command('outreach', async (ctx) => {
            if (!this.checkOwner(ctx)) return;
            const deals = await CrmManager.listDeals();
            const latest = deals[0]; // Get the most recent

            if (!latest) return ctx.reply("Ã¢ÂÅ’ No leads found to generate outreach for.");

            await ctx.reply(`Ã°Å¸Â§Â  Thinking... Generating personalized outreach for ${latest.address}`);

            const prompt = `
                Generate a professional yet friendly cold outreach SMS and Email for this property owner.
                Property: ${latest.address}
                Target: Cash purchase offer.
                Tone: Helpful, non-aggressive, locally knowledgeable.
                
                Current Deal Status: ${latest.status}
                MAO (Maximum Allowable Offer): $${latest.max_offer || 'TBD'}
                
                Format the response as:
                ---
                SMS: [Your SMS copy]
                ---
                EMAIL: [Your Email copy]
            `;

            const response = await this.marketer.ask(prompt);
            await ctx.reply(response.content);
        });
    }

    private setupStatusHandlers() {
        this.bot.command("status", async (ctx) => {
            if (!this.checkOwner(ctx)) return;
            log(`[bot] Status check requested by ${ctx.from?.id}`);
            
            await ctx.sendChatAction("typing");
            const response = await orchestrator.getSystemStatus();

            // Persistence for status command
            import("../core/memory.js").then(m => {
                m.saveMessage(ctx.chat.id, "user", "/status");
                m.saveMessage(ctx.chat.id, "assistant", response);
            });

            return ctx.reply(response);
        });

        this.bot.command("mao", async (ctx) => {
            const args = ctx.message.text.split(" ").slice(1).map(Number);
            if (args.length < 2 || args.some(isNaN)) {
                return ctx.reply("Usage: /mao <arv> <repairs>\nExample: /mao 200000 30000");
            }
            const [arv, repairs] = args;
            const analysis = realEstateAgent.calculateMAO(arv, repairs);
            await ctx.reply(realEstateAgent.formatMAOResult(analysis));
        });
    }

    private setupApprovalHandlers() {
        // [COMMAND] /approve [pending_action_id]
        this.bot.command("approve", async (ctx) => {
            if (!this.checkOwner(ctx)) return;
            const args = ctx.message.text.split(" ").slice(1);
            const actionId = parseInt(args[0]);

            if (isNaN(actionId)) {
                return this.safeReply(ctx, "âŒ Usage: /approve [id]");
            }

            try {
                const action = await SupabaseCrm.getPendingAction(actionId);
                if (!action || action.status !== "pending") {
                    return this.safeReply(ctx, "âš ï¸ Action not found or already processed.");
                }

                const deal = action.payload;

                // 1. Add to CRM (SQLite)
                const dealId = CrmManager.addDeal({
                    address: deal.address,
                    seller_name: deal.sellerName || "Unknown",
                    arv: deal.arv || 0,
                    repair_estimate: deal.repairs || 0,
                    status: "lead"
                });

                // 2. Draft Outreach (Marketer Agent)
                const prompt = `
                    DRAFT HYPER-PERSONALIZED OUTREACH for this property.
                    Property: ${deal.address}
                    AI Context: ${deal.aiSummary || "Distressed property, potential seller urgency detected."}
                    
                    Tone: Professional but empathetic real estate buyer.
                    Format: SMS and Email.
                `;
                const outreach = await this.marketer.ask(prompt);

                // 3. Update Supabase Action
                await SupabaseCrm.updatePendingAction(actionId, "approved");

                // 4. Update Deal in Supabase CRM
                await SupabaseCrm.insertDeal({
                    address: deal.address,
                    owner_name: deal.sellerName,
                    arv: deal.arv,
                    repairs: deal.repairs,
                    status: "approved_lead",
                    source: "approval_flow"
                });

                // 5. Execute AI Outreach
                await executeContactSeller(deal);

                const response = `âœ… **DEAL APPROVED (#${dealId})**\n\n` +
                    `ðŸ“ ${deal.address}\n` +
                    `â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”\n` +
                    `ðŸš€ **Seller contact initiated.**\n\n` +
                    `ðŸ“ **DRAFTED OUTREACH**\n\n` +
                    `${outreach.content}`;

                return this.safeReply(ctx, response, true);
            } catch (err: any) {
                log(`[bot] /approve failed: ${err.message}`, "error");
                return this.safeReply(ctx, `âŒ Approval failed: ${err.message}`);
            }
        });

        // [COMMAND] /reject [pending_action_id]
        this.bot.command("reject", async (ctx) => {
            if (!this.checkOwner(ctx)) return;
            const args = ctx.message.text.split(" ").slice(1);
            const actionId = parseInt(args[0]);

            if (isNaN(actionId)) {
                return this.safeReply(ctx, "âŒ Usage: /reject [id]");
            }

            try {
                await SupabaseCrm.updatePendingAction(actionId, "rejected");
                return this.safeReply(ctx, `ðŸš« Action ${actionId} rejected. Lead ignored.`);
            } catch (err: any) {
                log(`[bot] /reject failed: ${err.message}`, "error");
                return this.safeReply(ctx, `âŒ Rejection failed: ${err.message}`);
            }
        });
    }



    private setupTaskHandlers() {
        this.bot.command("tasks", async (ctx) => {
            const tasks = getTasks() as any[];

            if (!tasks || tasks.length === 0) {
                return this.safeReply(ctx, "Ã°Å¸â€œâ€š No tasks found in the database.");
            }

            // Group by agent or just list them
            const message = tasks
                .slice(0, 15) // Limit to 15 for readability
                .map(t => `Ã°Å¸Â§Â  *${t.agent.toUpperCase()}* | \`${t.status.toUpperCase()}\`\nÃ°Å¸â€œÂ ${t.task.replace(/[_*[\]()~`>#+\-=|{}.!]/g, "\\$&")}`)
                .join("\n\n");

            return this.safeReply(ctx, `Ã°Å¸â€œâ€¹ *Recent Agent Tasks*\n\n${message}`, true);
        });
    }

    private setupProcessHandlers() {
        this.bot.command("apps", async (ctx) => {
            if (!this.checkOwner(ctx)) return;
            const apps = listApps();

            if (apps.length === 0) return this.safeReply(ctx, "Ã¢Å¡Â Ã¯Â¸Â No running apps");

            const listStr = apps
                .map(a => `Ã°Å¸Å¸Â¢ ${a.id} | Port: ${a.port} | ${a.status}`)
                .join("\n")
                .replace(/[_*[\]()~`>#+\-=|{}.!]/g, "\\$&"); // Escape for MarkdownV2

            return this.safeReply(ctx, `Ã°Å¸â€œâ€¹ *Managed Applications*\n\n${listStr}`, true);
        });

        this.bot.command("stop", async (ctx) => {
            if (!this.checkOwner(ctx)) return;
            const args = ctx.message.text.split(" ").slice(1);
            const id = args[0];
            if (!id) return this.safeReply(ctx, "Ã¢ÂÅ’ Usage: /stop [app_id]");
            return this.safeReply(ctx, stopApp(id));
        });

        this.bot.command("logs", async (ctx) => {
            if (!this.checkOwner(ctx)) return;
            const args = ctx.message.text.split(" ").slice(1);
            const id = args[0];
            if (!id) return this.safeReply(ctx, "Ã¢ÂÅ’ Usage: /logs [app_id]");
            return this.safeReply(ctx, getLogs(id));
        });
    }

    private setupBuildHandler() {
        this.bot.command("build", async (ctx) => {
            if (!this.checkOwner(ctx)) return;
            const text = ctx.message.text.split(" ").slice(1).join(" ");
            if (!text) return this.safeReply(ctx, "Ã¢ÂÅ’ Usage: /build [task description]");
            return this.runBuild(text, (t: string) => this.safeReply(ctx, t), ctx);
        });
    }

    private async runBuild(prompt: string | any, reply: any, ctx: Context) {
        log(`[bot] 1. /build triggered. Prompt: ${typeof prompt === 'string' ? prompt.slice(0, 50) : 'Multimodal'}`);
        
        if (this.isBusy) {
            return reply("⏳ System busy. Please wait...");
        }

        const dashboardState: FactoryDashboardState = {
            id: `wf_${Math.random().toString(36).substr(2, 5)}`,
            chatId: ctx.chat?.id,
            status: "planning",
            stages: {
                architect: { status: "pending" },
                stitch: { status: "pending" },
                marketing: { status: "pending" },
                developer: { status: "pending" },
                deploy: { status: "pending" },
            },
            timestamps: { startedAt: Date.now(), updatedAt: Date.now() },
            logs: ["Initiating AI Factory Assembly Line..."]
        };

        let editFailsCount = 0;

        const updateDashboard = async (patch?: DashboardPatch | string) => {
            if (typeof patch === 'object') {
                dashboardState.stages[patch.stage].status = patch.status;
                if (patch.message) {
                    dashboardState.stages[patch.stage].message = patch.message;
                    dashboardState.logs.push(`[${patch.stage.toUpperCase()}] ${patch.message}`);
                }
                
                if (patch.overallStatus) {
                    dashboardState.status = patch.overallStatus === "complete" ? "complete" : "failed";
                    if (patch.overallStatus === "complete") {
                        dashboardState.timestamps.finishedAt = Date.now();
                    }
                }
            } else if (typeof patch === 'string') {
                dashboardState.logs.push(patch);
            }
            dashboardState.timestamps.updatedAt = Date.now();
            
            const dashboardText = this.renderDashboard(dashboardState);
            
            let extra: any = undefined;
            if (dashboardState.status === "complete" || dashboardState.status === "failed") {
                extra = Markup.inlineKeyboard([
                    Markup.button.callback("🔄 Retry Build", `retry_build_${typeof prompt === 'string' ? prompt.slice(0, 50).replace(/[^a-zA-Z0-9]/g, '_') : 'last'}`)
                ]);
            }

            try {
                if (dashboardState.telegramMessageId) {
                    await ctx.telegram.editMessageText(
                        dashboardState.chatId,
                        dashboardState.telegramMessageId,
                        undefined,
                        dashboardText,
                        { parse_mode: 'HTML', ...extra }
                    );
                    editFailsCount = 0;
                }
            } catch (e: any) {
                if (e.description?.includes("message is not modified")) return;
                
                editFailsCount++;
                log(`[bot] Dashboard edit failed (${editFailsCount}/3): ${e.message}`, "warn");

                if (editFailsCount > 3) {
                    log(`[bot] Rate limit persistent. Sending NEW dashboard message.`);
                    try {
                        const newMsg = await ctx.reply(dashboardText, { parse_mode: 'HTML', ...extra });
                        dashboardState.telegramMessageId = newMsg.message_id;
                        editFailsCount = 0;
                    } catch (replyErr: any) {
                        log(`[bot] Persistent reply failure: ${replyErr.message}`, "error");
                    }
                }
            }
        };

        try {
            // STEP 2: CREATE DASHBOARD MESSAGE
            const initialMsg = await ctx.reply(this.renderDashboard(dashboardState), { parse_mode: 'HTML' });
            
            // STEP 3: STORE MESSAGE ID
            dashboardState.telegramMessageId = initialMsg.message_id;
            log(`[bot] 2-3. Dashboard message created, ID stored: ${dashboardState.telegramMessageId}`);

            // STEP 4: RUN PIPELINE
            this.isBusy = true;
            await updateDashboard("🧠 AI Architect planning pipeline...");
            const plan = await manager(prompt);

            if (plan.tasks.length === 0) {
                await updateDashboard({ stage: "architect", status: "complete", overallStatus: "complete", message: "Plan empty, nothing to build." } as DashboardPatch);
                return;
            }

            // FOR EACH STAGE / TASK
            for (const task of plan.tasks) {
                log(`[bot] Executing stage: ${task.agent}`);
                await executeTask(task, async (m) => {
                    // STEP 5: UPDATE dashboardState AND EDIT Telegram message (via callback)
                    await updateDashboard(m);
                });
            }

            // STEP 6: Mark COMPLETE
            if (dashboardState.status !== "complete" && dashboardState.status !== "failed") {
                await updateDashboard({ stage: "deploy", status: "complete", overallStatus: "complete", message: "Pipeline finished successfully." } as DashboardPatch);
            }
            log(`[bot] 6. Build execution complete. Final status: ${dashboardState.status}`);

        } catch (err: any) {
            log(`[error] Build failed: ${err.message}`, "error");
            await updateDashboard({ stage: "deploy", status: "failed", overallStatus: "failed", message: `Critical Build Error: ${err.message}` } as DashboardPatch);
        } finally {
            this.isBusy = false;
        }
    }


    private setupDashboardHandlers() {
        this.bot.action(/retry_build_(.+)/, async (ctx) => {
            const prompt = ctx.match[1] === 'last' ? "Rebuild last project" : ctx.match[1];
            await ctx.answerCbQuery("🔄 Restarting Factory Build...");
            const reply = (t: string) => this.safeReply(ctx, t);
            return this.runBuild(prompt, reply, ctx);
        });
    }

    private setupTradingHandlers() {
        // /trade Ã¢â‚¬â€ Show live Tradovate account status
        this.bot.command('trade', async (ctx) => {
            if (!this.checkOwner(ctx)) return;
            await ctx.reply("📡 Fetching live account data from Tradovate...");
            try {
                const { state, liveBalance } = await this.masterTrader.getLiveAccountState();
                const balanceStr = liveBalance
                    ? `Ã°Å¸â€™Â° Live Balance: $${liveBalance.marginBalance?.toFixed(2) ?? 'N/A'}\nÃ°Å¸â€œâ€° Real P&L: $${liveBalance.realizedPnL?.toFixed(2) ?? 'N/A'}`
                    : `Ã¢Å¡Â Ã¯Â¸Â Could not reach Tradovate API (credentials missing or not yet configured).`;
                const msg = `
Ã°Å¸â€œÅ  MASTER TRADER STATUS
Ã¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€Â
${balanceStr}

Open Trades (local): ${state.openTrades.length}
Win Rate: ${(state.winRate * 100).toFixed(1)}%
Total P&L (local): $${state.totalPnL.toFixed(2)}
Last Signal: ${state.lastSignal ? state.lastSignal.slice(0, 80) + '...' : 'None yet'}
`;
                await this.safeReply(ctx, msg);
            } catch (err: any) {
                await this.safeReply(ctx, `Ã¢ÂÅ’ Error fetching trade data: ${err.message}`);
            }
        });

        // /performance Ã¢â‚¬â€ Full performance breakdown
        this.bot.command('performance', async (ctx) => {
            if (!this.checkOwner(ctx)) return;
            const summary = this.masterTrader.getPerformanceSummary();
            await this.safeReply(ctx, summary);
        });

        // /tradehelp Ã¢â‚¬â€ How to use the trading system
        this.bot.command('tradehelp', async (ctx) => {
            await ctx.reply(`
Ã°Å¸Â¤â€“ MASTER TRADER Ã¢â‚¬â€ HELP
Ã¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€Â
/trade Ã¢â‚¬â€ Live account balance + open trades
/performance Ã¢â‚¬â€ Full win rate & P&L report

Ã°Å¸â€œÂ¡ TradingView Webhook URL:
https://your-railway-app.up.railway.app/webhook/tradingview

Set TRADOVATE_USE_LIVE=true in Railway env to go LIVE.
Default: DEMO mode (no real money).
            `);
        });
        // /markets Ã¢â‚¬â€ Prediction market scanner with AI analysis
        this.bot.command('markets', async (ctx) => {
            if (!this.checkOwner(ctx)) return;
            await ctx.reply('Ã°Å¸â€Â Scanning Polymarket for signals...');
            try {
                const { filtered } = await scanMarkets();
                // Send the filter report first
                await this.safeReply(ctx, formatMarketsReport(filtered));
                // Then run AI analysis on the filtered markets
                if (filtered.length > 0) {
                    await ctx.reply('Ã°Å¸Â§Â  Running AI analysis...');
                    const aiPick = await analyzeWithAI(filtered);
                    await this.safeReply(ctx, `Ã°Å¸Å½Â¯ AI BEST OPPORTUNITY\nÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€Â\n${aiPick}`);
                }
            } catch (err: any) {
                await this.safeReply(ctx, `Ã¢ÂÅ’ Market scan failed: ${err.message}`);
            }
        });
    }

    public launch() {
        DealWatcher.init(); const traderAgent = new MasterTraderAgent();
        orchestrator.registerTraderAgent(traderAgent);
        orchestrator.registerRealEstateAgent(realEstateAgent);
        this.setupGoogleHandlers();
        this.setupDashboardHandlers();
        this.bot.launch();
        log("[bot] Polling launched successfully.");
    }

    private setupGoogleHandlers() {
        this.bot.command('google', async (ctx) => {
            if (!this.checkOwner(ctx)) return;
            if (!isGoogleEnabled()) {
                return this.safeReply(ctx, 'Ã¢ÂÅ’ Google Workspace not configured. Add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN to Railway Variables.');
            }

            const parts = ctx.message.text.split(' ').slice(1);
            const service = parts[0]?.toLowerCase();
            const action = parts[1]?.toLowerCase();
            const args = parts.slice(2).join(' ');

            try {
                let result = '';

                if (service === 'drive') {
                    if (action === 'list') result = await driveListFiles();
                    else if (action === 'search') result = await driveSearch(args || 'untitled');
                    else result = '📁 Usage:\n/google drive list\n/google drive search [query]';

                } else if (service === 'doc') {
                    if (action === 'read') result = await readDoc(args);
                    else if (action === 'create') {
                        const [title, ...content] = args.split('|');
                        result = await createDoc(title.trim(), content.join('|').trim() || '');
                    } else result = '📄 Usage:\n/google doc read [docId]\n/google doc create [title] | [content]';

                } else if (service === 'slides') {
                    const [title, ...bullets] = args.split('|');
                    result = await createPresentation(title.trim(), bullets.map(b => b.trim()));

                } else if (service === 'sheet') {
                    if (action === 'create') result = await createSheet(args || 'New Sheet');
                    else if (action === 'append') {
                        const [sheetId, ...rows] = args.split('|');
                        const values = rows.map(r => r.split(',').map(c => c.trim()));
                        result = await appendSheet(sheetId.trim(), values);
                    } else result = 'Ã°Å¸â€œÅ  Usage:\n/google sheet create [title]\n/google sheet append [id] | [val1,val2] | [val3,val4]';

                } else if (service === 'gmail') {
                    if (action === 'list') result = await listEmails(args || 'is:unread');
                    else if (action === 'send') {
                        const [to, subject, ...body] = args.split('|');
                        result = await sendEmail(to.trim(), subject.trim(), body.join('|').trim());
                    } else result = '📧 Usage:\n/google gmail list [query]\n/google gmail send [to] | [subject] | [body]';

                } else if (service === 'calendar') {
                    if (action === 'list') result = await listEvents(parseInt(args) || 7);
                    else if (action === 'add') {
                        const [title, start, end] = args.split('|').map(s => s.trim());
                        result = await createEvent(title, start, end || new Date(new Date(start).getTime() + 3600000).toISOString());
                    } else result = '📅 Usage:\n/google calendar list [days]\n/google calendar add [title] | [ISO start] | [ISO end]';

                } else {
                    result = [
                        'Ã°Å¸Å’Â GOOGLE WORKSPACE COMMANDS',
                        'Ã¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€ÂÃ¢â€Â',
                        'Ã°Å¸â€œâ€š /google drive list',
                        'Ã°Å¸â€Â /google drive search [query]',
                        'Ã°Å¸â€œâ€ž /google doc read [docId]',
                        'Ã°Å¸â€œâ€ž /google doc create [title] | [content]',
                        'Ã°Å¸â€œÅ  /google slides create [title] | [slide1] | [slide2]',
                        'Ã°Å¸â€œÅ  /google sheet create [title]',
                        'Ã°Å¸â€œÅ  /google sheet append [id] | [val1,val2]',
                        'Ã°Å¸â€œÂ§ /google gmail list [query]',
                        'Ã°Å¸â€œÂ§ /google gmail send [to] | [subject] | [body]',
                        'Ã°Å¸â€œâ€¦ /google calendar list [days]',
                        'Ã°Å¸â€œâ€¦ /google calendar add [title] | [ISO date]',
                    ].join('\n');
                }

                await this.safeReply(ctx, result);
            } catch (err: any) {
                await this.safeReply(ctx, `Ã¢ÂÅ’ Google error: ${err.message}`);
            }
        });
    }

    private async generateSellerMessage(deal: any): Promise<string> {
        const prompt = `
            Generate a short, high-conversion cold SMS for this property owner.
            Address: ${deal.address}
            Owner: ${deal.seller_name || "Homeowner"}
            Our Goal: Buy the property for cash, as-is.
            
            Current Status: ${deal.status}
            MAO: $${(deal.max_offer || 0).toLocaleString()}
            
            Note: Be extremely professional but approachable. Do NOT sound like a bot.
        `;

        const res = await this.marketer.ask(prompt);
        return res.content;
    }

    private formatDealsTelemetry(events: any[]): string {
        if (!events || events.length === 0) return "📁 No recent deals found in telemetry.";
        
        let msg = "🎯 **RECENT HIGH-MOTIVATION DEALS**\n\n";
        events.forEach((event, i) => {
            const data = event.data || {};
            const address = (data.address || "Unknown").replace(/[_*[\]()~`>#+\-=|{}.!]/g, "\\$&");
            const profit = (data.est_profit || 0).toLocaleString();
            const score = data.score || 0;
            const date = new Date(event.created_at).toLocaleDateString();

            msg += `${i + 1}\\. *${address}*\n` +
                   `💰 Profit: $${profit}\n` +
                   `⭐ Score: ${score}/10\n` +
                   `📅 Found: ${date}\n\n`;
        });
        return msg;
    }

    private formatApps(apps: any[]): string {
        if (apps.length === 0) return "📭 No applications are currently managed.";
        const listStr = apps.map(a => `🟢 ${a.id} | Port: ${a.port} | ${a.status}`).join("\n").replace(/[_*[\]()~`>#+\-=|{}.!]/g, "\\$&");
        return `📋 *Managed Applications*\n\n${listStr}`;
    }

    public stop(signal: string) {
        this.bot.stop(signal);
    }
}


