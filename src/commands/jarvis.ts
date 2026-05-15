import { Telegraf } from 'telegraf';
import { jarvisService } from '../services/jarvisService.js';
import { log } from '../core/config.js';
import { sanitizeHTML } from '../core/telegramUtils.js';

export function registerJarvisCommand(bot: Telegraf) {
  bot.command('jarvis', async (ctx: any) => {
    const query = ctx.message.text.replace('/jarvis', '').trim();
    
    if (!query) {
      return ctx.reply(
        "🤖 <b>OpenJarvis Intelligence</b>\n\n" +
        "Usage: <code>/jarvis [your question or task]</code>\n" +
        "Example: <code>/jarvis tell me about recent tech trends</code>",
        { parse_mode: 'HTML' }
      );
    }

    await ctx.reply("🤖 <b>Jarvis is thinking...</b>", { parse_mode: 'HTML' });

    try {
      const response = await jarvisService.ask(query);
      
      if (response.length <= 4096) {
        await ctx.reply(response);
      } else {
        const chunks = response.match(/[\s\S]{1,4000}/g) ?? [response];
        for (const chunk of chunks) {
          await ctx.reply(chunk).catch(() => {});
        }
      }
    } catch (err: any) {
      log(`[jarvis] Command failed: ${err.message}`, 'error');
      ctx.reply(`❌ <b>Jarvis Error</b>: ${sanitizeHTML(err.message)}`, { parse_mode: 'HTML' });
    }
  });
}
