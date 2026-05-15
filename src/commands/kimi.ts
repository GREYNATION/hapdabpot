import { Telegraf } from 'telegraf';
import { askAI } from '../core/ai.js';
import { log } from '../core/config.js';
import { sanitizeHTML } from '../core/telegramUtils.js';

export function registerKimiCommand(bot: Telegraf) {
    bot.command('kimi', async (ctx: any) => {
        const text = ctx.message.text.replace('/kimi', '').trim();
        
        if (!text) {
            return ctx.reply(
                "🧠 <b>Kimi-K2 Reasoning specialist</b>\n\n" +
                "High-context reasoning for complex logic and tool orchestration.\n\n" +
                "Usage: <code>/kimi [complex task or question]</code>\n" +
                "Example: <code>/kimi Analyze the current real estate market trends in Houston and suggest a flipping strategy.</code>",
                { parse_mode: 'HTML' }
            );
        }

        await ctx.reply("🧠 <b>Kimi is thinking...</b>", { parse_mode: 'HTML' });

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
            ctx.reply(`❌ <b>Kimi failed</b>: ${sanitizeHTML(err.message)}`, { parse_mode: 'HTML' });
        }
    });
}
