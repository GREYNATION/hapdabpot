import { Telegraf } from 'telegraf';
import { log } from '../core/config.js';
import { orchestrator } from '../agents/orchestrator/OrchestratorAgent.js';
import { MasterTraderAgent } from '../agents/trading/MasterTraderAgent.js';
import { realEstateAgent } from '../agents/real_estate/RealEstateAgent.js';
import { AdsAgent } from '../agents/ads/AdsAgent.js';
import * as dramaAgent from '../agents/drama/DramaAgent.js';

/**
 * Commands Router
 * Centralizes all Telegraf command handlers and agent registrations.
 */
export function setupRouter(bot: Telegraf) {
    log("[router] Initializing Command Router...");

    // 1. Register Agents with Orchestrator
    orchestrator.registerTraderAgent(MasterTraderAgent);
    orchestrator.registerRealEstateAgent(realEstateAgent);
    orchestrator.registerDramaAgent(dramaAgent);

    // 2. Base Commands
    bot.start((ctx) => ctx.reply("🤖 HapdaBot Modernized Infrastructure Online.\n\nCommands:\n/scrape — find motivated seller leads\n/surplus — run surplus overage scan\n/trade — trading account status\n/ads <skill> — run ad strategy (hooks, copy, funnel, budget, audit, strategy...)"));

    // 3. Real Estate Commands
    bot.command('scrape', async (ctx) => {
        await ctx.reply("🔎 Searching for motivated sellers...");
        const res = await realEstateAgent.handle("find leads");
        ctx.reply(String(res));
    });

    bot.command('surplus', async (ctx) => {
        await ctx.reply("🚀 Initiating Surplus Overage Scan...");
        const res = await realEstateAgent.handle("auto scan surplus");
        ctx.reply(String(res));
    });

    // 4. Trading Commands
    bot.command('trade', async (ctx) => {
        const res = await new MasterTraderAgent().ask("Give me a trading account summary and current session.");
        ctx.reply(String(res.content));
    });

    // 5. Ads Agent — 15 skills accessible via /ads <skill>
    bot.command('ads', async (ctx) => {
        const userId = ctx.from?.id ?? 0;
        const text = ctx.message.text.replace('/ads', '').trim();

        if (!text) {
            return ctx.reply(
                `🎯 *Ad Strategy Commands*\n\n` +
                `/ads strategy — Full 5-agent strategy\n` +
                `/ads quick — 60-second readiness score\n` +
                `/ads audience — Buyer personas\n` +
                `/ads competitors — Competitive intel\n` +
                `/ads keywords — Google Ads keywords\n` +
                `/ads copy tiktok — TikTok ad copy\n` +
                `/ads copy facebook — Facebook ad copy\n` +
                `/ads hooks — 20 scroll-stopping hooks\n` +
                `/ads video — Video scripts (15s/30s/60s)\n` +
                `/ads funnel — Conversion funnel\n` +
                `/ads budget 5000 — Budget allocation\n` +
                `/ads testing — A/B testing plan\n` +
                `/ads landing — Landing page audit\n` +
                `/ads audit — Performance audit\n` +
                `/ads report — Full strategy report`,
                { parse_mode: 'Markdown' }
            );
        }

        await ctx.reply('⏳ Running ad analysis...');
        const result = await AdsAgent.handle(`ads ${text}`, userId);

        if (result.length <= 4096) {
            await ctx.reply(result, { parse_mode: 'Markdown' }).catch(() => ctx.reply(result));
        } else {
            const chunks = result.match(/[\s\S]{1,4000}/g) ?? [result];
            for (const chunk of chunks) {
                await ctx.reply(chunk).catch(() => {});
            }
        }
    });

    // /hooks — Quick hook generator
    bot.command('hooks', async (ctx) => {
        const topic = ctx.message.text.replace('/hooks', '').trim() || 'real estate motivated sellers and TikTok mini-drama';
        await ctx.reply('⏳ Generating 20 hooks...');
        const result = await AdsAgent.handle(`ads hooks ${topic}`, ctx.from?.id ?? 0);
        await ctx.reply(result.slice(0, 4096)).catch(() => ctx.reply('Hooks generated — check logs.'));
    });

    // /copy — Quick ad copy generation
    bot.command('copy', async (ctx) => {
        const text = ctx.message.text.replace('/copy', '').trim();
        if (!text) {
            return ctx.reply('Usage: /copy <platform> [product]\nExample: /copy facebook motivated seller leads');
        }
        await ctx.reply('⏳ Writing ad copy...');
        const result = await AdsAgent.handle(`ads copy ${text}`, ctx.from?.id ?? 0);
        await ctx.reply(result.slice(0, 4096)).catch(() => ctx.reply('Copy generated — check logs.'));
    });

    // 6. General AI Route (Default)
    bot.on('text', async (ctx) => {
        const text = ctx.message.text;
        if (text.startsWith('/')) return;

        // Route /ads-style natural language to AdsAgent
        const lower = text.toLowerCase();
        if (
            lower.includes("ad copy") || lower.includes("facebook ad") ||
            lower.includes("tiktok ad") || lower.includes("google ads") ||
            lower.includes("ad hook") || lower.includes("ad strategy") ||
            lower.includes("ad budget") || lower.includes("ad funnel")
        ) {
            await ctx.sendChatAction('typing');
            const res = await AdsAgent.handle(text, ctx.from?.id ?? 0);
            return ctx.reply(res.length <= 4096 ? res : res.slice(0, 4090) + "…");
        }

        await ctx.sendChatAction('typing');
        const res = await orchestrator.route(text);
        ctx.reply(res.response);
    });

    log("[router] Routes configured.");
}
