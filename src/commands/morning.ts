import { Telegraf } from 'telegraf';
import { jarvisService } from '../services/jarvisService.js';
import { log } from '../core/config.js';

export function registerMorningCommand(bot: Telegraf) {
  bot.command('morning', async (ctx: any) => {
    try {
      await ctx.sendChatAction("record_voice");
      const { text, voiceBuffer } = await jarvisService.getMorningDigest();
      
      await ctx.reply(text, { parse_mode: 'Markdown' });
      
      if (voiceBuffer) {
        await ctx.replyWithVoice({ source: voiceBuffer });
      }
    } catch (err: any) {
      log(`[morning] Command failed: ${err.message}`, 'error');
      ctx.reply(`❌ **Morning Briefing Failed**: ${err.message}`);
    }
  });
}
