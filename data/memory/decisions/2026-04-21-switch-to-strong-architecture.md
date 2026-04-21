# Decision: Switch to Strong Architecture

**Date**: 2026-04-21T20:44:44.838Z

## Logic & Context
The legacy Claw engine has too much coupling between tool execution and reasoning, leading to 400 errors. Modular runtime ensures separation of concerns.

## Outcome
Successfully ported to src/hapda_bot.ts and src/core/runtime/*.
