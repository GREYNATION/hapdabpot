import { Telegraf } from 'telegraf';
import { log } from '../core/config.js';
import { orchestrator } from '../agents/orchestrator/OrchestratorAgent.js';
import { MasterTraderAgent } from '../agents/trading/MasterTraderAgent.js';
import { realEstateAgent } from '../agents/real_estate/RealEstateAgent.js';
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
    bot.start((ctx) => ctx.reply("🤖 HapdaBot Modernized Infrastructure Online."));

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
        const res = await new MasterTraderAgent().ask("balance");
        ctx.reply(String(res));
    });

    // 5. General AI Route (Default)
    bot.on('text', async (ctx) => {
        const text = ctx.message.text;
        if (text.startsWith('/')) return;

        await ctx.sendChatAction('typing');
        const res = await orchestrator.route(text);
        ctx.reply(res.response);
    });

    log("[router] Routes configured.");
}
