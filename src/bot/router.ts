import { Telegraf, Context } from "telegraf";
import { orchestrate, generateMorningBriefing } from "../agents/orchestrator/OrchestratorAgent.js";

// ─── Bot Init ─────────────────────────────────────────────────────────────────

export function createBot(): Telegraf {
  const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN!);

  // ── Middleware: Auth gate ──────────────────────────────────────────────────
  // Only respond to Hap's Telegram user ID
  const ALLOWED_USER_ID = Number(process.env.TELEGRAM_ALLOWED_USER_ID ?? 0);

  bot.use(async (ctx: Context, next) => {
    const userId = ctx.from?.id;
    if (ALLOWED_USER_ID && userId !== ALLOWED_USER_ID) {
      console.warn(`[Bot] Blocked unauthorized user: ${userId}`);
      return; // Silently ignore
    }
    return next();
  });

  // ── Middleware: Typing indicator ───────────────────────────────────────────
  bot.use(async (ctx: Context, next) => {
    if (ctx.chat) {
      await ctx.telegram.sendChatAction(ctx.chat.id, "typing").catch(() => {});
    }
    return next();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // SYSTEM COMMANDS
  // ─────────────────────────────────────────────────────────────────────────

  // /start — Welcome + status
  bot.command("start", async (ctx) => {
    await ctx.reply(
      `🧠 *hapda_bot Master Brain Online*\n\n` +
      `3 agents active:\n` +
      `🏠 Real Estate — South Jersey, Brooklyn, Philly\n` +
      `📈 Trading — BTC/USD, GBP/USD\n` +
      `🎬 Drama — TikTok 3D Mini-Series\n\n` +
      `Just talk naturally. I'll route to the right agent.\n` +
      `Or use a slash command:\n` +
      `/brief — Morning briefing\n` +
      `/leads — Real estate pipeline\n` +
      `/signals — Trading signals\n` +
      `/scene — Drama scene writer\n` +
      `/status — System status`,
      { parse_mode: "Markdown" }
    );
  });

  // /status — System health check
  bot.command("status", async (ctx) => {
    const { readGlobalMemory } = await import("../core/memory.js");
    const [lastBoot, botStatus, activeAgents] = await Promise.all([
      readGlobalMemory("last_boot"),
      readGlobalMemory("bot_status"),
      readGlobalMemory("active_agents"),
    ]);

    const agents = JSON.parse(activeAgents ?? "[]") as string[];
    const agentList = agents.map((a) => `  ✅ ${a}`).join("\n");

    await ctx.reply(
      `🟢 *System Status*\n\n` +
      `Status: ${botStatus ?? "unknown"}\n` +
      `Last boot: ${lastBoot ? new Date(lastBoot).toLocaleString() : "unknown"}\n\n` +
      `Active Agents:\n${agentList}`,
      { parse_mode: "Markdown" }
    );
  });

  // /brief — Morning briefing on demand
  bot.command("brief", async (ctx) => {
    await ctx.reply("⏳ Generating briefing...");
    try {
      const briefing = await generateMorningBriefing();
      await ctx.reply(briefing, { parse_mode: "Markdown" });
    } catch (err) {
      await ctx.reply(`❌ Briefing failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // REAL ESTATE COMMANDS
  // ─────────────────────────────────────────────────────────────────────────

  // /leads — Show active lead pipeline
  bot.command("leads", async (ctx) => {
    const { listAgentMemory } = await import("../core/memory.js");
    const entries = await listAgentMemory("real_estate");
    const leads = entries.filter((e) => e.key.startsWith("lead_"));

    if (leads.length === 0) {
      await ctx.reply("📭 No active leads. Say 'add a lead' or paste a property address.");
      return;
    }

    const list = leads
      .slice(0, 10)
      .map((l, i) => {
        try {
          const data = JSON.parse(l.value);
          return `${i + 1}. ${data.address ?? l.key} — ${data.status ?? "new"}`;
        } catch {
          return `${i + 1}. ${l.key}`;
        }
      })
      .join("\n");

    await ctx.reply(`🏠 *Active Leads (${leads.length})*\n\n${list}`, {
      parse_mode: "Markdown",
    });
  });

  // /mao — Quick MAO calculator
  bot.command("mao", async (ctx) => {
    const args = ctx.message.text.split(" ").slice(1);
    if (args.length < 2) {
      await ctx.reply(
        "Usage: /mao [ARV] [repairs]\nExample: /mao 200000 25000\n\nFormula: ARV × 70% − Repairs = MAO"
      );
      return;
    }
    const arv = parseFloat(args[0]);
    const repairs = parseFloat(args[1]);
    if (isNaN(arv) || isNaN(repairs)) {
      await ctx.reply("❌ Invalid numbers. Example: /mao 200000 25000");
      return;
    }
    const mao = arv * 0.7 - repairs;
    await ctx.reply(
      `📊 *MAO Calculation*\n\n` +
      `ARV: $${arv.toLocaleString()}\n` +
      `Repairs: $${repairs.toLocaleString()}\n` +
      `────────────────\n` +
      `MAO: *$${mao.toLocaleString()}*\n\n` +
      `(${arv.toLocaleString()} × 70% − ${repairs.toLocaleString()})`,
      { parse_mode: "Markdown" }
    );
  });

  // /outreach — Draft outreach for a lead
  bot.command("outreach", async (ctx) => {
    const text = ctx.message.text.replace("/outreach", "").trim();
    if (!text) {
      await ctx.reply("Usage: /outreach [property address or lead details]");
      return;
    }
    const response = await orchestrate(
      `Draft a seller outreach SMS and email for this lead: ${text}`,
      ctx.from.id
    );
    await ctx.reply(response);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TRADING COMMANDS
  // ─────────────────────────────────────────────────────────────────────────

  // /signals — Recent trading signals
  bot.command("signals", async (ctx) => {
    const { getRecentLogs } = await import("../core/memory.js");
    const logs = await getRecentLogs("trading", 5);

    if (logs.length === 0) {
      await ctx.reply("📊 No trading signals logged yet. Waiting for TradingView webhooks.");
      return;
    }

    const list = logs
      .map((l) => `• ${new Date(l.created_at!).toLocaleTimeString()}: ${l.summary}`)
      .join("\n");

    await ctx.reply(`📈 *Recent Signals*\n\n${list}`, { parse_mode: "Markdown" });
  });

  // /pine — Generate Pine Script
  bot.command("pine", async (ctx) => {
    const text = ctx.message.text.replace("/pine", "").trim();
    if (!text) {
      await ctx.reply("Usage: /pine [describe the strategy]\nExample: /pine RSI oversold bounce with EMA filter");
      return;
    }
    const response = await orchestrate(
      `Write Pine Script v5 for this strategy: ${text}`,
      ctx.from.id
    );
    await ctx.reply(response);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // DRAMA AGENT COMMANDS
  // ─────────────────────────────────────────────────────────────────────────

  // /scene — Write a scene
  bot.command("scene", async (ctx) => {
    const text = ctx.message.text.replace("/scene", "").trim();
    const prompt = text || "Write a dramatic opening scene for a new TikTok mini-series episode.";
    const response = await orchestrate(`/SCENE ${prompt}`, ctx.from.id);
    await ctx.reply(response);
  });

  // /hook — Write TikTok hooks
  bot.command("hook", async (ctx) => {
    const text = ctx.message.text.replace("/hook", "").trim();
    if (!text) {
      await ctx.reply("Usage: /hook [episode theme or concept]\nExample: /hook billionaire loses everything in one day");
      return;
    }
    const response = await orchestrate(`/HOOK ${text}`, ctx.from.id);
    await ctx.reply(response);
  });

  // /ghost — Write in a character's voice
  bot.command("ghost", async (ctx) => {
    const text = ctx.message.text.replace("/ghost", "").trim();
    if (!text) {
      await ctx.reply("Usage: /ghost [character name]: [what they need to say]\nExample: /ghost Marcus: confront his business partner");
      return;
    }
    const response = await orchestrate(`/GHOST ${text}`, ctx.from.id);
    await ctx.reply(response);
  });

  // /series — Plan a multi-episode arc
  bot.command("series", async (ctx) => {
    const text = ctx.message.text.replace("/series", "").trim();
    if (!text) {
      await ctx.reply("Usage: /series [series concept]\nExample: /series 5-episode arc about a real estate mogul's rise and fall");
      return;
    }
    const response = await orchestrate(`/SERIES ${text}`, ctx.from.id);
    await ctx.reply(response);
  });

  // /cast — Generate character descriptions + visual prompts
  bot.command("cast", async (ctx) => {
    const text = ctx.message.text.replace("/cast", "").trim();
    if (!text) {
      await ctx.reply("Usage: /cast [character description]\nExample: /cast a ruthless 35-year-old female CEO, power suit, cold eyes");
      return;
    }
    const response = await orchestrate(`/CAST ${text}`, ctx.from.id);
    await ctx.reply(response);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // NATURAL LANGUAGE CATCH-ALL
  // All unmatched messages go through the Orchestrator
  // ─────────────────────────────────────────────────────────────────────────

  bot.on("text", async (ctx) => {
    const message = ctx.message.text;
    const userId = ctx.from.id;

    try {
      const response = await orchestrate(message, userId);

      // Telegram has 4096 char limit — split if needed
      if (response.length <= 4096) {
        await ctx.reply(response, { parse_mode: "Markdown" }).catch(() =>
          ctx.reply(response) // Retry without markdown if parse fails
        );
      } else {
        // Split into chunks
        const chunks = response.match(/[\s\S]{1,4000}/g) ?? [response];
        for (const chunk of chunks) {
          await ctx.reply(chunk).catch(() => {});
        }
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error("[Bot] Handler error:", errMsg);
      await ctx.reply(`⚠️ Something went wrong: ${errMsg.slice(0, 200)}`);
    }
  });

  // ─── Error handler ────────────────────────────────────────────────────────
  bot.catch((err, ctx) => {
    console.error("[Bot] Telegraf error:", err);
    ctx.reply("⚠️ Unexpected error. Check Railway logs.").catch(() => {});
  });

  return bot;
}
