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

<!-- code-review-graph MCP tools -->
## MCP Tools: code-review-graph

**IMPORTANT: This project has a knowledge graph. ALWAYS use the
code-review-graph MCP tools BEFORE using Grep/Glob/Read to explore
the codebase.** The graph is faster, cheaper (fewer tokens), and gives
you structural context (callers, dependents, test coverage) that file
scanning cannot.

### When to use graph tools FIRST

- **Exploring code**: `semantic_search_nodes` or `query_graph` instead of Grep
- **Understanding impact**: `get_impact_radius` instead of manually tracing imports
- **Code review**: `detect_changes` + `get_review_context` instead of reading entire files
- **Finding relationships**: `query_graph` with callers_of/callees_of/imports_of/tests_for
- **Architecture questions**: `get_architecture_overview` + `list_communities`

Fall back to Grep/Glob/Read **only** when the graph doesn't cover what you need.

### Key Tools

| Tool | Use when |
|------|----------|
| `detect_changes` | Reviewing code changes — gives risk-scored analysis |
| `get_review_context` | Need source snippets for review — token-efficient |
| `get_impact_radius` | Understanding blast radius of a change |
| `get_affected_flows` | Finding which execution paths are impacted |
| `query_graph` | Tracing callers, callees, imports, tests, dependencies |
| `semantic_search_nodes` | Finding functions/classes by name or keyword |
| `get_architecture_overview` | Understanding high-level codebase structure |
| `refactor_tool` | Planning renames, finding dead code |

### Workflow

1. The graph auto-updates on file changes (via hooks).
2. Use `detect_changes` for code review.
3. Use `get_affected_flows` to understand impact.
4. Use `query_graph` pattern="tests_for" to check coverage.
