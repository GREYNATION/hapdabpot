# USER PROFILE: HUSTLA (Hapda Bot Architect)

## 1. Technical Stack (The "Defaults")
- **Core**: TypeScript (Node.js 22+)
- **Frameworks**: Hono, Express, Telegraf (Telegram), Remotion (Cinematic Pipeline), Three.js
- **Environment**: Windows 11, VS Code, PowerShell
- **Database**: Supabase (PostgreSQL), SQLite (Local Memory)
- **AI Infrastructure**: OpenAI (gpt-4o), Groq (llama-3.3-70b-versatile), Anthropic (claude-sonnet-4.5), OpenRouter
- **Cloud/Infra**: Railway.app (Production deployment)
- **Integrations**: Twilio (Voice/SMS), Apify (Scraping), Firecrawl, AgentMail

## 2. Coding Preferences
- **Style**: Modular, autonomous agent-driven (Claw Architecture), hierarchical multi-agent swarms (Council of Spirits).
- **Design**: Premium "WOW" aesthetics, dark mode, high-fidelity UI (when applicable to web components).
- **Best Practices**: 
  - Use `src/core/config.ts` for dynamic credentials from Supabase.
  - Implement robust error handling/retry logic (Circuit Breakers for 429s).
  - Preference for ESM (`.js` imports in TS).
  - Keep logic decoupled (Runtime vs. Tools).

## 3. Communication Style
- **Efficiency**: No small talk. Focus on code, architecture, and results.
- **Depth**: Senior-level architectural explanations. Focus on the "Why" behind the "Strong" architecture patterns.
- **Tone**: Professional, high-performance, results-oriented.

## 4. Active Projects & Context
- **Gravity Claw**: The master AI agency/bot framework.
- **Hapda Bot**: The new autonomous engine implementing the modular "Strong Architecture".
- **Real Estate Engine**: Automated surplus fund recovery, foreclosure auction scraping, and lead scoring.
- **Cinematic Workflow**: Autonomous video/content production via Muapi.ai and Remotion.
- **Known Issues**: 
  - Telegram 409 conflicts on Railway restarts (use retry logic).
  - AI Rate limits (429) (use core/ai.ts circuit breaker).
  - Always use Supabase `hapda_credentials` for production keys.
