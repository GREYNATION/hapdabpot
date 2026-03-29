# AGENTS.md

This document provides guidance for AI coding agents working in the Gravity Claw codebase.

## Project Overview

Gravity Claw (HapdaBot) is a TypeScript/Node.js Telegram bot with an AI agent architecture. It supports multiple AI providers (OpenRouter, Anthropic) and includes specialized agents for trading, development, marketing, and research.

## Project Structure

```
gravity-claw/
├── src/
│   ├── agents/         # AI agent implementations
│   │   ├── baseAgent.ts      # Abstract base class for all agents
│   │   ├── developerAgent.ts # Software development specialist
│   │   ├── researcherAgent.ts
│   │   ├── marketerAgent.ts
│   │   └── outtheway/        # Content production pipeline agents
│   ├── bot/            # Telegram bot handlers
│   ├── core/           # Core utilities (config, AI, memory, router)
│   ├── services/       # External service integrations
│   ├── tools/          # Tool implementations for agents
│   ├── antigravity/    # Task management system
│   └── index.ts        # Entry point
├── dashboard/          # React/Vite frontend dashboard
├── wholesale-os/       # Express backend for real estate CRM
├── data/               # Database and shared files
└── scripts/            # Test/utility scripts
```

## Build/Lint/Test Commands

### Main Bot (root directory)

```bash
# Development
npm run dev          # Run with tsx (no build needed)
npm run build        # Compile TypeScript to dist/
npm start            # Run compiled code from dist/

# Type checking
npm run typecheck    # Run tsc --noEmit (recommended before commits)

# Production
npm run deploy       # Build and start
```

### Dashboard

```bash
cd dashboard
npm run dev          # Start Vite dev server
npm run build        # Typecheck + build for production
npm run lint         # Run ESLint
```

### Wholesale-OS

```bash
cd wholesale-os
npm run dev          # Development with nodemon
npm start           # Production server
```

### Running Individual Test Scripts

Test scripts are located in `scripts/` and can be run directly:

```bash
npx tsx scripts/test-skills.ts
npx tsx scripts/test-search.ts
npx tsx scripts/test-crm.ts
npx tsx scripts/test-agentmail.ts
```

## Code Style Guidelines

### Imports

- **ES Modules**: Use ES module syntax with `.js` extensions for local imports
- **Import order**: Node built-ins first, then external packages, then local modules

```typescript
// Correct
import fs from "fs";
import path from "path";
import { Telegraf } from "telegraf";
import { config, log } from "./core/config.js";
import { BaseAgent } from "./agents/baseAgent.js";

// Incorrect (missing .js extension will fail at runtime)
import { config } from "./core/config";
```

### TypeScript Configuration

- **Strict mode** is enabled - all code must pass strict type checking
- Target: ESNext, Module: NodeNext
- Always run `npm run typecheck` before committing

### Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Classes | PascalCase | `DeveloperAgent`, `TelegramBot` |
| Interfaces | PascalCase | `AgentResponse`, `AIOptions` |
| Functions | camelCase | `askAI()`, `executeTask()` |
| Variables | camelCase | `userText`, `chatId` |
| Constants | camelCase | `maxToolIterations` |
| Private methods | camelCase with private | `private setupHandlers()` |
| Protected properties | camelCase | `protected model` |
| Files | camelCase.ts | `baseAgent.ts`, `developerAgent.ts` |

### Error Handling

- Use try/catch blocks for async operations
- Log errors with the `log()` utility
- Provide meaningful error messages

```typescript
try {
    const response = await axios.get(url, { timeout: 10000 });
    return response.data;
} catch (e: any) {
    log(`[error] Failed to fetch ${url}: ${e.message}`, "error");
    throw e;
}
```

### Logging

Use the centralized `log()` function from `core/config.js`:

```typescript
import { log } from "./core/config.js";

log("[agent] Processing request...");
log("[warn] Rate limit approaching", "warn");
log("[error] Connection failed", "error");
```

Log levels: `"info"` (default), `"warn"`, `"error"`

### Agent Pattern

All agents extend `BaseAgent`:

```typescript
import { BaseAgent } from "./baseAgent.js";

export class MyAgent extends BaseAgent {
    constructor() {
        super("MyAgent", "System prompt here...");
    }

    getName(): string {
        return "MyAgent";
    }

    getSystemPrompt(): string {
        return "Detailed system prompt...";
    }
}
```

### Async Patterns

- Always use `async/await` (not `.then()` chains)
- Add timeouts to external API calls
- Implement retry logic for transient failures

```typescript
const response = await axios.get(url, {
    timeout: 10000,
    headers: { "User-Agent": "..." }
});
```

### Environment Variables

Access via `config` object, not `process.env` directly:

```typescript
import { config } from "./core/config.js";

// Correct
const token = config.telegramToken;

// Avoid
const token = process.env.TELEGRAM_BOT_TOKEN;
```

Required environment variables (see `.env.example`):
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_ALLOWED_USER_IDS`
- `OPENROUTER_API_KEY`
- `AI_PROVIDER` (openrouter, anthropic, or gemini)

### Code Comments

- Avoid unnecessary comments - code should be self-documenting
- Use JSDoc for public interfaces and complex functions
- Prefer meaningful variable names over comments

## Architecture Notes

### Agent System

- `BaseAgent` provides tool execution capabilities (web_search, read_url, email tools)
- Each specialist agent has a focused domain and custom system prompt
- Agents can call tools up to `maxToolIterations` times per request

### AI Provider Abstraction

- `askAI()` in `core/ai.ts` provides a unified interface
- Supports OpenRouter (default), Anthropic
- Model selection via `config.openaiModel`

### Tool Definition

Tools follow OpenAI function calling format:

```typescript
{
    type: "function",
    function: {
        name: "tool_name",
        description: "Tool description",
        parameters: {
            type: "object",
            properties: { /* ... */ },
            required: ["param1"]
        }
    }
}
```

## Common Tasks

### Adding a New Agent

1. Create `src/agents/myAgent.ts` extending `BaseAgent`
2. Implement `getName()` and `getSystemPrompt()`
3. Add to router/manager if auto-routing needed

### Adding a New Tool

1. Add tool definition to `getTools()` in `baseAgent.ts`
2. Implement execution in `executeTool()` method
3. Test with `npx tsx scripts/test-skills.ts`

### Modifying Bot Commands

Edit `src/bot/telegram.ts`:
- Add handler method (e.g., `setupMyHandlers()`)
- Call from constructor
- Use `this.safeReply()` for long message chunking
