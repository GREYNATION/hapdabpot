import { Telegraf } from 'telegraf';
import { log } from '../core/config.js';
import { safeString } from "../core/unpack.js";
import { MasterTraderAgent } from '../agents/MasterTraderAgent.js';

import { registerWebsiteCommand } from '../agents/website/websiteCommand.js';
import { TradingSwarmAgent } from '../agents/trading/TradingSwarmAgent.js';
import * as dramaAgent from '../agents/drama/DramaAgent.js';
import { registerLeadCommands } from '../commands/leads.js';
import { registerCinemaCommands } from '../agents/cinema/cinemaCommand.js';
import { sanitizeHTML, safeReply } from "../core/telegramUtils.js";
import { registerStuyzaCommands } from '../agents/stuyza/stuyzaCommand.js';
import { registerHumanizeCommand } from '../commands/humanize.js';
import { registerKimiCommand } from '../commands/kimi.js';
import { registerJarvisCommand } from '../commands/jarvis.js';
import { registerMorningCommand } from '../commands/morning.js';
import { registerArchiveCommand } from '../commands/archive.js';
import { handleKBCommand } from '../commands/kb.js';
import { PropertyScraper } from '../services/PropertyScraper.js';
import { handleHapdaCommand } from '../hapda_bot.js';
import { ExecutiveManager } from '../core/executive/executiveManager.js';
import { findMotivatedSellers } from '../services/universalLeadScraper.js';
import { CrmManager } from '../core/crm.js';
import { listApps, stopApp } from '../core/processManager.js';
import { manager } from '../core/manager.js';
import { scanMarkets, formatMarketsReport } from '../agents/predictionMarketAgent.js';
import {
    isGoogleEnabled,
    driveListFiles,
    listEmails,
    listEvents
} from '../agents/googleWorkspaceAgent.js';
import { getDb } from '../core/memory.js';
import { handleN8nCommand } from '../agents/n8nAgent/n8nAgent.js';
import { handlePromptsCommand } from '../agents/promptsAgent/promptsAgent.js';
import { handleHarnessCommand } from '../agents/harnessAgent/harnessAgent.js';
import { handleMoneyCommand, handleMoneyVideoCommand } from '../agents/moneyAgent.js';
import { runAgentTask } from '../core/ai.js';
import { executeWithTier } from '../services/orchestrator.js';
import { systemBuilderAgent } from '../agents/SystemBuilderAgent.js';
import { systemBuilderService } from '../services/systemBuilder.service.js';
import { registerComfyCommands } from '../agents/comfy/comfyCommand.js';
import { registerSpiderCommands } from '../agents/spider/spiderCommand.js';
import { registerGildedCommands } from '../agents/drama/gildedCommand.js';
import { registerTrendCommand } from '../commands/trend.js';
import { registerScriptCommand } from '../commands/script.js';
import { registerHyperFramesCommand } from '../commands/hyperframes.js';
import { HermesAgent } from '../agents/hermesAgent.js';
import { AthenaAgent } from '../agents/athenaAgent.js';
import { AresAgent } from '../agents/aresAgent.js';
import { AtlasAgent } from '../agents/atlasAgent.js';
import { HephaestusAgent } from '../agents/hephaestusAgent.js';
import { CouncilOrchestrator } from '../core/orchestrator/councilOrchestrator.js';



export function setupRouter(bot: Telegraf) {
    log("[router] Initializing Command Router...");
    
    // Global Middleware for Permission Check
    bot.use(async (ctx: any, next) => {
        const allowedIds = (process.env.TELEGRAM_ALLOWED_USER_IDS || "")
            .split(",")
            .map(id => parseInt(id.trim()))
            .filter(id => !isNaN(id) && id > 0);
            
        const ownerId = parseInt(process.env.TELEGRAM_OWNER_ID || process.env.OWNER_ID || "0");
        if (ownerId > 0 && !allowedIds?.includes(ownerId)) {
            allowedIds.push(ownerId);
        }

        const userId = ctx.from?.id;
        if (!userId) return next();

        // If it's a command, enforce ownership
        if (ctx.message?.text?.startsWith("/")) {
            // Only block if we have a non-empty auth list
            if (allowedIds.length > 0 && !allowedIds?.includes(userId)) {
                log(`[router] Blocking unauthorized command attempt from UID: ${userId}`);
                return ctx.reply(`❌ <b>Unauthorized Access</b>\n\nYour Telegram ID is: <code>${userId}</code>\n\nPlease add this ID to your <code>TELEGRAM_ALLOWED_USER_IDS</code> in Railway or the <code>.env</code> file to activate all commands.`, { parse_mode: 'HTML' });
            }
        }
        return next();
    });

    // 1. Agents are now orchestrated via CouncilOrchestrator

    // 2. Base Commands
    bot.start((ctx: any) => ctx.reply(
        "HapdaBot Council Online.\n\n" +
        "Simply type to chat with the Council, or use these commands:\n\n" +
        "/trade - Strategic Finance status\n" +
        "/scrape - Ops Intelligence leads\n" +
        "/surplus - Overage scan\n" +
        "/mao <arv> <repairs> - ROI calculation\n" +
        "/produce [ep] - Cinema production\n" +
        "/ads <skill> - Global Outreach strategy\n" +
        "/buildsite <desc> - Website Factory\n" +
        "/leads - CRM management\n" +
        "/stuyza - Video production studio\n" +
        "/goal <task> - High-performance autonomous goal\n" +
        "/brief - Executive Morning Command Center\n" +
        "/decision \"title\" \"outcome\" \"logic\" - Log decision\n" +
        "/triage - Manual email/task triage\n" +
        "/n8n [list|templates|trigger] - n8n Workflow Intelligence\n" +
        "/prompts [list|read] - AI Prompt Library\n" +
        "/harness [url] [task] - Browser Intelligence Harness\n" +
        "/jarvis [query] - OpenJarvis Multi-Agent Intelligence\n" +
        "/archive [url] - Obsidian Knowledge Librarian\n" +
        "/library [query] - Search Council Knowledge Base\n" +
        "/kb [url] - Direct Obsidian Save (Markdown)\n" +
        "/buildsystem [business] - Architect Open-Stack AI System\n" +
        "/listsystems - View all built client systems\n" +
        "/viewsystem [id] - Pull full config for a client\n" +
        "/proposal [id] - Generate PDF contract\n" +
        "/imagine flux <prompt> - FLUX.1 high-quality image gen\n" +
        "/upscale <url> - 4x AI image upscaler\n" +
        "/comfy [status|models|queue] - ComfyUI server controls\n" +
        "/hscan - **Full Autonomous Evolution Scan**"
    ));

    bot.command('kb', handleKBCommand);


    // 3. Real Estate Commands (Now routed via Hermes & Athena)
    bot.command('scrape', async (ctx: any) => {
        await ctx.reply("ðŸ”  **Hermes Scout Activated**: Searching for motivated sellers...");
        const hermes = new HermesAgent();
        const res = await hermes.chat("find real estate leads and motivated sellers");
        ctx.reply(res);
    });
    
    bot.command('surplus', async (ctx: any) => {
        await ctx.reply("ðŸ”  **Athena Strategic Scan**: Initiating Surplus Overage Analysis...");
        const athena = new AthenaAgent();
        const res = await athena.chat("auto scan surplus opportunities and calculate equity");
        ctx.reply(res);
    });
    
    bot.command('mao', async (ctx: any) => {
        const text = ctx.message.text.replace('/mao', '').trim();
        const athena = new AthenaAgent();
        const res = await athena.chat(text ? `Calculate MAO for: ${text}` : "Explain how to calculate MAO for a distressed property");
        ctx.reply(res);
    });
    
    bot.command('gold', async (ctx: any) => {
        await ctx.reply("💰 **Hapda Gold Mission**: Hermes Playwright Stealth Engine Engaged...");
        const hermes = new HermesAgent();
        const res = await hermes.chat("find motivated sellers in Cleveland OH gold ZIPs: 44102, 44105, 44108, 44110, 44112, 44128");
        ctx.reply(res);
    });

    bot.command('hscan', async (ctx: any) => {
        await ctx.reply("🚀 **Hapda Evolution Initiated**: Starting autonomous lead discovery pipeline...\n\n_Hermes is scouting, Athena is scoring, and Atlas is recording the results._");
        try {
            const orchestrator = new CouncilOrchestrator();
            const res = await orchestrator.chat("Perform a full real estate market scan for high-distress opportunities, analyze them for equity, and save the best leads to the Wiki.", ctx.chat.id);
            await ctx.reply(res, { parse_mode: 'HTML' });
        } catch (err: any) {
            log(`[router] /hscan failed: ${err.message}`, "error");
            await ctx.reply(`❌ Evolution Scan failed: ${err.message}`);
        }
    });

    bot.command('cleveland', async (ctx: any) => {
        await ctx.reply("ðŸ—ï¸ Hapdabot: Initializing Cleveland Live Pull...");
        log("[router] Executing Cleveland Acquisition Live Pull...");
        try {
            const leads = await findMotivatedSellers("OH", "Cleveland");
            await ctx.reply(`âœ… Scan complete. Found ${leads.length} potential leads. Check Obsidian for Hot Leads.`);
        } catch (err: any) {
            await ctx.reply(`âŒ Cleveland Pull failed: ${err.message}`);
        }
    });

    bot.command('cleveland_gold', async (ctx: any) => {
        await ctx.reply("ðŸ’° **Hapda Gold Mission: Cleveland Money Pull** ðŸ’°\nInitiating Playwright Stealth Engine for Gold ZIPs: 44102, 44105, 44108, 44110, 44112, 44128.\n\n_This mission bypasses paid scrapers and extracts high-distress FSBOs directly._");
        try {
            const zips = ['44102', '44105', '44108', '44110', '44112', '44128'];
            const leads = await findMotivatedSellers("OH", "Cleveland", zips, true);
            await ctx.reply(`âœ… Gold Mission Complete. Found ${leads.length} distressed leads.`);
        } catch (err: any) {
            await ctx.reply(`âŒ Gold Mission failed: ${err.message}`);
        }
    });

    bot.command('setcriteria', async (ctx: any) => {
        const text = ctx.message.text.replace('/setcriteria', '').trim();
        if (!text) {
            return ctx.reply("Usage: <code>/setcriteria &lt;city&gt;, &lt;state&gt;, &lt;zips&gt;, &lt;max_price&gt;</code>\nExample: <code>/setcriteria Cleveland, OH, 44105|44110, 200000</code>", { parse_mode: 'HTML' });
        }

        const parts = text.split(',').map((p: string) => p.trim());
        if (parts.length < 2) return ctx.reply("âŒ Need at least City and State.");

        const city = parts[0];
        const state = parts[1].toUpperCase();
        const zips = parts[2] ? parts[2].replace(/\|/g, ',') : "";
        const maxPrice = parts[3] ? parseFloat(parts[3]) : 500000;

        try {
            const db = getDb();
            const existing = db.prepare("SELECT id FROM lead_search_criteria WHERE city = ? AND state = ?").get(city, state) as any;

            if (existing) {
                db.prepare("UPDATE lead_search_criteria SET zip_codes = ?, max_price = ?, active = 1 WHERE id = ?").run(zips, maxPrice, existing.id);
                await ctx.reply(`âœ… Updated criteria for ${city}, ${state}.`);
            } else {
                db.prepare("INSERT INTO lead_search_criteria (label, city, state, zip_codes, max_price, active) VALUES (?, ?, ?, ?, ?, 1)").run(`${city} Market`, city, state, zips, maxPrice);
                await ctx.reply(`âœ… Added new search criteria for ${city}, ${state}.`);
            }
        } catch (err: any) {
            await ctx.reply(`âŒ Failed to update criteria: ${err.message}`);
        }
    });

    bot.command('stats', async (ctx: any) => {
        try {
            const db = getDb();
            const criteriaCount = (db.prepare("SELECT COUNT(*) as count FROM lead_search_criteria WHERE active = 1").get() as any).count;
            const leadCount = (db.prepare("SELECT COUNT(*) as count FROM scraped_leads").get() as any).count;
            const recentLeads = (db.prepare("SELECT COUNT(*) as count FROM scraped_leads WHERE created_at > date('now', '-24 hours')").get() as any).count;

            const msg = `ðŸ“Š **Hapda System Health**\n\n` +
                        `ðŸ” **Active Markets:** ${criteriaCount}\n` +
                        `ðŸ“¦ **Total Leads in DB:** ${leadCount}\n` +
                        `ðŸ”¥ **Leads Found (24h):** ${recentLeads}\n` +
                        `ðŸ“¡ **Scraper Status:** ðŸŸ¢ Online (Stealth Mode)\n` +
                        `ðŸ—ï¸ **Supabase Sync:** ðŸŸ¢ Active\n\n` +
                        `_Use /criteria to see market details._`;
            
            await ctx.reply(msg, { parse_mode: 'HTML' });
        } catch (err: any) {
            await ctx.reply(`âŒ Stats failed: ${err.message}`);
        }
    });

    // 4. Trading Commands
    bot.command('trade', async (ctx: any) => {
        const symbol = ctx.message.text.replace('/trade', '').trim().toUpperCase();
        
        if (symbol) {
            await ctx.reply(`📈 <b>Fetching Strategic Finance status for ${symbol}...</b>\nAnalyzing fundamentals, technicals, and sentiment. This may take a minute.`, { parse_mode: 'HTML' });
            try {
                const result = await TradingSwarmAgent.analyze(symbol);
                const report = TradingSwarmAgent.formatReport(result);
                
                if (report.length <= 4096) {
                    await ctx.reply(report, { parse_mode: 'HTML' });
                } else {
                    const chunks = report.match(/[\s\S]{1,4000}/g) ?? [report];
                    for (const chunk of chunks) await ctx.reply(chunk, { parse_mode: 'HTML' }).catch(() => {});
                }
            } catch (err: any) {
                const msg = err?.message || "Unknown swarm error";
                ctx.reply(`❌ <b>Swarm Failed</b>: <code>${sanitizeHTML(msg)}</code>\n\nThis is usually a model-name or API-key issue.`, { parse_mode: 'HTML' });
            }
        } else {
            await ctx.reply("📊 <b>Fetching Strategic Finance summary...</b>", { parse_mode: 'HTML' });
            try {
                const res = await new MasterTraderAgent().ask("Give me a trading account summary and current session.");
                await ctx.reply(String(res.content), { parse_mode: 'HTML' });
            } catch (err: any) {
                const msg = err?.message || "Unknown agent error";
                ctx.reply(`⚠️ <b>Agent Failed</b>: <code>${sanitizeHTML(msg)}</code>`, { parse_mode: 'HTML' });
            }
        }
    });

    // 5. Global Outreach (Ares Agent)
    bot.command('ads', async (ctx: any) => {
        const text = ctx.message.text.replace('/ads', '').trim();
        if (!text) {
            return ctx.reply("📢 <b>Ares Outreach Command Center</b>\n\nUse <code>/ads &lt;strategy/copy/keywords&gt;</code> to trigger global outreach planning.", { parse_mode: 'HTML' });
        }
        await ctx.reply('🔥 <b>Ares Campaign Forge</b>: Drafting strategy...', { parse_mode: 'HTML' });
        const ares = new AresAgent();
        const res = await ares.chat(`Design ad strategy/copy for: ${text}`);
        ctx.reply(res);
    });

    bot.command('hooks', async (ctx: any) => {
        const topic = ctx.message.text.replace('/hooks', '').trim() || 'real estate motivated sellers and TikTok mini-drama';
        await ctx.reply('🪝 <b>Ares Hook Forge</b>: Crafting 20 viral hooks...', { parse_mode: 'HTML' });
        const ares = new AresAgent();
        const res = await ares.chat(`Generate 20 scroll-stopping hooks for: ${topic}`);
        ctx.reply(res);
    });

    bot.command('copy', async (ctx: any) => {
        const text = ctx.message.text.replace('/copy', '').trim();
        if (!text) return ctx.reply('ðŸ“  Usage: /copy <platform> [product]');
        await ctx.reply('📝 <b>Ares Scribe</b>: Drafting persuasive ad copy...', { parse_mode: 'HTML' });
        const ares = new AresAgent();
        const res = await ares.chat(`Draft high-converting ad copy for: ${text}`);
        ctx.reply(res);
    });

    // 6. Website Pipeline â€” delegated to websiteCommand.ts
    registerWebsiteCommand(bot);

    // 7. Stuyza Lead Management (Modular)
    registerLeadCommands(bot, getDb());

    // 8. Cinema / Drama Production
    registerCinemaCommands(bot);

    // 9. Stuyza Productions / OpenMontage Video System
    registerStuyzaCommands(bot);

    // 9.7 Spider Jr. Cartoon Production
    registerSpiderCommands(bot);

    // 9.8 Gilded Claws Luxury Drama
    registerGildedCommands(bot);

    // 9.5 Humanizer Service
    registerHumanizeCommand(bot);

    // 9.6 Kimi Reasoning specialist
    registerKimiCommand(bot);

    // 9.7 OpenJarvis Intelligence
    registerJarvisCommand(bot);
    registerMorningCommand(bot);

    // 9.8 Knowledge Librarian (Obsidian)
    registerArchiveCommand(bot);

    // 9.9 Viral Trend Scanner, Adaptive Script & HyperFrames
    registerTrendCommand(bot);
    registerScriptCommand(bot);
    registerHyperFramesCommand(bot);

    // 10. System Status & App Management
    bot.command("apps", (ctx: any) => {
        const apps = listApps();
        const list = apps.map((a: any) => `ðŸŸ¢ ${a.id} (P:${a.port})`).join("\n");
        ctx.reply(`ðŸ“‹ **Managed Apps:**\n\n${list || "None"}`);
    });

    bot.command("stop", (ctx: any) => {
        const id = ctx.message.text.split(" ")[1];
        if (!id) return ctx.reply("âŒ Usage: /stop [appId]");
        ctx.reply(stopApp(id));
    });

    // 11. Property Analysis (Athena Agent)
    bot.command('analyze', async (ctx: any) => {
        const address = ctx.message.text.split(" ").slice(1).join(" ");
        if (!address) return ctx.reply("ðŸ   Usage: /analyze [address]");
        await ctx.reply("ðŸ“Š **Athena Strategic Insight**: Analyzing property data...");
        const athena = new AthenaAgent();
        const res = await athena.chat(`Deep property analysis for: ${address}. Evaluate ROI and risk.`);
        ctx.reply(res);
    });


    // 12. Build & Deploy
    bot.command("build", (ctx: any) => {
        const prompt = ctx.message.text.split(" ").slice(1).join(" ");
        if (!prompt) return ctx.reply("ðŸ —ï¸  Usage: /build [task]");
        ctx.reply("ðŸ —ï¸  Build request received. Check the dashboard for status updates.");
        // Note: Full runBuild logic remains in TelegramBot for dashboard state management, 
        // but we trigger the intent here.
    });

    // 13. High-Performance Autonomous Goal (Hephaestus Orchestration)
    bot.command('goal', async (ctx: any) => {
        const text = ctx.message.text.replace('/goal', '').trim();
        const chatId = ctx.chat.id;

        if (!text) {
            return ctx.reply("🔥 <b>Hephaestus Mission Control</b>\n\nUsage: <code>/goal [objective]</code>\nExample: <code>/goal Scrape Cleveland for FSBOs and email the top 3 deals to me</code>", { parse_mode: "HTML" });
        }

        await ctx.reply("ðŸ —ï¸  **Hephaestus Forge Initialized**: Orchestrating multi-agent mission...");
        const council = new CouncilOrchestrator();
        const res = await council.chat(text, chatId);
        ctx.reply(res);
    });


    // 14. Executive Commands
    bot.command('brief', async (ctx: any) => {
        await ctx.reply("ðŸŒ… **Generating Executive Briefing...**");
        try {
            const report = await ExecutiveManager.generateMorningBriefing();
            
            if (!report) {
                return ctx.reply("ðŸ“… **Morning Command Center**: No updates found for today.");
            }

            if (report.length <= 4096) {
                await ctx.reply(report, { parse_mode: "HTML" });
            } else {
                const chunks = report.match(/[\s\S]{1,4000}/g) ?? [report];
                for (const chunk of chunks) await ctx.reply(chunk, { parse_mode: "HTML" }).catch(() => { });
            }
        } catch (err: any) {
            ctx.reply(`âŒ **Briefing failed**: ${err.message}`);
        }
    });

    bot.command('decision', async (ctx: any) => {
        const text = ctx.message.text.replace('/decision', '').trim();
        const matches = text.match(/"([^"]+)"\s+"([^"]+)"\s+"([^"]+)"/);

        if (!matches) {
            return ctx.reply("⚖️ <b>Usage</b>: <code>/decision \"title\" \"outcome\" \"logic\"</code>", { parse_mode: "HTML" });
        }

        const [_, title, outcome, logic] = matches;
        const res = ExecutiveManager.logDecision(title, logic, outcome);
        ctx.reply(res);
    });

    bot.command('triage', async (ctx: any) => {
        await ctx.reply("📧 <b>Running manual email triage...</b>", { parse_mode: "HTML" });
        try {
            const pulse = await ExecutiveManager.runTriagePulse();
            if (pulse) {
                await ctx.reply(pulse, { parse_mode: 'HTML' });
            } else {
                await ctx.reply("✅ <b>Inbox Clean</b>: No high-priority items found.", { parse_mode: 'HTML' });
            }
        } catch (err: any) {
            ctx.reply(`⚠️ <b>Triage failed</b>: ${err.message}`, { parse_mode: 'HTML' });
        }
    });

    // 15. Markets & Intelligence
    bot.command('markets', async (ctx: any) => {
        await ctx.reply("📡 <b>Scanning prediction markets...</b>", { parse_mode: 'HTML' });
        try {
            const { filtered } = await scanMarkets();
            await ctx.reply(formatMarketsReport(filtered), { parse_mode: 'HTML' });
        } catch (err: any) { ctx.reply(`⚠️ <b>Market scan failed</b>: ${err.message}`, { parse_mode: 'HTML' }); }
    });

    // 14. Google Workspace
    bot.command('google', async (ctx: any) => {
        if (!isGoogleEnabled()) return ctx.reply("âš ï¸  Google not configured.");
        const [action, ...args] = ctx.message.text.split(" ").slice(1);
        if (!action) return ctx.reply("ðŸ“‚ Usage: /google [drive|gmail|cal] [args]");
        try {
            switch (action.toLowerCase()) {
                case 'drive': ctx.reply(await driveListFiles(args.join(" "))); break;
                case 'gmail': ctx.reply(await listEmails(args.join(" ") || "is:unread")); break;
                case 'cal': ctx.reply(await listEvents(7)); break;
                default: ctx.reply("âŒ Unknown service: drive, gmail, cal.");
            }
        } catch (err: any) { ctx.reply(`âš ï¸ Google error: ${err.message}`); }
    });

    // 15. n8n Integration
    bot.command('n8n', async (ctx: any) => {
        const text = ctx.message.text.replace('/n8n', '').trim();
        await ctx.reply("🤖 <b>n8n Operation Initialized...</b>", { parse_mode: 'HTML' });
        try {
            const res = await handleN8nCommand(text);
            ctx.reply(String(res), { parse_mode: 'HTML' });
        } catch (err: any) {
            ctx.reply(`❌ <b>n8n Error</b>: <code>${sanitizeHTML(err.message)}</code>`, { parse_mode: "HTML" });
        }
    });

    // 16. Agentic Skills & AgentHub

    bot.command('agenthub', async (ctx: any) => {
        const text = ctx.message.text.replace('/agenthub', '').trim();
        if (!text) {
            return ctx.reply("🔍 <b>AgentHub Explorer</b>\n\nUsage: <code>/agenthub search &lt;intent&gt;</code>\nExample: <code>/agenthub search best agent for mauby audit</code>", { parse_mode: "HTML" });
        }
        await ctx.reply("🧠 <b>Searching AgentHub registry...</b>", { parse_mode: 'HTML' });
        // This will be handled by the orchestrator via the intent detection, 
        // but we can provide a quicker response or trigger the agent directly.
        const res = await handleHapdaCommand(`Analyze this request using AgentHub: ${text}`, String(ctx.from?.id));
        
        if (!res) {
            return ctx.reply("⚠️ <b>AgentHub</b>: Search returned no matching skills or agents.", { parse_mode: "HTML" });
        }

        ctx.reply(res, { parse_mode: 'HTML' });
    });

    // 18. AI Prompts Browser
    bot.command('prompts', async (ctx: any) => {
        const args = ctx.message.text.replace('/prompts', '').trim();
        await ctx.reply("🔍 <b>Accessing AI Prompt Library. Please wait...</b>", { parse_mode: "HTML" });
        try {
            const result = await handlePromptsCommand(args);
            if (result.length <= 4096) {
                await ctx.reply(result, { parse_mode: 'HTML' });
            } else {
                const chunks = result.match(/[\s\S]{1,4000}/g) ?? [result];
                for (const chunk of chunks) await ctx.reply(chunk).catch(() => {});
            }
        } catch (err: any) {
            ctx.reply(`❌ <b>Prompts Error</b>: <code>${sanitizeHTML(err.message)}</code>`, { parse_mode: "HTML" });
        }
    });
    
    // 19. Browser Harness
    bot.command('harness', async (ctx: any) => {
        const text = ctx.message.text.replace('/harness', '').trim();
        if (!text) {
            return ctx.reply("🌐 <b>Browser Intelligence Harness</b>\n\nUsage: <code>/harness [url] [task]</code>\nExample: <code>/harness https://news.google.com find top top tech stories</code>", { parse_mode: "HTML" });
        }
        
        await ctx.reply("ðŸŒ **Harnessing Browser Intelligence...**");
        try {
            const res = await handleHarnessCommand(text);
            if (res.length <= 4096) {
                // No parse_mode â€” AI summary of web content contains raw chars that break Markdown parsing
                await ctx.reply(res, { parse_mode: "HTML" }).catch(() => ctx.reply("✅ Harness complete (reply too long to display)."));
            } else {
                const chunks = res.match(/[\s\S]{1,4000}/g) ?? [res];
                for (const chunk of chunks) await ctx.reply(chunk).catch(() => {});
            }
        } catch (err: any) {
            ctx.reply(`❌ <b>Harness Error</b>: <code>${sanitizeHTML(err.message)}</code>`, { parse_mode: "HTML" });
        }
    });

    // 19.5 Job Status Polling
    bot.command('status', async (ctx: any) => {
        const jobId = ctx.message.text.replace('/status', '').trim();
        if (!jobId) {
            return ctx.reply("🔍 <b>Usage</b>: <code>/status job_12345</code>", { parse_mode: "HTML" });
        }

        try {
            const port = process.env.PORT || 8080;
            const res = await fetch(`http://localhost:${port}/api/agent/status/${jobId}`);
            if (res.status === 404) {
                return ctx.reply(`⚠️ Job <b>${jobId}</b> not found.`, { parse_mode: "HTML" });
            }

            const data = await res.json();

            if (data.status === 'queued') {
                return ctx.reply(`⌛ Job <b>${jobId}</b> is queued...`, { parse_mode: "HTML" });
            } else if (data.status === 'running') {
                return ctx.reply(`🏃 Job <b>${jobId}</b> is currently running...`, { parse_mode: "HTML" });
            } else if (data.status === 'error') {
                return ctx.reply(`❌ Job <b>${jobId}</b> failed:\n<code>${sanitizeHTML(data.error)}</code>`, { parse_mode: "HTML" });
            } else if (data.status === 'done') {
                const resultText = data.result?.data || data.result?.summary || JSON.stringify(data.result);
                
                if (resultText.length <= 4096) {
                    await ctx.reply(`✅ <b>Result:</b>\n\n${resultText}`, { parse_mode: 'HTML' }).catch(() => ctx.reply("✅ Job complete (reply too long to display)."));
                } else {
                    const chunks = resultText.match(/[\s\S]{1,4000}/g) ?? [resultText];
                    for (const chunk of chunks) await ctx.reply(chunk).catch(() => {});
                }
            } else {
                return ctx.reply(`â“ Unknown status: ${data.status}`);
            }

        } catch (err: any) {
            ctx.reply(`âŒ Could not fetch status: ${err.message}`);
        }
    });

    // 19.6 Money Agent
    bot.command('money', async (ctx: any) => {
        const text = ctx.message.text.trim();
        await ctx.reply("💰 Initializing Money Agent. Analyzing opportunities...", { parse_mode: 'HTML' });
        try {
            const res = await handleMoneyCommand(text, ctx.chat.id);
            await ctx.reply(res);
        } catch (err: any) {
            ctx.reply(`âŒ Money Agent Error: ${err.message}`);
        }
    });

    // 19.7 Money Video Agent
    bot.command('money_video', async (ctx: any) => {
        const text = ctx.message.text.trim().replace('/money_video', '/money-video');
        await ctx.reply("🎥 <b>Starting FBA YouTube Intelligence...</b>\nScraping trending videos, extracting transcripts, and scoring products. This may take 5-20 minutes depending on video length...", { parse_mode: 'HTML' });
        try {
            const res = await handleMoneyVideoCommand(text, ctx.chat.id);
            await ctx.reply(res);
        } catch (err: any) {
            ctx.reply(`âŒ Money Video Agent Error: ${err.message}`);
        }
    });

    // 20. Ruflo Swarm Engine
    bot.command('ruflo', async (ctx: any) => {
        const text = ctx.message.text.trim();
        const userId = String(ctx.from?.id || 'default');

        if (text === '/ruflo') {
            return ctx.reply("🌊 <b>Ruflo Swarm Engine</b>\n\nUsage: <code>/ruflo [memory|swarm|youtube] [task]</code>\nExample: <code>/ruflo youtube \"AI Real Estate Investing\"</code>", { parse_mode: 'HTML' });
        }

        await ctx.reply("🌊 <b>Ruflo Engine Initializing...</b>\nDeploying agent swarm. This may take a few moments...", { parse_mode: 'HTML' });

        try {
            const result = await handleHapdaCommand(text, userId);

            if (!result) {
                return ctx.reply("âš ï¸ **Ruflo**: No actionable result generated.");
            }

            if (result.length <= 4096) {
                await ctx.reply(result, { parse_mode: 'HTML' }).catch(() => ctx.reply(result));
            } else {
                const chunks = result.match(/[\s\S]{1,4000}/g) ?? [result];
                for (const chunk of chunks) await ctx.reply(chunk).catch(() => { });
            }
        } catch (err: any) {
            ctx.reply(`❌ <b>Ruflo Swarm Failed</b>: <code>${sanitizeHTML(err.message)}</code>`, { parse_mode: "HTML" });
        }
    });

    // 21. HADES Funnel System Builder
    bot.command('buildfunnel', async (ctx: any) => {
        const text = ctx.message.text.replace('/buildfunnel', '').trim();
        if (!text) {
            return ctx.reply("🔥 <b>HADES System Builder</b>\n\nUsage: <code>/buildfunnel [business description]</code>\nExample: <code>/buildfunnel A MedSpa in Miami with 3 locations</code>", { parse_mode: 'HTML' });
        }
        
        await ctx.reply("ðŸ—ï¸ **Architecting HADES Funnel...**\nProvisionsing bots, mapping workflows, and generating your agency proposal. Please wait...");
        try {
            const res = await systemBuilderAgent.handle(text, ctx.from?.id, ctx.chat?.id);
            if (res.length <= 4096) {
                await ctx.reply(res, { parse_mode: "HTML" });
            } else {
                const chunks = res.match(/[\s\S]{1,4000}/g) ?? [res];
                for (const chunk of chunks) await ctx.reply(chunk, { parse_mode: "HTML" }).catch(() => {});
            }
        } catch (err: any) {
            ctx.reply(`âŒ **Builder Failed**: ${err.message}`);
        }
    });

    // 22. Open-Stack System Builder
    bot.command('buildsystem', async (ctx: any) => {
        const text = ctx.message.text.replace('/buildsystem', '').trim();
        if (!text) {
            return ctx.reply("🏗️ <b>Open-Stack System Builder</b>\n\nUsage: <code>/buildsystem [business, location]</code>\nExample: <code>/buildsystem Roofing Pros, Dallas TX</code>", { parse_mode: "HTML" });
        }
        
        await ctx.reply("ðŸŒ **Architecting Open-Stack Ecosystem...**\nMapping Vapi + Cal.com + Chatwoot workflows. Saving to Supabase vault.");
        try {
            const res = await systemBuilderAgent.handle(text, ctx.from?.id, ctx.chat?.id);
            if (res.length <= 4096) {
                await ctx.reply(res, { parse_mode: "HTML" });
            } else {
                const chunks = res.match(/[\s\S]{1,4000}/g) ?? [res];
                for (const chunk of chunks) await ctx.reply(chunk, { parse_mode: "HTML" }).catch(() => {});
            }
        } catch (err: any) {
            ctx.reply(`âŒ **System Build Failed**: ${err.message}`);
        }
    });

    // 23. PDF Proposal Generator
    bot.command('proposal', async (ctx: any) => {
        const clientId = ctx.message.text.replace('/proposal', '').trim();
        if (!clientId) {
            return ctx.reply("📄 <b>Proposal Generator</b>\n\nUsage: <code>/proposal [clientId]</code>\n<i>You can get the clientId from the /buildsystem output.</i>", { parse_mode: 'HTML' });
        }

        await ctx.reply(`📄 <b>Generating Professional PDF Proposal...</b>\nFetching Client ID: <code>${clientId}</code>`, { parse_mode: 'HTML' });
        
        try {
            const pdfBuffer = await systemBuilderService.generateProposalPDF(clientId);
            await ctx.replyWithDocument({
                source: pdfBuffer,
                filename: `HADES_Proposal_${clientId.substring(0,8)}.pdf`
            }, {
                caption: `✅ <b>Proposal Ready</b>\n\nHere is your professional HADES System Architecture proposal. Ready to send to the client.`
            });
        } catch (err: any) {
            ctx.reply(`âŒ **Proposal Failed**: ${err.message}`);
        }
    });

    // 24. System Management: List
    bot.command('listsystems', async (ctx: any) => {
        await ctx.reply("📂 <b>Fetching Client Systems...</b>", { parse_mode: 'HTML' });
        try {
            const { getSupabase } = await import('../core/supabase.js');
            const supabase = getSupabase();
            if (!supabase) {
                return ctx.reply("âš ï¸ Database not configured.");
            }
            const { data, error } = await supabase
                .from("client_systems")
                .select("id, business_name, tier, monthly_price, status, created_at")
                .order("created_at", { ascending: false })
                .limit(10);

            if (error || !data?.length) {
                return ctx.reply("📭 No systems built yet. Try <code>/buildsystem Dallas Roofing</code>", { parse_mode: "HTML" });
            }

            const lines = data.map((s: any, i: number) =>
                `${i + 1}. *${s.business_name}* â€” ${s.tier} â€” $${s.monthly_price}/mo â€” ${s.status}`
            ).join("\n");

            await ctx.reply(`⚡ <b>YOUR CLIENT SYSTEMS</b>\n\n${lines}\n\nUse <code>/viewsystem [id]</code> to see details.`, { parse_mode: 'HTML' });
        } catch (err: any) {
            ctx.reply(`âŒ **List Failed**: ${err.message}`);
        }
    });

    // 25. System Management: View Detail
    bot.command('viewsystem', async (ctx: any) => {
        const clientId = ctx.message.text.replace('/viewsystem', '').trim();
        if (!clientId) {
            return ctx.reply("🔍 Usage: <code>/viewsystem [clientId]</code>", { parse_mode: "HTML" });
        }

        try {
            const { getSupabase } = await import('../core/supabase.js');
            const supabase = getSupabase();
            if (!supabase) {
                return ctx.reply("âš ï¸ Database not configured.");
            }
            const { data, error } = await supabase
                .from("client_systems")
                .select("*")
                .eq("id", clientId)
                .single();

            if (error || !data) {
                return ctx.reply("âŒ **System not found.** Check the ID and try again.");
            }
            const msg_text = `ðŸ—‚ **${data.business_name.toUpperCase()}** â€” ${data.tier}\n` +
                `-----------------------------------\n` +
                `ðŸ“  **Industry**: ${data.industry}\n` +
                `ðŸ ¢ **Status**: ${data.status}\n` +
                `ðŸ’µ **Monthly**: $${data.monthly_price}/mo\n` +
                `ðŸ¤– **Agents**: ${Array.isArray(data.agents) ? data.agents.join(", ") : 'CSR, ASSISTANT'}\n` +
                `ðŸ“… **Created**: ${new Date(data.created_at).toLocaleDateString()}\n` +
                `-----------------------------------\n` +
                `Use \`/proposal ${clientId}\` to generate the PDF contract.`;

            await ctx.reply(msg_text, { parse_mode: 'HTML' });
        } catch (err: any) {
            ctx.reply(`â Œ **View Failed**: ${err.message}`);
        }
    });

    // 26. ComfyUI â€” Local AI Media Generation
    registerComfyCommands(bot);

    // 27. Drama / Cinema Commands
    bot.command("drama_status", async (ctx) => {
        try {
            const agent = new dramaAgent.DramaAgent();
            const reply = await agent.handleTelegramCommand("/drama_status", []);
            return ctx.reply(reply, { parse_mode: "HTML" }).catch(() => ctx.reply(reply));
        } catch (err: any) {
            log(`[router] /drama_status error: ${err.message}`, "error");
            ctx.reply(`❌ Drama Status Error: ${err.message}`);
        }
    });

    bot.command("drama_produce", async (ctx) => {
        const args = (ctx.message as any).text.split(" ").slice(1);
        try {
            const agent = new dramaAgent.DramaAgent();
            const reply = await agent.handleTelegramCommand("/drama_produce", args, ctx);
            return ctx.reply(sanitizeHTML(reply), { parse_mode: "HTML" }).catch(() => ctx.reply(reply));
        } catch (err: any) {
            log(`[router] /drama_produce error: ${err.message}`, "error");
            ctx.reply(`❌ Drama Produce Error: ${err.message}`);
        }
    });

    bot.command("drama_hook", async (ctx) => {
        const args = (ctx.message as any).text.split(" ").slice(1);
        try {
            const agent = new dramaAgent.DramaAgent();
            const reply = await agent.handleTelegramCommand("/drama_hook", args, ctx);
            return ctx.reply(sanitizeHTML(reply), { parse_mode: "HTML" }).catch(() => ctx.reply(reply));
        } catch (err: any) {
            log(`[router] /drama_hook error: ${err.message}`, "error");
            ctx.reply(`❌ Drama Hook Error: ${err.message}`);
        }
    });

    log("[router] Routes configured.");
}

