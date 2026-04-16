# ⚡ Gravity Claw Superpowers

I have integrated **modular, prompt-engineered skills** from the `superpowers` framework into your bot. These skills provide structured, multi-phase reasoning for complex tasks.

## Available Superpowers

| Superpower | Trigger Keywords | Agent | Description |
|------------|------------------|-------|-------------|
| **Brainstorming** | `brainstorm`, `design spec`, `ideation` | Researcher | Turn vague ideas into structured designs before any code is written. |
| **Systematic Debugging** | `debug`, `fix bug`, `broken`, `error in` | Developer | Root cause investigation followed by scientific hypothesis testing. |
| **Writing Plans** | `plan`, `todo list`, `implementation steps` | Developer | Create detailed, component-level execution maps. |
| **Executing Plans** | `execute`, `run plan` | Developer | Disciplined step-by-step implementation of an approved plan. |
| **TDD Specialist** | `test`, `tdd`, `unit test` | Developer | Red-Green-Refactor workflow for robust code. |
| **Code Review** | `review code`, `check this code` | Developer | High-standard quality audit for bugs and architecture. |
| **Verification** | `verify`, `check work`, `is it done` | Developer | Evidence-based validation of complexity completion. |

## How to Use

Simply mention the intent in your chat with the bot.

**Example 1: Brainstorming**
> *"I want to brainstorm a new feature for the real estate dashboard."*
> **Bot reaction**: Activates the Brainstorming Superpower to ask clarifying questions one at a time.

**Example 2: Debugging**
> *"My Supabase fetch is broken, can you help me debug?"*
> **Bot reaction**: Activates Systematic Debugging to find the root cause before proposing a fix.

## The "Iron Law" of Superpowers
Most of these skills have a "Hard Gate" or "Iron Law". For example:
- **Brainstorming** will refuse to write code until the design is approved.
- **Debugging** will refuse to propose a fix until the root cause is traced.

This ensures the highest quality output for your project.
