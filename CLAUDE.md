# Gravity Claw / HapdaBot: Project Standards

## Overview
HapdaBot is an autonomous agentic system for real estate lead intelligence, CRM management, and cinematic production (Muapi.ai).

## Tech Stack
- **Runtime**: Node.js (v20+) with `tsx`
- **Language**: TypeScript (ESNext/NodeNext)
- **Database**: Supabase (PostgreSQL)
- **Messaging**: Telegraf (Telegram Bot API)
- **Production**: Muapi.ai (v1 endpoints)

## Build & Test Commands
- **Check Types**: `npm run typecheck`
- **Build**: `npm run build`
- **Start Bot**: `npm run dev`
- **Test Skills**: `npx tsx scripts/test-skills.ts` (if exists)

## ⚡ THE SUPERPOWERS DIRECTIVE
This project integrates high-quality, phase-gated skills from the `superpowers` repository. **Claude MUST always check `src/agents/superpowers/skills` for logic patterns.**

### Core Iron Laws:
1. **Brainstorm Before Coding**: If a request is vague or complex, activate the **Brainstorming Superpower**. Refuse to write code until the design is approved.
2. **Investigation Before Fix**: If a bug is reported, activate the **Systematic Debugging Superpower**. TRACE the data flow before proposing a fix.
3. **Plan Before Implementation**: Always create an `implementation_plan.md` for non-trivial changes.

## File Organization
- `src/core/`: Core logic (ai.ts, skills.ts, router.ts, supabase.ts, config.ts)
- `src/agents/`: Specialized agents (cinema, superpowers, marketer, researcher)
- `src/web/`: Implementation for the project's web dashboards.
- `scripts/`: Maintenance and test scripts.
