---
title: "Sophia Phase 1 — SOP Marketplace Foundation"
description: "SOP catalog + executor + marketplace UI + editor + agent sidebar/Cmd-K, foundation for AI-Agency-in-a-Box."
status: pending
priority: P1
effort: 80h
branch: main
tags: [sop, marketplace, mission-engine, sidebar, cmd-k, phase-1]
created: 2026-05-02
---

## Goal

Deliver SOP marketplace foundation in cloud dashboard so agencies can browse, install, run, and edit SOPs that orchestrate the existing 17 mission commands. Scope = D1 schema + executor cron + marketplace + editor + agent sidebar with Cmd+K. NO Tauri Mac app, NO customer-contributed SOPs (Phase 3).

## Architecture (locked per research)

- SOP format = 3-Tier HDR: `agents.yaml` (TEXT) + `playbook.md` (TEXT) + `output.schema.json` (TEXT) — 3 columns in `sop_templates`.
- Executor reuses existing `/api/v1/missions` engine — does NOT rebuild dispatch.
- Schedule = new cron `*/5 * * * *` polls `user_sop_installations` where `enabled=1 AND next_run_at <= now`.
- Webhook trigger endpoint for reactive SOPs.
- Sidebar + Cmd+K wired into all `[locale]/dashboard/*` layouts.
- Bilingual Vi+En via existing next-intl.

## Phases

| # | Phase | Effort | Status | File |
|---|-------|--------|--------|------|
| 1 | SOP schema + 5 starter playbooks seed | 12h | pending | [phase-01-sop-schema-and-catalog.md](./phase-01-sop-schema-and-catalog.md) |
| 2 | SOP execution engine + scheduler cron | 16h | pending | [phase-02-sop-execution-engine.md](./phase-02-sop-execution-engine.md) |
| 3 | Marketplace browse + install UI + APIs | 16h | pending | [phase-03-sop-marketplace-ui.md](./phase-03-sop-marketplace-ui.md) |
| 4 | Editor + run history dashboard | 16h | pending | [phase-04-sop-editor-and-runs.md](./phase-04-sop-editor-and-runs.md) |
| 5 | Agent sidebar + Cmd+K palette + chat API | 20h | pending | [phase-05-sidebar-and-cmd-k.md](./phase-05-sidebar-and-cmd-k.md) |

## Dependencies

- Phase 2 blocked by 1 (needs schema).
- Phase 3 blocked by 1 (needs sop_templates seeded).
- Phase 4 blocked by 2 + 3 (needs executor + install API).
- Phase 5 independent — can run parallel with 3-4 once mission engine routes are confirmed.

## Success Criteria

- 5 official SOPs visible in marketplace, installable in <3 clicks.
- One SOP runs end-to-end via cron and via webhook trigger; mission breakdown stored.
- Customer can edit playbook Markdown → save → re-run uses customized version.
- Sidebar opens in any dashboard page, chat dispatches mission, "Show Work" reveals reasoning steps.
- Cmd+K opens palette; running an SOP from palette triggers executor.
- Zero `:any`, zero `console.log`, all files ≤200 LOC.
- Existing 2292 tests still pass; new tests cover executor, repo, install API.
- Migrations apply cleanly local + remote D1.

## Top Risks

1. **Mission engine coupling** — SOP executor must NOT bypass auth/credit/circuit-breaker checks. Mitigation: dispatch via existing `/api/v1/missions` HTTP path or its internal dispatcher, never raw handlers.
2. **Cron drift** — `*/5 * * * *` polling can pile up if a run takes >5min. Mitigation: idempotent `next_run_at` advance + claim-then-execute pattern with status='running'.
3. **YAML parsing on Workers** — no native YAML; pulling `js-yaml` adds ~30KB. Mitigation: store agents config as JSON-equivalent, parse YAML only at seed time (Node script), persist normalized JSON if size becomes issue. Day-1: ship `js-yaml` (small, OK for Workers).

## Out of Scope (Phase 2/3)

- Tauri Mac app, MCP server, Zalo/MoMo integrations, customer-published SOPs, generative UI, watch-mode auto-completion, multi-agent collab, Vietnam AI Law cert.
