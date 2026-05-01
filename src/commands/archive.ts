import { Telegraf } from 'telegraf';
import { log } from '../core/config.js';
import { CouncilOrchestrator } from '../core/orchestrator/councilOrchestrator.js';

const orchestrator = new CouncilOrchestrator();

export function registerArchiveCommand(bot: Telegraf) {
  bot.command('archive', async (ctx: any) => {
    const input = ctx.message.text.replace('/archive', '').trim();
    
    if (!input) {
      return ctx.reply(
        "📚 **Librarian: Knowledge Archive**\n\n" +
        "Usage: `/archive [URL or Text]`\n" +
        "Example: `/archive https://example.com/article`",
        { parse_mode: 'Markdown' }
      );
    }

    await ctx.reply("📚 **Librarian is cataloging the content...**");

    try {
      // Direct routing for the archive request
      // We explicitly ask the researcher to act as a librarian
      const result = await orchestrator.chat(`[LIBRARIAN ARCHIVE] ${input}`, ctx.chat.id);
      
      if (result.length <= 4096) {
        await ctx.reply(result, { parse_mode: 'Markdown' });
      } else {
        const chunks = result.match(/[\s\S]{1,4000}/g) ?? [result];
        for (const chunk of chunks) {
          await ctx.reply(chunk).catch(() => {});
        }
      }
    } catch (err: any) {
      log(`[archive] Command failed: ${err.message}`, 'error');
      ctx.reply(`❌ **Archive Error**: ${err.message}`);
    }
  });

  bot.command('library', async (ctx: any) => {
    const query = ctx.message.text.replace('/library', '').trim();
    
    if (!query) {
      return ctx.reply("Usage: `/library [search term]`");
    }

    await ctx.reply("🔍 **Searching Council Vault...**");

    try {
      const result = await orchestrator.chat(`[LIBRARIAN SEARCH] ${query}`, ctx.chat.id);
      await ctx.reply(result, { parse_mode: 'Markdown' });
    } catch (err: any) {
      log(`[library] Command failed: ${err.message}`, 'error');
      ctx.reply(`❌ **Library Error**: ${err.message}`);
    }
  });
}
