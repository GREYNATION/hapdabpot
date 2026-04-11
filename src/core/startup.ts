import {
  writeGlobalMemory,
  readGlobalMemory,
  writeKnowledge,
  logSession,
} from "./memory.js";

// ─── Required Environment Variables ──────────────────────────────────────────

const REQUIRED_ENV_VARS = [
  "GROQ_API_KEY",
  "TELEGRAM_BOT_TOKEN",
];

const OPTIONAL_ENV_VARS = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPENROUTER_API_KEY",
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_PHONE_NUMBER",
  "ELEVENLABS_API_KEY",
  "MAGIC_HOUR_API_KEY",
  "OPENART_API_KEY",
  "PROPSTREAM_API_KEY",
  "V7_GO_API_KEY",
];

// ─── Initial Knowledge Base Entries ──────────────────────────────────────────

const INITIAL_KNOWLEDGE: Array<{
  domain: "real_estate" | "trading" | "drama" | "global";
  topic: string;
  content: string;
}> = [
  {
    domain: "global",
    topic: "operator_profile",
    content: `Operator: Hap Hustlehard (Hapdabap)
Role: Real estate wholesaler + algorithmic trader + TikTok content creator
Markets: South Jersey, Brooklyn, Philadelphia
Stack: Railway (deployment), Supabase (database), Groq (primary LLM), OpenRouter (fallback)
Telegram: Primary command interface
Bot: hapda_bot (Telegraf + TypeScript)
Auto Outreach: DISABLED (manual approval required)`,
  },
  {
    domain: "real_estate",
    topic: "mao_formula",
    content: `MAO Formula: ARV x 70% - Repairs = Maximum Allowable Offer
Assignment Fee Target: $10,000 minimum per deal
Target Markets: South Jersey (NJ), Brooklyn (NYC), Philadelphia (PA)
Deal Types: Wholesale assignment, double close
Preferred: Single family, small multi-family (2-4 units)
Lead Sources: Direct mail, cold SMS, driving for dollars, PropStream lists`,
  },
  {
    domain: "trading",
    topic: "active_instruments",
    content: `Primary Pairs: BTC/USD, GBP/USD
Timeframes: 1m (scalp entry), 5m (primary), 15m + 1H (confirmation)
Signal Source: TradingView webhooks -> hapdabot Express server
Strategy: IQ Buy/Sell signals + market structure (HH/HL/LH/LL)
Risk Rule: Max 2% account risk per trade
Platform: TradingView (Pine Script v5)`,
  },
  {
    domain: "drama",
    topic: "production_setup",
    content: `Platform: TikTok (primary distribution)
Format: 3D animated mini-drama series
Voice: ElevenLabs (multi-character)
3D Environments: OpenArt Worlds
Characters: Tripo AI / Midjourney
Lip Sync: Magic Hour AI
Final Cut: CapCut Pro
TikTok Domain: www.stuyza.com`,
  },
  {
    domain: "global",
    topic: "ai_tools_catalog",
    content: `PRIMARY AI:
- Groq (llama-3.3-70b-versatile): Primary LLM
- OpenRouter: Fallback LLM

COMMUNICATION:
- Twilio: SMS outreach (manual approval gate)
- SMTP: Email follow-up
- Telegram: Primary UI (Telegraf)

REAL ESTATE (planned):
- PropStream: Property data, skip tracing
- V7 Go: Document intelligence

DRAMA (planned):
- ElevenLabs: TTS voice synthesis
- Magic Hour AI: Lip-sync
- OpenArt Worlds: 3D environments
- Tripo AI: Character generation

INFRASTRUCTURE:
- Railway: Cloud deployment (www.stuyza.com)
- Supabase: PostgreSQL + Storage`,
  },
];

// ─── Env Validation ───────────────────────────────────────────────────────────

function validateEnv(): { ok: boolean; missing: string[]; warnings: string[] } {
  const missing = REQUIRED_ENV_VARS.filter((v) => !process.env[v]);
  const warnings = OPTIONAL_ENV_VARS.filter((v) => !process.env[v]);
  return { ok: missing.length === 0, missing, warnings };
}

// ─── Main Boot Sequence ───────────────────────────────────────────────────────

export async function runStartupSequence(): Promise<void> {
  console.log("🚀 [Startup] hapda_bot Master Brain booting...");

  // 1. Initialize dynamic config (fetch missing keys from Supabase)
  const { initializeConfig } = await import("./config.js");
  const { initializeClients } = await import("./ai.js");
  
  await initializeConfig();
  initializeClients();

  const { ok, missing, warnings } = validateEnv();

  if (!ok) {
    console.error(`[Startup] FATAL: Missing env vars: ${missing.join(", ")}`);
    process.exit(1);
  }

  if (warnings.length > 0) {
    console.warn(`[Startup] Optional APIs not set: ${warnings.join(", ")}`);
  }

  console.log("✅ [Startup] Environment validated");

  // Idempotent — only seeds on first boot
  const initialized = await readGlobalMemory("initialized");

  if (!initialized) {
    console.log("📚 [Startup] First boot — seeding knowledge base...");

    for (const entry of INITIAL_KNOWLEDGE) {
      await writeKnowledge(entry.domain, entry.topic, entry.content, "startup");
      console.log(`  ✓ ${entry.domain}/${entry.topic}`);
    }

    await writeGlobalMemory("initialized", new Date().toISOString());
    await writeGlobalMemory("bot_version", "1.0.0-master-brain");
    await writeGlobalMemory(
      "active_agents",
      JSON.stringify(["real_estate", "trading", "drama"])
    );

    console.log("✅ [Startup] Knowledge base seeded");
  } else {
    console.log(`✅ [Startup] Already initialized (${initialized})`);
  }

  await logSession(
    "orchestrator",
    "hapda_bot Master Brain started",
    undefined,
    { timestamp: new Date().toISOString() }
  );

  console.log("🧠 [Startup] All agents online:");
  console.log("   🏠 RE Brain: South Jersey | Brooklyn | Philadelphia");
  console.log("   📈 Trading Brain: BTC/USD | GBP/USD");
  console.log("   🎬 Drama Brain: TikTok 3D Mini-Series");
}

// ─── Market Trends Updater ────────────────────────────────────────────────────

export async function updateMarketTrends(
  domain: "real_estate" | "trading",
  update: string
): Promise<void> {
  const existing = (await readGlobalMemory("market_trends_" + domain)) ?? "";
  const entry = `[${new Date().toISOString()}] ${update}`;
  const updated = [entry, ...existing.split("\n").slice(0, 19)].join("\n");
  await writeGlobalMemory("market_trends_" + domain, updated);
  await writeKnowledge("global", `market_trends_${domain}`, updated, domain + "_agent");
}
