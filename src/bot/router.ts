import { Telegraf } from 'telegraf';
import { log } from '../core/config.js';
import { MasterTraderAgent } from '../agents/MasterTraderAgent.js';
import { realEstateAgent } from '../agents/realEstateAgent.js';
import { AdsAgent } from '../agents/ads/AdsAgent.js';
import { registerWebsiteCommand } from '../agents/website/websiteCommand.js';
import * as dramaAgent from '../agents/drama/DramaAgent.js';
import { registerLeadCommands } from '../commands/leads.js';
import { registerCinemaCommands } from '../agents/cinema/cinemaCommand.js';
import { registerStuyzaCommands } from '../agents/stuyza/stuyzaCommand.js';
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

export function setupRouter(bot: Telegraf) {
    log("[router] Initializing Command Router...");

    // Global Middleware for Permission Check
    bot.use(async (ctx: any, next) => {
        const allowedIds = (process.env.TELEGRAM_ALLOWED_USER_IDS || "").split(",").map(Number);
        const ownerId = Number(process.env.TELEGRAM_OWNER_ID);
        if (ownerId && !allowedIds.includes(ownerId)) allowedIds.push(ownerId);

        const userId = ctx.from?.id;
        if (!userId) return next();

        // If it's a command, enforce ownership
        if (ctx.message?.text?.startsWith("/")) {
            // Check if we have actual IDs configured (not just empty or placeholders)
            const hasAuthList = allowedIds.length > 0 && allowedIds.every(id => id > 10000000); // Simple check for likely real IDs

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
        "/triage - Manual email/task triage"
    ));

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
        const res = await new MasterTraderAgent().ask("Give me a trading account summary and current session.");
        ctx.reply(String(res.content));
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

    log("[router] Routes configured.");
}
