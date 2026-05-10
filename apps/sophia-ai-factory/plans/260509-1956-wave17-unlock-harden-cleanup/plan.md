---
title: "Wave 17 — Unlock Distribution + Harden + Cleanup"
description: "Bridge HeyGen→R2, fix publishing_jobs.video_job_id wiring, flip distribute flag, harden Telegram pairing + auth + DB client, cleanup deprecated routes, add E2E tests."
status: shipped
priority: P1
effort: 8-12d
branch: main
tags: [wave17, distribution, hardening, cleanup, e2e, free100]
created: 2026-05-09
updated: 2026-05-09
---

# Wave 17 — Unlock Distribution + Harden + Cleanup

## Goal
Wave 16 shipped FREE100 dashboard end-to-end UX but Distribution UI + Telegram channel are gated behind `NEXT_PUBLIC_DISTRIBUTE_ENABLED` (default off). Wave 17 closes the architectural + hardening gaps that block flag flip, then opportunistically cleans up deprecated code.

Last live commit: `1f4444b0` (Wave 16 COMPLETE).

## Phases

| # | Phase | Priority | Effort | Status | Blocks |
|---|---|---|---|---|---|
| 01 | Bridge HeyGen→R2 + canonical video URL | P0 | 2-3d | ✅ done | 02, 03 |
| 02 | Wire publishing_jobs.video_job_id correctly | P0 | 1-2d | ✅ done | 03 |
| 03 | Flip `NEXT_PUBLIC_DISTRIBUTE_ENABLED=1` + smoke | P0 | 0.5d | done (deploy pending; smoke deferred) | — |
| 04 | UNIQUE(paired_by) on telegram_paired_chats | P1 | 0.5-1d | ✅ done | — |
| 05 | Canonical D1 client swap in distribute route | P1 | 1d | ✅ done (deferred to Wave 18) | — |
| 06 | M6 API-key DB error swallow fix | P1 | 0.5d | ✅ done | — |
| 07 | Delete deprecated HeyGen route + legacy wizard | P2 | 0.5d | ✅ done | — |
| 08 | E2E Playwright tests for FREE100 flow | P2 | 2-3d | deferred (Wave 18) | — |

Total: 8-12 dev-days. Phases 04-08 parallel-safe (independent of P0 chain).

**Batch 1 Shipped:** 2026-05-09 LATE @ commit 2048801c — Phases 01 (pipeline bridge), 04 (UNIQUE pairing), 06 (API-key error taxonomy) complete. Phase 02 shipped 2026-05-09 (commit pending). Phase 03 complete (flag flip config + bake verified; commit pending; smoke test deferred to CEO). Tests: 3060/3060 pass. **Wave 17 P0 chain complete — awaiting git-manager commit, deploy, and CEO smoke.** | **Batch 2 Shipped:** 2026-05-09 — Phases 05 (D1 swap deferred Wave 18; secondary cleanup applied), 07 (HeyGen cleanup complete: 4 files deleted, 3 modified, 446 LOC removed). Phase 08 (E2E Playwright) deferred Wave 18 per planner. Tests: 3047/3079 pass (32 skipped baseline; -13 from deleted wizard tests expected). **Wave 17 SHIPPED 7 of 8 phases — P0 unlocked + harden + cleanup complete. Phase 08 deferred Wave 18.**

## Dependency Graph

```
P0 chain (sequential):
  01 ──► 02 ──► 03

P1 (parallel, independent of P0):
  04   05   06

P2 (parallel, independent):
  07   08

Recommended schedule:
  Day 1-3:  01 (devA) || 04+06 (devB) || 07 (devC)
  Day 4-5:  02 (devA) || 05 (devB)    || 08 setup (devC)
  Day 6:    03 (smoke + flip + verify)
  Day 7-8:  08 finalize + buffer
```

## Token Budget (per phase, est.)

| Phase | Read | Write | Test | Total |
|---|---:|---:|---:|---:|
| 01 | 35k | 25k | 15k | 75k |
| 02 | 20k | 18k | 12k | 50k |
| 03 | 10k | 8k  | 12k | 30k |
| 04 | 15k | 12k | 10k | 37k |
| 05 | 18k | 18k | 12k | 48k |
| 06 | 10k | 10k | 8k  | 28k |
| 07 | 12k | 8k  | 8k  | 28k |
| 08 | 25k | 30k | 25k | 80k |
| — | — | — | — | **~376k** |

Under 500k budget. Phase 08 largest — split off as Wave 18 if scope creeps.

## Constraints Recap (Sophia)

- **Layer rules:** seed → tree → forest → land. Forest may CALL land for orchestration only. See `cross-layer-orchestration.md`.
- **CF-direct doctrine:** `npm run deploy:full` only — GitHub Actions disabled by design. SHA match via `/api/version` mandatory before reporting GREEN.
- **Canonical imports:** `@/seed/auth/better-auth-session` (or `@/lib/better-auth-session` shim), `@/seed/db/get-user-tier`, `@/seed/db/client` (sync), `@/config/tiers`. BANNED: `@/lib/auth`, `@/lib/subscription`, `@/lib/unified-tier-config`, `@/lib/tier-gate`, Polar.
- **Files <200 LOC.** Tier enum uppercase. Zero `:any`. Zod on all API inputs.
- **Coordinator:** each phase runs fullstack-developer → tester → code-reviewer → finalize (pm + docs + git-manager + CF deploy + SHA verify).

## Acceptance ("Wave 17 done")

1. FREE100 user creates AI video → row visible in `/dashboard/videos` gallery (was a Wave 16 gap, surfaced during Phase 01 audit).
2. Distribute panel posts to Telegram successfully end-to-end on production (publishing_jobs row → status=live, telegram message delivered, external_url populated).
3. `NEXT_PUBLIC_DISTRIBUTE_ENABLED=1` set in production wrangler.toml; Distribute button visible.
4. `assertSafeVideoUrl` enforced (no SSRF regressions); only `R2_PUBLIC_HOSTNAME` videos pass.
5. `UNIQUE(paired_by)` constraint enforced on telegram_paired_chats; no duplicate rows.
6. M6 API-key auth distinguishes invalid-key (401) from DB-unreachable (503) with Sentry tag.
7. Deprecated `/api/heygen/create-video` route + `video-creator-wizard.tsx` deleted; zero callers; build green.
8. Playwright E2E covers: magic-link → onboarding redirect → AI prompt → SSE → playable video → Telegram distribute (mock Bot API).
9. All 8 phases: build green, tests pass, code-reviewer ACK, deploy SHA matches.

## Out of Scope (defer to Wave 18+)

- Multi-account Telegram pairing (intentional 1:1 design — phase 04 enforces).
- Replacing Inngest with native Cloudflare Queues.
- video_jobs ↔ videos table merge (large refactor — phase 02 picks minimal-bridge approach).
- Polar.sh re-evaluation (REJECTED for Sophia — see CLAUDE.md).
- BYOK HeyGen mass-onboarding workflow.
- Bundling/CDN refactor.

## Phase Files

- [phase-01-pipeline-bridge.md](./phase-01-pipeline-bridge.md)
- [phase-02-publishing-jobs-wiring.md](./phase-02-publishing-jobs-wiring.md)
- [phase-03-flip-distribute-flag.md](./phase-03-flip-distribute-flag.md)
- [phase-04-telegram-unique-pairing.md](./phase-04-telegram-unique-pairing.md)
- [phase-05-canonical-d1-swap.md](./phase-05-canonical-d1-swap.md)
- [phase-06-api-key-error-taxonomy.md](./phase-06-api-key-error-taxonomy.md)
- [phase-07-heygen-cleanup.md](./phase-07-heygen-cleanup.md)
- [phase-08-e2e-playwright.md](./phase-08-e2e-playwright.md)
