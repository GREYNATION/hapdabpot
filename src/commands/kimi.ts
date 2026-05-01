import { Telegraf } from 'telegraf';
import { askAI } from '../core/ai.js';
import { log } from '../core/config.js';

export function registerKimiCommand(bot: Telegraf) {
    bot.command('kimi', async (ctx: any) => {
        const text = ctx.message.text.replace('/kimi', '').trim();
        
        if (!text) {
            return ctx.reply(
                "🧠 **Kimi-K2 Reasoning specialist**\n\n" +
                "High-context reasoning for complex logic and tool orchestration.\n\n" +
                "Usage: `/kimi [complex task or question]`\n" +
                "Example: `/kimi Analyze the current real estate market trends in Houston and suggest a flipping strategy.`",
                { parse_mode: 'Markdown' }
            );
        }

        await ctx.reply("🧠 **Kimi is thinking...**");

        try {
            const result = await askAI(text, "You are Kimi-K2, a specialist in logical reasoning and strategic planning.", {
                model: "moonshot-v1-128k", // Or the specific K2 model name if different
                temperature: 0.3
            });
            
            if (result.content.length <= 4096) {
                await ctx.reply(result.content);
            } else {
                const chunks = result.content.match(/[\s\S]{1,4000}/g) ?? [result.content];
                for (const chunk of chunks) await ctx.reply(chunk);
            }
        } catch (err: any) {
            log(`[kimi] Command failed: ${err.message}`, "error");
            ctx.reply(`❌ **Kimi failed**: ${err.message}`);
        }
    });
}
