import { Telegraf } from 'telegraf';
import { jarvisService } from '../services/jarvisService.js';
import { log } from '../core/config.js';

export function registerJarvisCommand(bot: Telegraf) {
  bot.command('jarvis', async (ctx: any) => {
    const query = ctx.message.text.replace('/jarvis', '').trim();
    
    if (!query) {
      return ctx.reply(
        "🤖 **OpenJarvis Intelligence**\n\n" +
        "Usage: `/jarvis [your question or task]`\n" +
        "Example: `/jarvis tell me about recent tech trends`",
        { parse_mode: 'Markdown' }
      );
    }

    await ctx.reply("🤖 **Jarvis is thinking...**");

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
      ctx.reply(`❌ **Jarvis Error**: ${err.message}`);
    }
  });
}
