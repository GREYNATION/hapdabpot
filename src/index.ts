import dotenv from "dotenv";
import { Telegraf, Context } from "telegraf";
import { runStartupSequence } from "./core/startup.js";
import { orchestrate } from "./agents/orchestrator/OrchestratorAgent.js";
import { startWebServer } from "./webServer.js";
import { initWebSocket } from "./core/websocket.js";
import { startMorningBriefing } from "./cron/morningBriefing.js";
import { startLeadAlerts } from "./cron/leadAlerts.js";
import { startOutreachCron, registerOutreachHandlers } from "./services/outreachService.js";
import { initMarketScans } from "./cron/marketScans.js";
import { startContentCron } from "./cron/contentCron.js"; 
import { startFollowUpCron } from "./cron/followUpCron.js";

dotenv.config();

let bot: Telegraf<Context>;

function registerBotCommands(botInstance: Telegraf<Context>) {
  botInstance.start(async (ctx: Context) => {
    await ctx.reply(
      `🧠 *hapda_bot Master Brain Online*\n\nThree agents ready:\n🏠 Real Estate — wholesaling, leads, deals\n📈 Trading — BTC/USD, GBP/USD, Pine Script\n🎬 Drama — TikTok 3D mini-series\n\nJust talk naturally — I route to the right brain.\nCommands: /re /trade /drama /brief /status`,
      { parse_mode: "Markdown" }
    );
  });

  botInstance.command("re", async (ctx: Context) => {
    const text = ctx.message && "text" in ctx.message ? ctx.message.text : "";
    await handleMessage(ctx, `[real_estate] ${text.replace("/re", "").trim() || "/PIPELINE"}`);
  });

  botInstance.command("trade", async (ctx: Context) => {
    const text = ctx.message && "text" in ctx.message ? ctx.message.text : "";
    await handleMessage(ctx, `[trading] ${text.replace("/trade", "").trim() || "/SIGNALS"}`);
  });

  botInstance.command("drama", async (ctx: Context) => {
    const text = ctx.message && "text" in ctx.message ? ctx.message.text : "";
    await handleMessage(ctx, `[drama] ${text.replace("/drama", "").trim() || "/BRIEF"}`);
  });

  botInstance.command("brief", async (ctx: Context) => {
    await handleMessage(ctx, "generate morning briefing for all agents");
  });

  botInstance.command("status", async (ctx: Context) => {
    await ctx.reply("🟢 Master Brain: Online\n🏠 RE Brain: Active\n📈 Trading Brain: Active\n🎬 Drama Brain: Active\n📡 Groq → OpenRouter fallback\n💾 Supabase\n🚀 Railway");
  });

  botInstance.on("text", (ctx: Context) => handleMessage(ctx));
}

async function handleMessage(ctx: Context, overrideText?: string): Promise<void> {
  const userId = ctx.from?.id ?? 0;
  
  // Auth gate
  const ALLOWED_USER_ID = Number(process.env.TELEGRAM_ALLOWED_USER_ID ?? 0);
  if (ALLOWED_USER_ID && userId !== ALLOWED_USER_ID) {
    console.warn(`[Bot] Blocked unauthorized user: ${userId}`);
    return;
  }

  const rawText = overrideText ?? (ctx.message && "text" in ctx.message ? ctx.message.text : "");
  if (!rawText) return;
  
  if ("sendChatAction" in ctx) {
    await ctx.sendChatAction("typing").catch(() => {});
  }

  try {
    const response = await orchestrate(rawText, userId);
    
    if (response.length > 4000) {
      const chunks = response.match(/[\s\S]{1,4000}/g) ?? [response];
      for (const chunk of chunks) {
        await ctx.reply(chunk, { parse_mode: "Markdown" }).catch(() => ctx.reply(chunk));
      }
    } else {
      await ctx.reply(response, { parse_mode: "Markdown" }).catch(() => ctx.reply(response));
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Bot] Error:", msg);
    await ctx.reply(`⚠️ ${msg.slice(0, 200)}`);
  }
}

// Handler moved to registerBotCommands

async function main(): Promise<void> {
  console.log("[system] Starting hapda_bot Master Brain Life Cycle...");

  // 1. Run Master Brain Startup Sequence
  await runStartupSequence();

  // 2. Start Web Server (Railway Port Binding)
  console.log("[system] Starting Web Server...");
  const server = startWebServer();

  // 3. Initialize WebSocket
  initWebSocket(server);

  // 4. Launch Telegram Bot
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error("❌ [bot] TELEGRAM_BOT_TOKEN not found even after startup sequence. Bot will not start.");
  } else {
    bot = new Telegraf(token);
    registerBotCommands(bot);
    await bot.launch();
    console.log("✅ [bot] Telegram interface LIVE");
  }

  // 5. Start Background Automations
  console.log("[system] Starting Background Crons...");
  // startMorningBriefing(bot);
  // startLeadAlerts(bot);
  // startOutreachCron(bot);
  // initMarketScans(bot);
  // startContentCron(bot); 
  // startFollowUpCron(bot);

  process.once("SIGINT", () => {
    console.log("[system] SIGINT received — shutting down...");
    bot?.stop("SIGINT");
    process.exit(0);
  });
  process.once("SIGTERM", () => {
    console.log("[system] SIGTERM received — shutting down...");
    bot?.stop("SIGTERM");
    process.exit(0);
  });
}

// Global Exception Handling
process.on("unhandledRejection", (err: any) => {
    if (err?.message?.includes("409")) {
        console.warn("[bot] Another instance is running — shutting down this one");
        process.exit(1);
    }
    console.error("[system] Unhandled Rejection:", err);
});

process.on("uncaughtException", (err) => {
    console.error("[system] Uncaught Exception:", err);
});

// Execute
main().catch((err) => { 
  console.error("[Boot] Fatal:", err); 
  process.exit(1); 
});
