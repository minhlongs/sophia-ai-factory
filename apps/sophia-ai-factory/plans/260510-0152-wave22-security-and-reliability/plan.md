---
title: "Wave 22 — Security + Reliability Sweep"
description: "Sweep 8 backlog items from Wave 20 code review + Wave 21 P02 design gaps: token hashing, TOCTOU fix, retry audit, auto-finalize cron, DRY refactor."
status: in_progress (4/8 phases done — Batch 1 shipped)
priority: P1+P2 mix
effort: ~10.5h (8 phases)
branch: main
tags: [wave22, security, reliability, hardening, backlog-sweep]
created: 2026-05-10
---

# Wave 22 — Security + Reliability Sweep

## Goal

Wave 20 review + Wave 21 P02 design surfaced 8 actionable items (2 HIGH security, 3 MED reliability/UX, 3 LOW perf/refactor/SOP). Wave 22 closes them in a single coordinated sweep before next feature wave. Two findings (#1 token hashing, #2 TOCTOU race) are public-launch blockers per reviewer — must ship first.

## Phase Table

| Phase | Title | Priority | Effort | Status | Source |
|---|---|---|---|---|---|
| 01 | Hash email confirmation tokens (sha256) — change-email + delete | P1/HIGH/SECURITY | 2h | pending | W20 review #1 |
| 02 | Fix TOCTOU race on email uniqueness via conditional UPDATE | P1/HIGH/SECURITY | 1.5h | ✅ done (Batch 1) | W20 review #2 |
| 03 | Fix silent `#` URL fallback when NEXT_PUBLIC_APP_URL missing | P2/MED/UX | 0.5h | ✅ done (Batch 1) | W20 review #4 |
| 04 | Add `(provider, status)` composite index on publishing_jobs | P3/LOW/PERF | 0.5h | ✅ done (Batch 1) | W20 review #5 |
| 05 | Audit Inngest `retries: 0` functions — convert benign errors to RetryAfterError | P2/MED/RELIAB | 1h | pending | W20 review #3 |
| 06 | Inngest cron auto-finalize delete after cooldown elapsed | P2/MED/UX | 3h | pending | W21 P02 design gap |
| 07 | Extract shared `<bilingual-cta-email>` component (DRY) | P3/LOW/REFACTOR | 1.5h | pending | W21 P02 carryover |
| 08 | CEO production smoke test #234 — manual SOP doc | P3/LOW/SOP | 0.5h | ✅ done (Batch 1) | W21 P04 carryover |

**Total: ~10.5h.** Two security blockers ship first; perf + refactor + SOP backfill last.

## Sequencing & Dependencies

```
01 (token-hash)  → independent (security #1)
02 (toctou)      → independent (security #2; touches change-email/verify same as 01)
03 (url-fallback)→ independent (single line fix in change-email)
04 (index)       → independent (migration only)
05 (retry-audit) → independent (audit pass; may touch 0-N inngest files)
06 (cron-final)  → builds on understanding from 05; reuses cascade DELETE_ORDER from /api/account
07 (email-DRY)   → BLOCKED BY 01 (token shape changes; refactor after both flows updated)
08 (CEO-SOP)     → independent (doc only)
```

**Recommended execution order:** P01 → P02 → P03 → P04 (parallel-safe quick wins) → P05 → P06 → P07 → P08.
P01+P02+P03 should land in a single deploy if possible — all touch the change-email/delete flows.

## Key Risks

- **P01 migration vs runtime:** Adding `confirmation_token_hash` column requires backward-compat read path during the deploy window — phase has rollout plan.
- **P02 Better Auth coupling:** `UPDATE user SET email=...` must not invalidate active sessions unexpectedly; phase verifies session table not impacted.
- **P06 cascade delete idempotency:** Cron may double-fire; row presence check + `cancelled_at IS NULL` guards required.
- **P07 abstraction premature:** Two flows differ in CTA color (purple vs red) and cooldown copy; component must accept slot-style props.

## Out of Scope (defer to Wave 23)

- Mission SSE production traffic profiling (carry from W21)
- CLOUDCONVERT_API_KEY rotation tooling (carry from W21)
- Better Auth `globalSetup.ts` for E2E auth path (carry from W21)
- Unified `verification` table cleanup cron (separate from delete-cron P06)

## Files

- `phase-01-hash-email-tokens-sha256.md`
- `phase-02-toctou-email-uniqueness-fix.md`
- `phase-03-change-email-url-fallback-fix.md`
- `phase-04-publishing-jobs-provider-status-index.md`
- `phase-05-inngest-retry-audit.md`
- `phase-06-inngest-cron-auto-finalize-delete.md`
- `phase-07-bilingual-cta-email-component.md`
- `phase-08-ceo-production-smoke-sop.md`
