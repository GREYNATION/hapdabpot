# Stuyza Productions - OpenMontage Integration

**Agentic Video Production System** for Stuyza Productions, powered by OpenMontage.

## Overview

This folder integrates [OpenMontage](https://github.com/calesthio/OpenMontage) — the world's first open-source, agentic video production system — into HapdaBot for Stuyza Productions content creation.

## Directory Structure

```
src/agents/stuyza/
├── README.md                    # This file
├── StuyzaVideoAgent.ts         # TypeScript bridge to OpenMontage
├── stuyzaPipeline.ts           # Pipeline runner wrapper
├── openmontage/                 # OpenMontage system (cloned)
│   ├── pipeline_defs/          # Pipeline definitions
│   ├── skills/                 # Agent skills/instructions
│   ├── tools/                  # Python tools
│   └── remotion-composer/      # Video composition engine
└── pipelines/                   # Stuyza-specific pipelines
    ├── stuyza-explainer.yaml
    ├── stuyza-cinematic.yaml
    └── stuyza-social.yaml
```

## Pipelines

### Available Stuyza Pipelines

1. **stuyza-explainer** — Real estate explainers, educational content
2. **stuyza-cinematic** — Cinematic drama series ("Out the Way")
3. **stuyza-social** — Social media clips, TikToks, Shorts

## Quick Start

From Telegram:
```
/stuyza make a 60-second explainer about wholesaling real estate
/stuyza make a cinematic trailer for "Out the Way" Episode 1
/stuyza create a social media clip about motivated sellers
```

## Integration

The `StuyzaVideoAgent.ts` provides a TypeScript interface that:
1. Receives commands from Telegram
2. Translates to OpenMontage pipeline calls
3. Manages the Python bridge execution
4. Returns video URLs to the user

## Configuration

OpenMontage uses `.env` configuration in `openmontage/.env`:
- API keys for FAL, ElevenLabs, OpenAI, etc.
- Local GPU settings
- Provider preferences

See `openmontage/.env.example` for all options.
