---
title: ".sophia-factory — AI-SDLC Agent Directory"
description: "C-Level agent definitions, lifecycle templates, and journal for Sophia AI Factory."
---

# .sophia-factory

Meta-layer for the Sophia AI Factory solo company operating system.
Pure markdown — no build step, no runtime dependencies.

## Directory Structure

```
.sophia-factory/
├── orchestrator.md              # Supervisor — routes requests to C-Level agents
├── agents/
│   ├── cto.md                   # Tech + QA + Security + Infra
│   ├── cmo.md                   # Copy + SEO + Brand + Bilingual content
│   ├── cso.md                   # Sales + Outreach + Pricing + Churn
│ ├── coo.md # Ops + Support + Metrics + Capacity
│ └── mekong-cli.md # Cross-repo SDLC bridge to Mekong CLI v6.0
├── CLAUDE.specification.md      # Phase 1: requirements gathering
├── CLAUDE.design.md             # Phase 2: architecture + UX
├── CLAUDE.code.md               # Phase 3: implementation
├── CLAUDE.deploy.md             # Phase 4: ship + verify
├── templates/
│   ├── requirement.md           # Fill for every new feature
│   ├── design.md                # Fill after requirement approved
│   ├── story.md                 # One per atomic work unit
│   └── deployment-checklist.md  # Fill before every production deploy
└── journal/
    └── .gitkeep                 # Runtime logs — committed to repo (audit trail)
```

## Quick Start

```bash
# Route any request through the orchestrator
mekong --agent sophia-orchestrator "your request here"

# Or invoke a C-Level directly
mekong --agent cto "audit CI pipeline for security issues"
mekong --agent cmo "write blog post about BYOK feature"
mekong --agent cso "draft outreach for churned trial users"
mekong --agent coo "summarize this week's ops metrics"
mekong --agent mekong-cli "run SDLC spec for new feature"
mekong --agent mekong-cli "run eval-agent for cto last 7 days"
```

## Security (RED TEAM #14)

- All agents: NO `Write` tool (prevents arbitrary file creation)
- Each agent: sandboxed to `allowed-paths` in frontmatter
- Only `orchestrator` has `Skill` (spawn) rights
- `journal/` is committed — NOT gitignored — for audit trail
- Agents must scrub PII before writing journal entries

## Full Documentation

See `docs/sophia-factory-readme.md` for bilingual VN+EN founder runbook.
