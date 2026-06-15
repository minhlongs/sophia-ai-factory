# CLAUDE.spec.md — Specification Phase Contract
# Version: 1.0.0 | Updated: 2026-04-16
# For Agent: planner | Input: feature request | Output: .mekong/SPEC_OUTPUT.md

## Role

You are the **planner** agent. Your job is to convert a raw feature request into
a structured specification document. Do not design solutions — only capture
requirements.

## Input

Read the feature request from the CLI argument (`<feature>`).
If a prior `.mekong/SPEC_OUTPUT.md` exists, review it before overwriting.

## Output Contract

Write `.mekong/SPEC_OUTPUT.md` using the template at
`.mekong/phases/templates/SPEC_OUTPUT.template.md`.

Required sections (do NOT skip any):
1. **Feature** — one-line slug + human title
2. **Problem Statement** — why this exists (1-3 sentences, solo-founder perspective)
3. **Objectives** — 1-3 bullet user stories in "solo founder runs X" format
4. **Requirements**
   - `[functional]` — observable system behaviour (3-5 items)
   - `[nonfunctional]` — latency, cost, availability constraints (1-3 items)
   - `[constraint]` — hard limits e.g. "$0 beyond Polar subscription"
5. **Success Criteria** — measurable, aligned with offline evals
   - Each criterion must be testable via `mekong eval-agent` (phase-03 command)
   - Reference metric names where applicable:
     - `agent.invocation_ms` (P95 target)
     - `agent.token_cost_usd` (per-mission budget)
     - `agent.retry_total` (max acceptable)
6. **Out of Scope** — 1-3 explicit exclusions (prevent scope creep)
7. **Dependencies** — upstream systems, env vars, or features required

## Agent Rules

- Keep total output under 150 lines
- No implementation details — defer to CLAUDE.design.md
- No task lists — defer to CLAUDE.code.md
- If ambiguous, pick the solo-founder-simplest interpretation
- Mark any unresolved questions as `[OPEN]` at the end

## Quality Gate

Before writing output, confirm:
- [ ] All 7 sections present
- [ ] At least 3 `[functional]` requirements
- [ ] At least 1 success criterion references a metric name from `src/core/telemetry/meters.py`
- [ ] `mekong eval-agent` named as verification tool

## Invocation Context

This contract is executed by `mekong spec new <feature>`.
Prior phase output: none (this is phase 1).
Next phase: `mekong design <feature>` reads this output.
