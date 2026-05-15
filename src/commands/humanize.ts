import { Telegraf } from 'telegraf';
import { humanize } from '../core/humanizer.js';
import { log } from '../core/config.js';
import { sanitizeHTML } from '../core/telegramUtils.js';

export function registerHumanizeCommand(bot: Telegraf) {
    bot.command('humanize', async (ctx: any) => {
        const text = ctx.message.text.replace('/humanize', '').trim();
        
        if (!text) {
            return ctx.reply(
                "✍️ <b>Humanizer Service</b>\n\n" +
                "Refines AI-generated text to sound natural and human.\n\n" +
                "Usage: <code>/humanize [text]</code>\n" +
                "Example: <code>/humanize Our revolutionary platform serves as a testament to innovation.</code>",
                { parse_mode: 'HTML' }
            );
        }

        await ctx.reply("✍️ <b>Humanizing text...</b>", { parse_mode: 'HTML' });

        try {
            const result = await humanize(text);
            
            if (result.length <= 4096) {
                await ctx.reply(result);
            } else {
                const chunks = result.match(/[\s\S]{1,4000}/g) ?? [result];
                for (const chunk of chunks) await ctx.reply(chunk);
            }
        } catch (err: any) {
            log(`[humanize] Command failed: ${err.message}`, "error");
            ctx.reply(`❌ <b>Humanization failed</b>: ${sanitizeHTML(err.message)}`, { parse_mode: 'HTML' });
        }
    });
}
