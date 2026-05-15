import { Telegraf } from 'telegraf';
import { log } from '../core/config.js';
import { CouncilOrchestrator } from '../core/orchestrator/councilOrchestrator.js';
import { sanitizeHTML } from '../core/telegramUtils.js';

const orchestrator = new CouncilOrchestrator();

export function registerArchiveCommand(bot: Telegraf) {
  bot.command('archive', async (ctx: any) => {
    const input = ctx.message.text.replace('/archive', '').trim();
    
    if (!input) {
      return ctx.reply(
        "📚 <b>Librarian: Knowledge Archive</b>\n\n" +
        "Usage: <code>/archive [URL or Text]</code>\n" +
        "Example: <code>/archive https://example.com/article</code>",
        { parse_mode: 'HTML' }
      );
    }

    await ctx.reply("📚 <b>Librarian is cataloging the content...</b>", { parse_mode: 'HTML' });

    try {
      // Direct routing for the archive request
      // We explicitly ask the researcher to act as a librarian
      const result = await orchestrator.chat(`[LIBRARIAN ARCHIVE] ${input}`, ctx.chat.id);
      
      if (result.length <= 4096) {
        await ctx.reply(result, { parse_mode: 'HTML' });
      } else {
        const chunks = result.match(/[\s\S]{1,4000}/g) ?? [result];
        for (const chunk of chunks) {
          await ctx.reply(chunk, { parse_mode: 'HTML' }).catch(() => {});
        }
      }
    } catch (err: any) {
      log(`[archive] Command failed: ${err.message}`, 'error');
      ctx.reply(`❌ <b>Archive Error</b>: <code>${sanitizeHTML(err.message)}</code>`, { parse_mode: 'HTML' });
    }
  });

  bot.command('library', async (ctx: any) => {
    const query = ctx.message.text.replace('/library', '').trim();
    
    if (!query) {
      return ctx.reply("Usage: <code>/library [search term]</code>", { parse_mode: 'HTML' });
    }

    await ctx.reply("🔍 <b>Searching Council Vault...</b>", { parse_mode: 'HTML' });

    try {
      const result = await orchestrator.chat(`[LIBRARIAN SEARCH] ${query}`, ctx.chat.id);
      await ctx.reply(result, { parse_mode: 'HTML' });
    } catch (err: any) {
      log(`[library] Command failed: ${err.message}`, 'error');
      ctx.reply(`❌ <b>Library Error</b>: <code>${sanitizeHTML(err.message)}</code>`, { parse_mode: 'HTML' });
    }
  });
}
