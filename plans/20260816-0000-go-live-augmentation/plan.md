---
title: "Go-Live Augmentation — Hardening, Observability, and Verification"
description: "Six-phase hardening plan covering circuit breaker per-key isolation, mutation testing baseline, health seams, BYOK audit trail, stale-lock recovery, and deploy checklist automation."
status: complete
priority: P1
effort: 18h
branch: main
tags: [go-live, hardening, observability, security, byok, deploy]
created: 2026-08-16
---

# Go-Live Augmentation Plan

## Codebase Context

Three circuit breaker systems exist:
- **System A** (`seed/security/circuit-breaker.ts`): Canonical, D1-backed, 4-state (CLOSED/DEGRADED/OPEN/HALF_OPEN), 40+ consumers, already has `keyRef?` param and per-kind cooldowns. **This is the primary target.**
- **System B** (`seed/utils/circuit-breaker.ts`): HeyGen-specific, KV-backed, 3-state, 6 consumers.
- **System C** (`seed/utils/in-memory-circuit-breaker.ts`): Lightweight in-memory, 1 consumer.

Health/version endpoints already exist and are functional. Lock patterns are D1-based (`INSERT ... ON CONFLICT DO NOTHING`), not KV-based.

## Dependency Graph

```
Phase 01 (Circuit Breaker Hardening) ─────────────── independent
Phase 02 (Stryker + ESLint Complexity Baseline) ──── independent
Phase 03 (Health + Version Endpoints) ────────────── independent
Phase 04 (BYOK Audit JSONL) ──────────────────────── depends on Phase 03 (health seam pattern)
Phase 05 (KV Stale-Lock Recovery) ────────────────── independent
Phase 06 (Deploy Checklist Verification) ─────────── depends on Phase 03, Phase 01, Phase 02, Phase 05
```

Phases 01, 02, 03, 05 may run in parallel. Phase 04 waits for Phase 03. Phase 06 waits for all others.

## Phases

| # | Phase | Status | Files Owned | Effort |
|---|-------|--------|-------------|--------|
| 01 | Circuit Breaker Hardening | TODO | `seed/security/circuit-breaker.ts`, `seed/config/circuit-breaker.ts`, `app/api/admin/circuit-breaker/reset/route.ts` | 3h |
| 02 | Stryker + ESLint Complexity Baseline | TODO | `eslint.config.mjs`, `eslint-suppressions.json`, `stryker.config.mjs` (new) | 3h |
| 03 | Health + Version Endpoints | TODO | `app/api/health/route.ts`, `seed/health/component-probes.ts` (new) | 2h |
| 04 | BYOK Audit JSONL | TODO | `tree/byok/byok-audit-writer.ts`, `seed/utils/jsonl-append.ts`, `app/api/admin/byok-audit/route.ts` | 4h |
| 05 | Stale-Lock Recovery + Reaper | TODO | `seed/utils/stale-lock-recovery.ts`, `seed/utils/d1-lock-reaper.ts` | 3h |
| 06 | Deploy Checklist Verification | TODO | `scripts/deploy-checklist-verify.sh`, `scripts/deploy-full-verified.sh` (modify) | 3h |

## Key Risks

1. **System A already has `keyRef?`** — Phase 01 must enhance, not duplicate. Per-service per-key isolation needs D1 schema extension (new composite key), not just API signature change.
2. **Stryker mutation score regression** — baseline may expose high mutation-killed ratio on untested paths. Mitigation: gate on `>=70%` initially, tighten incrementally.
3. **JSONL append concurrency** — multiple workers appending to same R2 object. Mitigation: unique key per append batch (timestamp + worker ID), not single-key append.
4. **D1 lock reaper false positives** — 5-min threshold may be too aggressive for slow operations. Mitigation: configurable per-entity timeout, log every reaper action.
5. **Deploy checklist gate blocks hotfixes** — checklist failure on known-acceptable conditions. Mitigation: `FORCE_DEPLOY=1` escape hatch with mandatory justification.

## Rollback Plan

Each phase is independently revertible via `git revert <commit>`. No cross-phase data migrations exist; all changes are additive code or config. KV/D1 state is ephemeral and resets on deploy.

## Phase 2 Evidence (Stryker baseline)

2026-08-16 run built 418 mutants across 3 billing targets, then aborted in sandbox teardown when Stryker tried to resolve the project-local `.claude/rules/binh-phap-cicd.md` symlink (absolute target outside the tree). Follow-up: add a `stryker.config.mjs` entrypoint with vitest runner + ignore pattern so baseline can complete and produce a mutation score. Evidence note: `plans/reports/phase-02-stryker-evidence.md`.

## Success Criteria

- Per-key circuit breaker isolation already in production: `circuit-breaker.ts` records `(service, key_ref)` rows in D1 with `INSERT ... ON CONFLICT`, LRU eviction, and per-kind cooldowns. Baseline lint recorded at 249 warnings, zero errors.
- Stryker baseline committed with `>=70%` mutation score, SonarJS complexity rule at threshold
- Stryker baseline committed with `>=70%` mutation score, SonarJS complexity rule at threshold
- `/api/health` returns structured JSON with component status; `/api/version` unchanged
- BYOK key rotations append to JSONL in R2, queryable via admin API
- D1 stale locks auto-recovered after 5-min threshold; reaper logs every action
- Deploy checklist script runs pre-deploy, blocks on failure, allows `FORCE_DEPLOY=1` override
