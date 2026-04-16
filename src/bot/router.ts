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
        "/stuyza - Video production studio"
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
            for (const chunk of chunks) await ctx.reply(chunk).catch(() => {});
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

    // 13. Markets & Intelligence
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

    log("[router] Routes configured.");
}
