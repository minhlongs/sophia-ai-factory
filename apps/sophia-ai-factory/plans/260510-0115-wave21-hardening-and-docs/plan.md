---
title: "Wave 21 — Hardening + Documentation Sync"
description: "Wrap up Wave 20 carry-overs: docs sync, account self-delete (legal-reviewed), production smoke verification, code-review pass."
status: in_progress (2/4 phases done)
priority: P1+P2 mix
effort: ~10h (4 phases)
branch: main
tags: [wave21, documentation, account-delete, hardening, qa]
created: 2026-05-10
---

# Wave 21 — Hardening + Documentation Sync

## Goal

Wave 20 shipped 5 phases (MarkdownV2, step-split, quota widget, account self-service, schema rename) without updating `./docs` or running a comprehensive review. Wave 21 closes those loops and brings the deferred Account-Delete flow with proper double-confirm UX.

## Phase Table

| Phase | Title | Priority | Effort | Status | Source |
|---|---|---|---|---|---|
| 01 | Docs sync — changelog/roadmap/codebase-summary reflect Wave 18-20 | P2 | 1h | ✅ done (`55e83fc7`) | LIVING DOCS rule |
| 02 | Account self-delete with double-confirm + 7-day cooldown | P1 | 4h | pending | Wave 19 7B remainder |
| 03 | Wave 20 code-review pass via `code-reviewer` subagent | P2 | 1h | ✅ done (report 2026-05-10) | Quality gate |
| 04 | Production smoke + Inngest retry verification | P3 | 2h | pending | CEO smoke test #234 follow-up |

**Total: ~8h.** Phase 01 is risk-free (docs only). Phase 02 is the heaviest — destructive op, needs cooldown table.

## Dependency

```
01 (docs)        → independent
02 (delete)      → independent
03 (review)      → depends on Wave 20 commits (already on main)
04 (smoke)       → depends on Wave 20 deployed (already live)
```

## Out of Scope (defer to Wave 22)

- Mission SSE production traffic profiling
- CLOUDCONVERT_API_KEY secret rotation tooling
- Better Auth globalSetup.ts for E2E auth path

## Files

- `phase-01-docs-sync.md`
- `phase-02-account-self-delete.md`
- `phase-03-wave20-code-review.md`
- `phase-04-production-smoke-verification.md`
