import { Telegraf } from "telegraf";
import { CrmManager } from "../core/crm.js";
import { ai, manager } from "../core/manager.js";
import { simpleChat } from "../core/ai.js";
import { executeTask } from "../core/executor.js";
import { initDb } from "../core/memory.js";
import { openai, config, log } from "../core/config.js";
import { SKILLS } from "../core/skills.js";
import { ResearcherAgent } from "../agents/researcherAgent.js";
import { MarketerAgent } from "../agents/marketerAgent.js";
import { MasterTraderAgent } from "../agents/MasterTraderAgent.js";
import { PropertyScraper } from "../core/scraper.js";
import { SkipTracer } from "../core/skiptrace.js";
import fs from "fs";
import path from "path";
import axios from "axios";
import ffmpeg from "fluent-ffmpeg";
import { agentMail } from "../services/agentmail.js";
import { getTasks } from "../core/taskMemory.js";
import { listApps, stopApp, getLogs } from "../core/processManager.js";

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
        this.setupHandlers();
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
            this.safeReply(ctx, "⚠️ Access Denied: This command requires Owner privileges.");
            return false;
        }
        return true;
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
        this.bot.command("deal", async (ctx) => {
            if (!this.checkOwner(ctx)) return;
            const args = ctx.message.text.split(" ").slice(1);
            const subCommand = args[0]?.toLowerCase();

            switch (subCommand) {
                case "add": {
                    const params = args.slice(1).join(" ").split("|").map(s => s.trim());
                    if (params.length < 1) {
                        return this.safeReply(ctx, "❌ Usage: /deal add [address] | [seller] | [phone] | [arv] | [repairs]");
                    }
                    const [address, seller, phone, arv, repairs] = params;
                    const dealId = CrmManager.addDeal({
                        address,
                        seller_name: seller,
                        seller_phone: phone,
                        arv: parseFloat(arv) || 0,
                        repair_estimate: parseFloat(repairs) || 0
                    });
                    const deal = CrmManager.getDeal(dealId);
                    return this.safeReply(ctx, `✅ Deal added! ID: ${dealId}\nAddress: ${address}\nMax Offer: $${deal?.max_offer.toLocaleString()}`);
                }

                case "update": {
                    const id = parseInt(args[1]);
                    const updateStr = args.slice(2).join(" ");
                    if (isNaN(id) || !updateStr.includes("=")) {
                        return this.safeReply(ctx, "❌ Usage: /deal update [id] [field]=[value]\nFields: status, buyer, arv, repairs, profit, seller, phone");
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
                    if (!field) return this.safeReply(ctx, `❌ Unknown field: ${fieldRaw}`);

                    let parsedValue: any = value;
                    if (["arv", "repair_estimate", "profit"].includes(field)) parsedValue = parseFloat(value);

                    try {
                        CrmManager.updateDeal(id, { [field]: parsedValue });
                        const deal = CrmManager.getDeal(id);
                        return this.safeReply(ctx, `✅ Deal ${id} updated!\nNew ${fieldRaw}: ${value}\nNew Max Offer: $${deal?.max_offer.toLocaleString()}`);
                    } catch (e: any) {
                        return this.safeReply(ctx, `❌ Error: ${e.message}`);
                    }
                }

                case "list": {
                    const deals = CrmManager.listDeals();
                    if (deals.length === 0) return this.safeReply(ctx, "📂 No deals found.");
                    const list = deals.map(d => `ID ${d.id}: ${d.address} (${d.status.toUpperCase()})`).join("\n");
                    return this.safeReply(ctx, `📋 Recent Deals:\n${list}`);
                }

                case "view": {
                    const id = parseInt(args[1]);
                    if (isNaN(id)) return this.safeReply(ctx, "❌ Usage: /deal view [id]");
                    const deal = CrmManager.getDeal(id);
                    if (!deal) return this.safeReply(ctx, "❌ Deal not found.");
                    
                    const msg = `🏠 Deal #${deal.id}\n` +
                        `📍 Address: ${deal.address}\n` +
                        `👤 Seller: ${deal.seller_name || "N/A"} (${deal.seller_phone || "N/A"})\n` +
                        `💰 ARV: $${deal.arv.toLocaleString()}\n` +
                        `🛠 Repairs: $${deal.repair_estimate.toLocaleString()}\n` +
                        `📉 Max Offer: $${deal.max_offer.toLocaleString()}\n` +
                        `📊 Status: ${deal.status.toUpperCase()}\n` +
                        `🤝 Buyer: ${deal.assigned_buyer || "Unassigned"}\n` +
                        `💵 Profit: $${deal.profit.toLocaleString()}`;
                    return this.safeReply(ctx, msg);
                }

                default:
                    return this.safeReply(ctx, "🏢 Real Estate Wholesale CRM\n\nUsage:\n/deal add [addr] | [seller] | [phone] | [arv] | [repairs]\n/deal list\n/deal view [id]\n/deal update [id] [field]=[value]");
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
                return `• *${name}* (\`${id}\`): ${desc}`;
            }).join("\n");
            
            const message = `🛠 *Gravity Claw Specialist Skills*\n\n${list}\n\n_Ask about these topics to trigger them automatically\\!_`;
            return this.safeReply(ctx, message, true);
        });
    }

    private setupAnalysisHandlers() {
        this.bot.command("analyze", async (ctx) => {
            if (!this.checkOwner(ctx)) return;
            const address = ctx.message.text.split(" ").slice(1).join(" ").trim();
            if (!address) {
                return this.safeReply(ctx, "🏠 Please provide an address to analyze.\nUsage: /analyze [address]");
            }

            await this.safeReply(ctx, `🔍 Analyzing ${address}... searching for comparables...`);
            
            // Use Researcher to get snippets
            const researcher = new ResearcherAgent();
            const searchResults = await researcher.executeTool("web_search", { query: `${address} recent sales listings` });
            
            await this.safeReply(ctx, searchResults);
            
            this.analysisSessions.set(ctx.chat.id, {
                address,
                step: 'arv'
            });

            await this.safeReply(ctx, "📈 Got the data! Now, let's look at the numbers.\n\nWhat is the **After Repair Value (ARV)** for this property?");
        });
    }

    private setupHandlers() {
        this.bot.on(["message", "voice", "video", "video_note", "photo", "document"], async (ctx) => {
            const chatId = ctx.chat.id;
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
                    
                    // Route directly to vision — bypass the text handler below
                    const reply = (t: string) => this.safeReply(ctx, t);
                    return this.runBuild(multimodalPrompt, reply);
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
                        if (isNaN(val)) return this.safeReply(ctx, "❌ Please enter a valid number for the ARV.");
                        session.arv = val;
                        session.step = 'repairs';
                        return this.safeReply(ctx, "🛠 Thanks! What is the estimated **Repair Cost**?");
                    }

                    if (session.step === 'repairs') {
                        if (isNaN(val)) return this.safeReply(ctx, "❌ Please enter a valid number for the Repair Cost.");
                        session.repairs = val;
                        session.step = 'askingPrice';
                        return this.safeReply(ctx, "💰 Almost done! What is the **Seller's Asking Price**?");
                    }

                    if (session.step === 'askingPrice') {
                        if (isNaN(val)) return this.safeReply(ctx, "❌ Please enter a valid number for the Asking Price.");
                        
                        const arv = session.arv || 0;
                        const repairs = session.repairs || 0;
                        const asking = val;
                        const mao = (arv * 0.7) - repairs;
                        
                        let verdict = "";
                        if (asking <= mao) {
                            verdict = `🔥 **THIS IS A GOOD DEAL!**\n\nYour Maximum Allowable Offer (MAO) is **$${mao.toLocaleString()}**. Since the asking price is $${asking.toLocaleString()}, you have a potential profit spread.`;
                        } else {
                            verdict = `⚠️ **CAUTION: NOT A GREAT DEAL.**\n\nYour Maximum Allowable Offer (MAO) is **$${mao.toLocaleString()}**, which is lower than the asking price of $${asking.toLocaleString()}. You would need to negotiate significantly.`;
                        }

                        const result = `📊 **Deal Analysis: ${session.address}**\n\n` +
                            `• ARV: $${arv.toLocaleString()}\n` +
                            `• Repairs: $${repairs.toLocaleString()}\n` +
                            `• MAO (70% Rule): $${mao.toLocaleString()}\n` +
                            `• Asking Price: $${asking.toLocaleString()}\n\n` +
                            verdict + `\n\n*Suggested Offer: $${Math.min(asking, mao).toLocaleString()}*`;

                        // Save to CRM Database
                        let matchedBuyer = null;
                        try {
                            const profit = Math.max(0, mao - asking);
                            const dealId = CrmManager.addDeal({
                                address: session.address,
                                arv: arv,
                                repair_estimate: repairs,
                                max_offer: mao,
                                profit: profit,
                                status: asking <= mao ? 'contract' : 'lead'
                            });
                            log(`[bot] Deal saved to database: ID ${dealId}`);
                            
                            // Check for buyers
                            const matches = CrmManager.findMatchingBuyers(session.address);
                            if (matches.length > 0) {
                                matchedBuyer = matches[0].name;
                            }
                        } catch (dbErr: any) {
                            log(`[error] Failed to save deal to CRM: ${dbErr.message}`, "error");
                        }

                        const finalResult = result + (matchedBuyer ? `\n\n🎯 **POTENTIAL BUYER MATCH: ${matchedBuyer}**` : "");

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
                    return this.runBuild(text.replace("/build ", ""), reply);
                }

                // 3. AUTO-DETECT BUILD
                const taskKeywords = ["build", "api", "app", "email", "mail", "scrape", "search", "analyze", "check", "find", "who"];
                if (taskKeywords.some(k => text.toLowerCase().includes(k))) {
                    return this.runBuild(text, reply);
                }

                // 4. 💬 NORMAL CHAT (NEW)
                const response = await simpleChat(text);
                return reply(response);

            } catch (err: any) {
                log(`[error] Handler failed: ${err.message}`, "error");
                await this.safeReply(ctx, `⚠️ Error: ${err.message}`);
            }
        });

        // 📷 PHOTO HANDLER (Visual Intelligence)
        this.bot.on("photo", async (ctx) => {
            if (!this.checkOwner(ctx)) return;
            const caption = ctx.message.caption || "Describe everything you see in this image in detail.";
            const reply = (t: string) => this.safeReply(ctx, t);

            try {
                const photo = ctx.message.photo[ctx.message.photo.length - 1];
                const fileLink = await this.bot.telegram.getFileLink(photo.file_id);
                const imageUrl = fileLink.toString();
                
                log(`[bot] Photo file_id: ${photo.file_id}, fetching...`);
                
                // Telegram URLs require auth — must download and base64-encode
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

                return this.runBuild(multimodalPrompt, reply);
            } catch (err: any) {
                log(`[error] Photo handling failed: ${err.message}`, "error");
                await reply(`❌ Failed to process image: ${err.message}`);
            }
        });
    }

    private setupLeadGenHandlers() {
        // [COMMAND] /scrape - Pulls latest deeds and skip traces them
        this.bot.command('scrape', async (ctx) => {
            if (!this.checkOwner(ctx)) return;
            await ctx.reply("🔍 Searching NYC Open Data for latest Brooklyn deeds...");
            
            const leads = await PropertyScraper.fetchLatestDeeds('3', 3); // Top 3 from BK
            
            if (leads.length === 0) {
                return ctx.reply("❌ No new deeds found in the last refresh.");
            }

            for (const lead of leads) {
                const dealId = await CrmManager.addDeal({
                    address: lead.address,
                    status: 'lead',
                    notes: `Scraped from NYC Open Data (Deed recorded: ${lead.docDate})`
                } as any);

                await ctx.reply(`🆕 New Lead: ${lead.address}\nOwner: ${lead.ownerName}\n\n🕵️ Initiating AI Skip Trace...`);
                
                const contact = await SkipTracer.trace(lead.ownerName, lead.address);
                if (contact.phone || contact.email) {
                    await SkipTracer.updateLeadWithContact(dealId, contact);
                    await ctx.reply(`✅ Trace Success!\nPhone: ${contact.phone || 'N/A'}\nEmail: ${contact.email || 'N/A'}`);
                } else {
                    await ctx.reply("⚠️ Skip trace returned no direct contact info. Manual research required.");
                }
            }

            await ctx.reply("✅ Scrape complete. Check your WholesaleOS dashboard for full details.");
        });

        // [COMMAND] /outreach - Generates SMS/Email template for a lead
        this.bot.command('outreach', async (ctx) => {
            if (!this.checkOwner(ctx)) return;
            const deals = await CrmManager.listDeals();
            const latest = deals[0]; // Get the most recent

            if (!latest) return ctx.reply("❌ No leads found to generate outreach for.");

            await ctx.reply(`🧠 Thinking... Generating personalized outreach for ${latest.address}`);

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
            log(`[bot] Status check requested by ${ctx.from?.id}`);
            const response = "HaptaBap AI is online using OpenRouter (gpt-4o-mini)";
            
            // Persistence for status command
            import("../core/memory.js").then(m => {
                m.saveMessage(ctx.chat.id, "user", "/status");
                m.saveMessage(ctx.chat.id, "assistant", response);
            });

            return ctx.reply(response);
        });
    }

    private setupTradingHandlers() {
        this.bot.command('trade', (ctx) => {
            const state = this.masterTrader.getState();
            ctx.reply(`
📊 TRADER STATUS
━━━━━━━━━━━━━━━━━━
Open: ${state.openTrades.length}
P&L: $${state.totalPnL.toFixed(2)}
Win Rate: ${(state.winRate * 100).toFixed(1)}%
            `);
        });

        this.bot.command('performance', (ctx) => {
            ctx.reply(this.masterTrader.getPerformanceSummary());
        });
    }

    private setupTaskHandlers() {
        this.bot.command("tasks", async (ctx) => {
            const tasks = getTasks() as any[];

            if (!tasks || tasks.length === 0) {
                return this.safeReply(ctx, "📂 No tasks found in the database.");
            }

            // Group by agent or just list them
            const message = tasks
                .slice(0, 15) // Limit to 15 for readability
                .map(t => `🧠 *${t.agent.toUpperCase()}* | \`${t.status.toUpperCase()}\`\n📝 ${t.task.replace(/[_*[\]()~`>#+\-=|{}.!]/g, "\\$&")}`)
                .join("\n\n");

            return this.safeReply(ctx, `📋 *Recent Agent Tasks*\n\n${message}`, true);
        });
    }

    private setupProcessHandlers() {
        this.bot.command("apps", async (ctx) => {
            if (!this.checkOwner(ctx)) return;
            const apps = listApps();
            
            if (apps.length === 0) return this.safeReply(ctx, "⚠️ No running apps");

            const listStr = apps
                .map(a => `🟢 ${a.id} | Port: ${a.port} | ${a.status}`)
                .join("\n")
                .replace(/[_*[\]()~`>#+\-=|{}.!]/g, "\\$&"); // Escape for MarkdownV2

            return this.safeReply(ctx, `📋 *Managed Applications*\n\n${listStr}`, true);
        });

        this.bot.command("stop", async (ctx) => {
            if (!this.checkOwner(ctx)) return;
            const args = ctx.message.text.split(" ").slice(1);
            const id = args[0];
            if (!id) return this.safeReply(ctx, "❌ Usage: /stop [app_id]");
            return this.safeReply(ctx, stopApp(id));
        });

        this.bot.command("logs", async (ctx) => {
            if (!this.checkOwner(ctx)) return;
            const args = ctx.message.text.split(" ").slice(1);
            const id = args[0];
            if (!id) return this.safeReply(ctx, "❌ Usage: /logs [app_id]");
            return this.safeReply(ctx, getLogs(id));
        });
    }

    private setupBuildHandler() {
        this.bot.command("build", async (ctx) => {
            if (!this.checkOwner(ctx)) return;
            const text = ctx.message.text.split(" ").slice(1).join(" ");
            if (!text) return this.safeReply(ctx, "❌ Usage: /build [task description]");
            return this.runBuild(text, (t: string) => this.safeReply(ctx, t));
        });
    }

    private async runBuild(prompt: string | any, reply: any) {
        log(`[bot] Incoming runBuild. Type: ${Array.isArray(prompt) ? 'Array' : 'String'}`);
        if (this.isBusy) {
            return reply("⏳ System busy. Please wait...");
        }

        this.isBusy = true;

        try {
            // STEP 0: INSTANT REPLY
            await reply("I'm on it! Starting your request now.");

            // STEP 1: PLAN
            const plan = await manager(prompt);
            
            if (plan.tasks.length === 0) {
                return; // Nothing more to do for simple chat
            }

            // STEP 2: EXECUTE TASKS
            for (const task of plan.tasks) {
                await reply(`⚡ ${task.agent} working...`);
                const result = await executeTask(task);
                await reply(result);
            }

            await reply("🚀 Task completed");
        } catch (err: any) {
            log(`[error] Build failed: ${err.message}`, "error");
            await reply(`⚠️ Error: ${err.message}`);
        } finally {
            this.isBusy = false;
        }
    }

    public launch() {
        this.bot.launch();
        log("[bot] Polling launched successfully.");
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
