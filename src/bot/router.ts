import { Telegraf } from 'telegraf';
import { log } from '../core/config.js';
import { MasterTraderAgent } from '../agents/MasterTraderAgent.js';
import { realEstateAgent } from '../agents/realEstateAgent.js';
import { AdsAgent } from '../agents/ads/AdsAgent.js';
import { registerWebsiteCommand } from '../agents/website/websiteCommand.js';
import { TradingSwarmAgent } from '../agents/trading/TradingSwarmAgent.js';
import * as dramaAgent from '../agents/drama/DramaAgent.js';
import { registerLeadCommands } from '../commands/leads.js';
import { registerCinemaCommands } from '../agents/cinema/cinemaCommand.js';
import { registerStuyzaCommands } from '../agents/stuyza/stuyzaCommand.js';
import { registerHumanizeCommand } from '../commands/humanize.js';
import { registerKimiCommand } from '../commands/kimi.js';
import { registerJarvisCommand } from '../commands/jarvis.js';
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



export function setupRouter(bot: Telegraf) {
    log("[router] Initializing Command Router...");
    
    // Global Middleware for Permission Check
    bot.use(async (ctx: any, next) => {
        const allowedIds = (process.env.TELEGRAM_ALLOWED_USER_IDS || "")
            .split(",")
            .map(id => parseInt(id.trim()))
            .filter(id => !isNaN(id) && id > 0);
            
        const ownerId = parseInt(process.env.TELEGRAM_OWNER_ID || process.env.OWNER_ID || "0");
        if (ownerId > 0 && !allowedIds.includes(ownerId)) {
            allowedIds.push(ownerId);
        }

        const userId = ctx.from?.id;
        if (!userId) return next();

        // If it's a command, enforce ownership
        if (ctx.message?.text?.startsWith("/")) {
            // Only block if we have a non-empty auth list
            if (allowedIds.length > 0 && !allowedIds.includes(userId)) {
                log(`[router] Blocking unauthorized command attempt from UID: ${userId}`);
                return ctx.reply(`❌ **Unauthorized Access**\n\nYour Telegram ID is: \`${userId}\`\n\nPlease add this ID to your \`TELEGRAM_ALLOWED_USER_IDS\` inRailway or the \`.env\` file to activate all commands.`, { parse_mode: 'Markdown' });
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
        "/imagine <prompt> - ComfyUI text-to-image (SD1.5)\n" +
        "/imagine flux <prompt> - FLUX.1 high-quality image gen\n" +
        "/upscale <url> - 4x AI image upscaler\n" +
        "/comfy [status|models|queue] - ComfyUI server controls"
    ));

    bot.command('kb', handleKBCommand);


    // 3. Real Estate Commands
    bot.command('scrape', async (ctx: any) => {
        await ctx.reply("Searching for motivated sellers...");
        const res = await realEstateAgent.handle("find leads");
        ctx.reply(String(res));
    });

    bot.command('surplus', async (ctx: any) => {
        await ctx.reply("Initiating Surplus Overage Scan...");
        const res = await realEstateAgent.handle("auto scan surplus");
        ctx.reply(String(res));
    });

    bot.command('mao', async (ctx: any) => {
        const text = ctx.message.text.replace('/mao', '').trim();
        const res = await realEstateAgent.handle(text ? `mao ${text}` : "mao");
        ctx.reply(String(res));
    });

    // 4. Trading Commands
    bot.command('trade', async (ctx: any) => {
        const symbol = ctx.message.text.replace('/trade', '').trim().toUpperCase();
        
        if (symbol) {
            await ctx.reply(`📈 **Fetching Strategic Finance status for ${symbol}...**\nAnalyzing fundamentals, technicals, and sentiment. This may take a minute.`, { parse_mode: 'Markdown' });
            try {
                const result = await TradingSwarmAgent.analyze(symbol);
                const report = TradingSwarmAgent.formatReport(result);
                
                if (report.length <= 4096) {
                    await ctx.reply(report, { parse_mode: 'Markdown' });
                } else {
                    const chunks = report.match(/[\s\S]{1,4000}/g) ?? [report];
                    for (const chunk of chunks) await ctx.reply(chunk, { parse_mode: 'Markdown' }).catch(() => {});
                }
            } catch (err: any) {
                const msg = err?.message || "Unknown swarm error";
                ctx.reply(`❌ **Swarm Failed**: \`${msg}\`\n\nThis is usually a model-name or API-key issue.`, { parse_mode: 'Markdown' });
            }
        } else {
            await ctx.reply("📊 **Fetching Strategic Finance summary...**", { parse_mode: 'Markdown' });
            try {
                const res = await new MasterTraderAgent().ask("Give me a trading account summary and current session.");
                await ctx.reply(String(res.content), { parse_mode: 'Markdown' });
            } catch (err: any) {
                const msg = err?.message || "Unknown agent error";
                ctx.reply(`⚠️ **Agent Failed**: \`${msg}\``, { parse_mode: 'Markdown' });
            }
        }
    });

    // 5. Ads Agent
    bot.command('ads', async (ctx: any) => {
        const userId = ctx.from?.id ?? 0;
        const text = ctx.message.text.replace('/ads', '').trim();
        if (!text) {
            return ctx.reply(
                "Ad Strategy Commands:\n\n" +
                "/ads strategy - Full 5-agent strategy\n" +
                "/ads quick - 60-second readiness score\n" +
                "/ads audience - Buyer personas\n" +
                "/ads competitors - Competitive intel\n" +
                "/ads keywords - Google Ads keywords\n" +
                "/ads copy tiktok - TikTok ad copy\n" +
                "/ads copy facebook - Facebook ad copy\n" +
                "/ads hooks - 20 scroll-stopping hooks\n" +
                "/ads video - Video scripts (15s/30s/60s)\n" +
                "/ads funnel - Conversion funnel\n" +
                "/ads budget 5000 - Budget allocation\n" +
                "/ads testing - A/B testing plan\n" +
                "/ads landing - Landing page audit\n" +
                "/ads audit - Performance audit\n" +
                "/ads report - Full strategy report"
            );
        }
        await ctx.reply('Running ad analysis...');
        const result = await AdsAgent.handle(`ads ${text}`, userId);
        if (result.length <= 4096) {
            await ctx.reply(result).catch(() => ctx.reply(result));
        } else {
            const chunks = result.match(/[\s\S]{1,4000}/g) ?? [result];
            for (const chunk of chunks) await ctx.reply(chunk).catch(() => { });
        }
    });

    bot.command('hooks', async (ctx: any) => {
        const topic = ctx.message.text.replace('/hooks', '').trim() || 'real estate motivated sellers and TikTok mini-drama';
        await ctx.reply('Generating 20 hooks...');
        const result = await AdsAgent.handle(`ads hooks ${topic}`, ctx.from?.id ?? 0);
        await ctx.reply(result.slice(0, 4096)).catch(() => ctx.reply('Hooks generated'));
    });

    bot.command('copy', async (ctx: any) => {
        const text = ctx.message.text.replace('/copy', '').trim();
        if (!text) return ctx.reply('Usage: /copy <platform> [product]\nExample: /copy facebook motivated seller leads');
        await ctx.reply('Writing ad copy...');
        const result = await AdsAgent.handle(`ads copy ${text}`, ctx.from?.id ?? 0);
        await ctx.reply(result.slice(0, 4096)).catch(() => ctx.reply('Copy generated'));
    });

    // 6. Website Pipeline — delegated to websiteCommand.ts
    registerWebsiteCommand(bot);

    // 7. Stuyza Lead Management (Modular)
    registerLeadCommands(bot, getDb());

    // 8. Cinema / Drama Production
    registerCinemaCommands(bot);

    // 9. Stuyza Productions / OpenMontage Video System
    registerStuyzaCommands(bot);

    // 9.5 Humanizer Service
    registerHumanizeCommand(bot);

    // 9.6 Kimi Reasoning specialist
    registerKimiCommand(bot);

    // 9.7 OpenJarvis Intelligence
    registerJarvisCommand(bot);

    // 9.8 Knowledge Librarian (Obsidian)
    registerArchiveCommand(bot);

    // 10. System Status & App Management
    bot.command('stats', (ctx) => {
        try {
            const stats = CrmManager.getStats();
            const apps = listApps();
            ctx.reply(`📊 **System Health**\n\nLeads: ${stats.leads}\nContracts: ${stats.contracts}\nApps: ${apps.length} active`);
        } catch (err: any) { ctx.reply(`⚠️ Stats failed: ${err.message}`); }
    });

    bot.command("apps", (ctx: any) => {
        const apps = listApps();
        const list = apps.map((a: any) => `🟢 ${a.id} (P:${a.port})`).join("\n");
        ctx.reply(`📋 **Managed Apps:**\n\n${list || "None"}`);
    });

    bot.command("stop", (ctx: any) => {
        const id = ctx.message.text.split(" ")[1];
        if (!id) return ctx.reply("❌ Usage: /stop [appId]");
        ctx.reply(stopApp(id));
    });

    // 11. Property Analysis
    bot.command('analyze', (ctx: any) => {
        const address = ctx.message.text.split(" ").slice(1).join(" ");
        if (!address) return ctx.reply("🏠 Usage: /analyze [address]");
        // Analysis sessions should ideally move to a session manager, but for now we keep the prompt
        ctx.reply(`📋 Initiating deep analysis for: ${address}\n\nPlease provide ARV, Repairs, and Price sequentially.`);
    });

    // 12. Build & Deploy
    bot.command("build", (ctx: any) => {
        const prompt = ctx.message.text.split(" ").slice(1).join(" ");
        if (!prompt) return ctx.reply("🏗️ Usage: /build [task]");
        ctx.reply("🏗️ Build request received. Check the dashboard for status updates.");
        // Note: Full runBuild logic remains in TelegramBot for dashboard state management, 
        // but we trigger the intent here.
    });

    // 13. High-Performance Autonomous Goal (Hapda Engine)
    bot.command('goal', async (ctx: any) => {
        const text = ctx.message.text.trim();
        const userId = String(ctx.from?.id || 'default');

        if (text === '/goal') {
            return ctx.reply("🚀 **Autonomous Goal Mode**\n\nUsage: `/goal [your objective]`\nExample: `/goal Find motivated sellers with >$50k equity in Houston`", { parse_mode: 'Markdown' });
        }

        await ctx.reply("🧠 **Claw Architecture Initialized.**\nRunning autonomous pipeline. This may take a few minutes...");

        try {
            const result = await handleHapdaCommand(text, userId);

            if (!result) {
                return ctx.reply("⚠️ **Hapda Algorithm**: No actionable result generated.");
            }

            if (result.length <= 4096) {
                await ctx.reply(result, { parse_mode: 'Markdown' }).catch(() => ctx.reply(result));
            } else {
                const chunks = result.match(/[\s\S]{1,4000}/g) ?? [result];
                for (const chunk of chunks) await ctx.reply(chunk).catch(() => { });
            }
        } catch (err: any) {
            ctx.reply(`❌ **Goal Failed**: ${err.message}`, { parse_mode: 'Markdown' });
        }
    });

    // 14. Executive Commands
    bot.command('brief', async (ctx: any) => {
        await ctx.reply("🌅 **Generating Executive Briefing...**");
        try {
            const report = await ExecutiveManager.generateMorningBriefing();
            
            if (!report) {
                return ctx.reply("📅 **Morning Command Center**: No updates found for today.");
            }

            if (report.length <= 4096) {
                await ctx.reply(report, { parse_mode: 'Markdown' });
            } else {
                const chunks = report.match(/[\s\S]{1,4000}/g) ?? [report];
                for (const chunk of chunks) await ctx.reply(chunk, { parse_mode: 'Markdown' }).catch(() => { });
            }
        } catch (err: any) {
            ctx.reply(`❌ **Briefing failed**: ${err.message}`);
        }
    });

    bot.command('decision', async (ctx: any) => {
        const text = ctx.message.text.replace('/decision', '').trim();
        const matches = text.match(/"([^"]+)"\s+"([^"]+)"\s+"([^"]+)"/);

        if (!matches) {
            return ctx.reply("📂 **Usage**: `/decision \"title\" \"outcome\" \"logic\"`", { parse_mode: 'Markdown' });
        }

        const [_, title, outcome, logic] = matches;
        const res = ExecutiveManager.logDecision(title, logic, outcome);
        ctx.reply(res);
    });

    bot.command('triage', async (ctx: any) => {
        await ctx.reply("📩 **Running manual email triage...**");
        try {
            const pulse = await ExecutiveManager.runTriagePulse();
            ctx.reply(pulse || "✅ **Inbox Clean**: No high-priority items found.");
        } catch (err: any) {
            ctx.reply(`⚠️ **Triage failed**: ${err.message}`);
        }
    });

    // 15. Markets & Intelligence
    bot.command('markets', async (ctx: any) => {
        await ctx.reply("📡 Scanning prediction markets...");
        try {
            const { filtered } = await scanMarkets();
            ctx.reply(formatMarketsReport(filtered));
        } catch (err: any) { ctx.reply(`⚠️ Market scan failed: ${err.message}`); }
    });

    // 14. Google Workspace
    bot.command('google', async (ctx: any) => {
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

    // 15. n8n Integration
    bot.command('n8n', async (ctx: any) => {
        const text = ctx.message.text.replace('/n8n', '').trim();
        await ctx.reply("🤖 **n8n Operation Initialized...**");
        try {
            const res = await handleN8nCommand(text);
            ctx.reply(String(res), { parse_mode: 'Markdown' });
        } catch (err: any) {
            ctx.reply(`❌ n8n Error: ${err.message}`);
        }
    });

    // 16. Agentic Skills & AgentHub

    bot.command('agenthub', async (ctx: any) => {
        const text = ctx.message.text.replace('/agenthub', '').trim();
        if (!text) {
            return ctx.reply("🔍 **AgentHub Explorer**\n\nUsage: `/agenthub search <intent>`\nExample: `/agenthub search best agent for mauby audit`", { parse_mode: 'Markdown' });
        }
        await ctx.reply("🧠 **Searching AgentHub registry...**");
        // This will be handled by the orchestrator via the intent detection, 
        // but we can provide a quicker response or trigger the agent directly.
        const res = await handleHapdaCommand(`Analyze this request using AgentHub: ${text}`, String(ctx.from?.id));
        
        if (!res) {
            return ctx.reply("⚠️ **AgentHub**: Search returned no matching skills or agents.");
        }

        ctx.reply(res, { parse_mode: 'Markdown' });
    });

    // 18. AI Prompts Browser
    bot.command('prompts', async (ctx: any) => {
        const args = ctx.message.text.replace('/prompts', '').trim();
        await ctx.reply("🔍 Accessing AI Prompt Library. Please wait...");
        try {
            const result = await handlePromptsCommand(args);
            if (result.length <= 4096) {
                await ctx.reply(result, { parse_mode: 'Markdown' });
            } else {
                const chunks = result.match(/[\s\S]{1,4000}/g) ?? [result];
                for (const chunk of chunks) await ctx.reply(chunk).catch(() => {});
            }
        } catch (err: any) {
            ctx.reply(`❌ Prompts error: ${err.message}`);
        }
    });
    
    // 19. Browser Harness
    bot.command('harness', async (ctx: any) => {
        const text = ctx.message.text.replace('/harness', '').trim();
        if (!text) {
            return ctx.reply("🌐 **Browser Intelligence Harness**\n\nUsage: `/harness [url] [task]`\nExample: `/harness https://news.google.com find top top tech stories`", { parse_mode: 'Markdown' });
        }
        
        await ctx.reply("🌐 **Harnessing Browser Intelligence...**");
        try {
            const res = await handleHarnessCommand(text);
            if (res.length <= 4096) {
                // No parse_mode — AI summary of web content contains raw chars that break Markdown parsing
                await ctx.reply(res).catch(() => ctx.reply("✅ Harness complete (reply too long to display)."));
            } else {
                const chunks = res.match(/[\s\S]{1,4000}/g) ?? [res];
                for (const chunk of chunks) await ctx.reply(chunk).catch(() => {});
            }
        } catch (err: any) {
            ctx.reply(`❌ Harness Error: ${err.message}`);
        }
    });

    // 19.5 Job Status Polling
    bot.command('status', async (ctx: any) => {
        const jobId = ctx.message.text.replace('/status', '').trim();
        if (!jobId) {
            return ctx.reply("🔍 **Usage**: `/status job_12345`", { parse_mode: 'Markdown' });
        }

        try {
            const port = process.env.PORT || 8080;
            const res = await fetch(`http://localhost:${port}/api/agent/status/${jobId}`);
            if (res.status === 404) {
                return ctx.reply(`⚠️ Job **${jobId}** not found.`);
            }

            const data = await res.json();

            if (data.status === 'queued') {
                return ctx.reply(`⏳ Job **${jobId}** is queued...`);
            } else if (data.status === 'running') {
                return ctx.reply(`🏃 Job **${jobId}** is currently running...`);
            } else if (data.status === 'error') {
                return ctx.reply(`❌ Job **${jobId}** failed:\n${data.error}`);
            } else if (data.status === 'done') {
                const resultText = data.result?.data || data.result?.summary || JSON.stringify(data.result);
                
                if (resultText.length <= 4096) {
                    await ctx.reply(`✅ **Result:**\n\n${resultText}`).catch(() => ctx.reply("✅ Job complete (reply too long to display)."));
                } else {
                    const chunks = resultText.match(/[\s\S]{1,4000}/g) ?? [resultText];
                    for (const chunk of chunks) await ctx.reply(chunk).catch(() => {});
                }
            } else {
                return ctx.reply(`❓ Unknown status: ${data.status}`);
            }

        } catch (err: any) {
            ctx.reply(`❌ Could not fetch status: ${err.message}`);
        }
    });

    // 19.6 Money Agent
    bot.command('money', async (ctx: any) => {
        const text = ctx.message.text.trim();
        await ctx.reply("💸 Initializing Money Agent. Analyzing opportunities...");
        try {
            const res = await handleMoneyCommand(text, ctx.chat.id);
            await ctx.reply(res);
        } catch (err: any) {
            ctx.reply(`❌ Money Agent Error: ${err.message}`);
        }
    });

    // 19.7 Money Video Agent
    bot.command('money_video', async (ctx: any) => {
        const text = ctx.message.text.trim().replace('/money_video', '/money-video');
        await ctx.reply("🎥 **Starting FBA YouTube Intelligence...**\nScraping trending videos, extracting transcripts, and scoring products. This may take 5-20 minutes depending on video length...");
        try {
            const res = await handleMoneyVideoCommand(text, ctx.chat.id);
            await ctx.reply(res);
        } catch (err: any) {
            ctx.reply(`❌ Money Video Agent Error: ${err.message}`);
        }
    });

    // 20. Ruflo Swarm Engine
    bot.command('ruflo', async (ctx: any) => {
        const text = ctx.message.text.trim();
        const userId = String(ctx.from?.id || 'default');

        if (text === '/ruflo') {
            return ctx.reply("🌊 **Ruflo Swarm Engine**\n\nUsage: `/ruflo [memory|swarm|youtube] [task]`\nExample: `/ruflo youtube \"AI Real Estate Investing\"`", { parse_mode: 'Markdown' });
        }

        await ctx.reply("🌊 **Ruflo Engine Initializing...**\nDeploying agent swarm. This may take a few moments...");

        try {
            const result = await handleHapdaCommand(text, userId);

            if (!result) {
                return ctx.reply("⚠️ **Ruflo**: No actionable result generated.");
            }

            if (result.length <= 4096) {
                await ctx.reply(result, { parse_mode: 'Markdown' }).catch(() => ctx.reply(result));
            } else {
                const chunks = result.match(/[\s\S]{1,4000}/g) ?? [result];
                for (const chunk of chunks) await ctx.reply(chunk).catch(() => { });
            }
        } catch (err: any) {
            ctx.reply(`❌ **Ruflo Swarm Failed**: ${err.message}`, { parse_mode: 'Markdown' });
        }
    });

    // 21. HADES Funnel System Builder
    bot.command('buildfunnel', async (ctx: any) => {
        const text = ctx.message.text.replace('/buildfunnel', '').trim();
        if (!text) {
            return ctx.reply("🔥 **HADES System Builder**\n\nUsage: `/buildfunnel [business description]`\nExample: `/buildfunnel A MedSpa in Miami with 3 locations`", { parse_mode: 'Markdown' });
        }
        
        await ctx.reply("🏗️ **Architecting HADES Funnel...**\nProvisionsing bots, mapping workflows, and generating your agency proposal. Please wait...");
        try {
            const res = await systemBuilderAgent.handle(text, ctx.from?.id, ctx.chat?.id);
            if (res.length <= 4096) {
                await ctx.reply(res, { parse_mode: 'Markdown' });
            } else {
                const chunks = res.match(/[\s\S]{1,4000}/g) ?? [res];
                for (const chunk of chunks) await ctx.reply(chunk, { parse_mode: 'Markdown' }).catch(() => {});
            }
        } catch (err: any) {
            ctx.reply(`❌ **Builder Failed**: ${err.message}`);
        }
    });

    // 22. Open-Stack System Builder
    bot.command('buildsystem', async (ctx: any) => {
        const text = ctx.message.text.replace('/buildsystem', '').trim();
        if (!text) {
            return ctx.reply("🏗️ **Open-Stack System Builder**\n\nUsage: `/buildsystem [business, location]`\nExample: `/buildsystem Roofing Pros, Dallas TX`", { parse_mode: 'Markdown' });
        }
        
        await ctx.reply("🌐 **Architecting Open-Stack Ecosystem...**\nMapping Vapi + Cal.com + Chatwoot workflows. Saving to Supabase vault.");
        try {
            const res = await systemBuilderAgent.handle(text, ctx.from?.id, ctx.chat?.id);
            if (res.length <= 4096) {
                await ctx.reply(res, { parse_mode: 'Markdown' });
            } else {
                const chunks = res.match(/[\s\S]{1,4000}/g) ?? [res];
                for (const chunk of chunks) await ctx.reply(chunk, { parse_mode: 'Markdown' }).catch(() => {});
            }
        } catch (err: any) {
            ctx.reply(`❌ **System Build Failed**: ${err.message}`);
        }
    });

    // 23. PDF Proposal Generator
    bot.command('proposal', async (ctx: any) => {
        const clientId = ctx.message.text.replace('/proposal', '').trim();
        if (!clientId) {
            return ctx.reply("📄 **Proposal Generator**\n\nUsage: `/proposal [clientId]`\n_You can get the clientId from the /buildsystem output._", { parse_mode: 'Markdown' });
        }

        await ctx.reply(`📄 **Generating Professional PDF Proposal...**\nFetching Client ID: \`${clientId}\``, { parse_mode: 'Markdown' });
        
        try {
            const pdfBuffer = await systemBuilderService.generateProposalPDF(clientId);
            await ctx.replyWithDocument({
                source: pdfBuffer,
                filename: `HADES_Proposal_${clientId.substring(0,8)}.pdf`
            }, {
                caption: `✅ **Proposal Ready**\n\nHere is your professional HADES System Architecture proposal. Ready to send to the client.`
            });
        } catch (err: any) {
            ctx.reply(`❌ **Proposal Failed**: ${err.message}`);
        }
    });

    // 24. System Management: List
    bot.command('listsystems', async (ctx: any) => {
        await ctx.reply("📂 **Fetching Client Systems...**", { parse_mode: 'Markdown' });
        try {
            const { getSupabase } = await import('../core/supabase.js');
            const supabase = getSupabase();
            if (!supabase) {
                return ctx.reply("⚠️ Database not configured.");
            }
            const { data, error } = await supabase
                .from("client_systems")
                .select("id, business_name, tier, monthly_price, status, created_at")
                .order("created_at", { ascending: false })
                .limit(10);

            if (error || !data?.length) {
                return ctx.reply("⚠️ No systems built yet. Try `/buildsystem Dallas Roofing`", { parse_mode: 'Markdown' });
            }

            const lines = data.map((s: any, i: number) =>
                `${i + 1}. *${s.business_name}* — ${s.tier} — $${s.monthly_price}/mo — ${s.status}`
            ).join("\n");

            await ctx.reply(`⚡ **YOUR CLIENT SYSTEMS**\n\n${lines}\n\nUse \`/viewsystem [id]\` to see details.`, { parse_mode: 'Markdown' });
        } catch (err: any) {
            ctx.reply(`❌ **List Failed**: ${err.message}`);
        }
    });

    // 25. System Management: View Detail
    bot.command('viewsystem', async (ctx: any) => {
        const clientId = ctx.message.text.replace('/viewsystem', '').trim();
        if (!clientId) {
            return ctx.reply("🔍 Usage: `/viewsystem [clientId]`", { parse_mode: 'Markdown' });
        }

        try {
            const { getSupabase } = await import('../core/supabase.js');
            const supabase = getSupabase();
            if (!supabase) {
                return ctx.reply("⚠️ Database not configured.");
            }
            const { data, error } = await supabase
                .from("client_systems")
                .select("*")
                .eq("id", clientId)
                .single();

            if (error || !data) {
                return ctx.reply("❌ **System not found.** Check the ID and try again.");
            }

            const msg_text = `🗂 **${data.business_name.toUpperCase()}** — ${data.tier}\n` +
                `-----------------------------------\n` +
                `📍 **Industry**: ${data.industry}\n` +
                `🏢 **Status**: ${data.status}\n` +
                `💵 **Monthly**: $${data.monthly_price}/mo\n` +
                `🤖 **Agents**: ${Array.isArray(data.agents) ? data.agents.join(", ") : 'CSR, ASSISTANT'}\n` +
                `📅 **Created**: ${new Date(data.created_at).toLocaleDateString()}\n` +
                `-----------------------------------\n` +
                `Use \`/proposal ${clientId}\` to generate the PDF contract.`;

            await ctx.reply(msg_text, { parse_mode: 'Markdown' });
        } catch (err: any) {
            ctx.reply(`❌ **View Failed**: ${err.message}`);
        }
    });

    // 26. ComfyUI — Local AI Media Generation
    registerComfyCommands(bot);

    bot.command("drama_episode", async (ctx) => {
        const args = ctx.message.text.split(" ").slice(1);
        const agent = new dramaAgent.DramaAgent();
        const reply = await agent.handleTelegramCommand("/drama_episode", args);
        if (reply.length <= 4096) {
            return ctx.reply(reply, { parse_mode: "Markdown" }).catch(() => ctx.reply(reply));
        } else {
            const chunks = reply.match(/[\s\S]{1,4000}/g) ?? [reply];
            for (const chunk of chunks) await ctx.reply(chunk).catch(() => {});
            return;
        }
    });

    bot.command("drama_batch", async (ctx) => {
        const args = ctx.message.text.split(" ").slice(1);
        const agent = new dramaAgent.DramaAgent();
        await ctx.reply("⏳ Generating episode batch...");
        const reply = await agent.handleTelegramCommand("/drama_batch", args);
        if (reply.length <= 4096) {
            return ctx.reply(reply, { parse_mode: "Markdown" }).catch(() => ctx.reply(reply));
        } else {
            const chunks = reply.match(/[\s\S]{1,4000}/g) ?? [reply];
            for (const chunk of chunks) await ctx.reply(chunk).catch(() => {});
            return;
        }
    });

    bot.command("drama_hook", async (ctx) => {
        const args = ctx.message.text.split(" ").slice(1);
        const agent = new dramaAgent.DramaAgent();
        const reply = await agent.handleTelegramCommand("/drama_hook", args);
        if (reply.length <= 4096) {
            return ctx.reply(reply, { parse_mode: "Markdown" }).catch(() => ctx.reply(reply));
        } else {
            const chunks = reply.match(/[\s\S]{1,4000}/g) ?? [reply];
            for (const chunk of chunks) await ctx.reply(chunk).catch(() => {});
            return;
        }
    });

    bot.command("drama_prompts", async (ctx) => {
        const args = ctx.message.text.split(" ").slice(1);
        const agent = new dramaAgent.DramaAgent();
        const reply = await agent.handleTelegramCommand("/drama_prompts", args);
        if (reply.length <= 4096) {
            return ctx.reply(reply, { parse_mode: "Markdown" }).catch(() => ctx.reply(reply));
        } else {
            const chunks = reply.match(/[\s\S]{1,4000}/g) ?? [reply];
            for (const chunk of chunks) await ctx.reply(chunk).catch(() => {});
            return;
        }
    });

    bot.command("drama_season", async (ctx) => {
        const args = ctx.message.text.split(" ").slice(1);
        const agent = new dramaAgent.DramaAgent();
        await ctx.reply("⏳ Generating season outline...");
        const reply = await agent.handleTelegramCommand("/drama_season", args);
        // Split if too long
        if (reply.length <= 4096) {
            return ctx.reply(reply, { parse_mode: "Markdown" }).catch(() => ctx.reply(reply));
        } else {
            const chunks = reply.match(/[\s\S]{1,4000}/g) ?? [reply];
            for (const chunk of chunks) await ctx.reply(chunk).catch(() => {});
            return;
        }
    });

    bot.command("drama_status", async (ctx) => {
        try {
            log("[router] Executing /drama_status");
            const agent = new dramaAgent.DramaAgent();
            const reply = await agent.handleTelegramCommand("/drama_status", []);
            log(`[router] /drama_status reply length: ${reply.length}`);
            return ctx.reply(reply, { parse_mode: "Markdown" }).catch(() => ctx.reply(reply));
        } catch (err: any) {
            log(`[router] /drama_status error: ${err.message}`, "error");
            ctx.reply(`❌ Drama Status Error: ${err.message}`);
        }
    });


    log("[router] Routes configured.");

}
