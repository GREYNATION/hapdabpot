# MEMORY: Project Knowledge Base

## 1. Important Facts & Discoveries
- **2026-04-21**: Discovered that the latest OpenAI and Groq APIs require `type: "function"` to be explicitly set in the `tool_calls` object. Fixed in `src/core/ai.ts`.
- **2026-04-21**: Implemented and verified the "Strong Architecture" (modular runtime) in `src/hapda_bot.ts`. Confirmed it successfully handles multi-turn autonomous goals like surplus calculation.
- **2026-04-19**: Identified persistent 429 rate limit errors during high-frequency AI orchestration. Resolved by implementing an exponential backoff and a global circuit breaker in `src/core/ai.ts`.
- **2026-04-15**: Discovered that Muapi API v1 requires specific endpoint mappings (e.g., `/api/v1/flux-dev-image`) to avoid 404 errors in the cinematic pipeline.

## 2. Key Decisions (The "Why")
- **2026-04-21**: Decided to implement the "Strong Architecture" (ported from Rust canonical version) into `src/hapda_bot.ts` to improve bot stability, safety (via Permission Enforcer), and state management.
- **2026-04-21**: Decided to keep session history in-memory for the current bot engine to maintain high performance, while keeping the structure ready for future Supabase persistence.
- **2026-04-19**: Decided to unify all background tasks under the `Council of Spirits` orchestration pattern to ensure agents share a common neural schema.
- **2026-04-10**: Migrated from legacy Python memory management to a TypeScript-native `memory.ts` service for better type safety and faster integration with the bot frontend.

## 3. Current Project State
- **Active Task**: Refining the `Hapda Bot` autonomous engine and integrating it with real estate market scans.
- **Blockers**: None currently. System is stable with circuit breakers active.
- **Next Steps**: 
  - Enhance `PermissionEnforcer` with custom rules for sensitive tools (SMS, Voice Calls).
  - Integrate hierarchical long-term memory for agents.
  - Finalize the automated real estate contract generation workflow.

## 4. Recurring Tasks
- Monitor `ops_logs` in Supabase for agent behavioral anomalies.
- Run `npm run typecheck` before any major deployment to Railway.
- Verify environment sync via `scripts/migrate-credentials.ts` when changing providers.
