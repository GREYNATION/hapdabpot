/**
 * websiteCommand.ts
 * Registers the /buildsite command with the Telegraf bot.
 *
 * Usage: /buildsite <business description>
 * Example: /buildsite Cash home buyers in South Jersey, fast closings, no repairs needed
 */

import { Context } from "telegraf";
import { runWebsitePipeline, PipelineStep } from "./WebsitePipeline.js";

export function registerWebsiteCommand(bot: any) {
  bot.command("buildsite", async (ctx: Context) => {
    const msg = ctx.message as any;
    const input = msg?.text?.replace("/buildsite", "").trim();

    if (!input) {
      return ctx.reply(
        "⚠️ Please describe your business.\n\nExample:\n`/buildsite Cash home buyers in South Jersey — fast closings, no repairs needed`",
        { parse_mode: "Markdown" }
      );
    }

    // Send initial status message
    const statusMsg = await ctx.reply(
      `🤖 *Website Pipeline Starting...*\n\n` +
        `⏳ Step 1: Brand Analysis — running\n` +
        `⏳ Step 2: Scene Generation — pending\n` +
        `⏳ Step 3: Website Builder — pending`,
      { parse_mode: "Markdown" }
    );

    const chatId = ctx.chat!.id;
    const msgId = (statusMsg as any).message_id;

    const stepEmoji: Record<string, string> = {
      running: "🔄",
      done: "✅",
      error: "❌",
      pending: "⏳",
    };

    const stepStatuses = [
      { name: "Brand Analysis", status: "pending" },
      { name: "Scene Generation", status: "pending" },
      { name: "Website Builder", status: "pending" },
    ];

    const updateStatusMessage = async (updatedStep: PipelineStep) => {
      // Update local tracking
      const idx = stepStatuses.findIndex((s) => s.name === updatedStep.name);
      if (idx >= 0) stepStatuses[idx].status = updatedStep.status;

      // Post step output when done
      if (updatedStep.status === "done" && updatedStep.output) {
        await (ctx as any).telegram.sendMessage(chatId, updatedStep.output, {
          parse_mode: "Markdown",
        }).catch(() => {
          // Fallback without markdown if parse fails
          (ctx as any).telegram.sendMessage(chatId, updatedStep.output!).catch(() => {});
        });
      }

      // Update the overview status message
      const overview =
        `🤖 *Website Pipeline*\n\n` +
        stepStatuses
          .map((s) => `${stepEmoji[s.status] ?? "⏳"} ${s.name} — ${s.status}`)
          .join("\n");

      try {
        await (ctx as any).telegram.editMessageText(
          chatId,
          msgId,
          undefined,
          overview,
          { parse_mode: "Markdown" }
        );
      } catch {
        // Message not modified or already deleted — ignore
      }
    };

    try {
      const result = await runWebsitePipeline(
        input,
        updateStatusMessage,
        "./generated-sites"
      );

      // Send the HTML file as a Telegram document
      const fileBuffer = Buffer.from(result.site.html, "utf-8");
      await (ctx as any).telegram.sendDocument(
        chatId,
        { source: fileBuffer, filename: result.site.filename },
        {
          caption:
            `🌐 *Your Website is Ready!*\n\n` +
            `📄 \`${result.site.filename}\`\n` +
            `🏢 ${result.profile.businessName}\n\n` +
            `*Deploy options:*\n` +
            `• Drag to [Netlify Drop](https://app.netlify.com/drop)\n` +
            `• Push to GitHub → Railway\n` +
            `• Upload to any static host`,
          parse_mode: "Markdown",
        }
      );
    } catch (err: any) {
      await ctx.reply(`❌ Pipeline error: ${err.message}`);
    }
  });
}
