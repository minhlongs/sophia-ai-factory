---
name: Sophia Phase 4F Cache Wiring (MVP)
status: in_progress
priority: P1
estimate: 1.5h
session: PM-14 2026-04-18
---

# Phase 4F Cache Wiring — MVP

Unblocked by Phase 4E H-1 (composite PK `(hash, org_id)` + empty-orgId guards
shipped commit `45f82523`). Wire the LLM cache into a real user-facing hot
path so the `LLM_CACHE_ENABLED=1` flag actually cuts the bill when flipped.

## Scope

- Create `callWithCache()` primitive so cache wiring is 3 lines per call site
- Wire cache into `src/lib/ai/script-generator.ts` (OpenRouter fetch for
  campaign scripts — the single hottest LLM caller in prod)
- Thread `orgId` from Inngest event (`userId` as scope — documented as
  single-tenant idiom consistent with `src/app/api/raas/missions/route.ts:40`)

## Phases

| Phase | File(s)                                              | Status |
|-------|------------------------------------------------------|--------|
| 1     | `lib/llm/cache/call-with-cache.ts` (new, <80 LOC)    | todo   |
| 1     | `lib/llm/cache/call-with-cache.test.ts` (new, 4 t)   | todo   |
| 2     | `lib/ai/script-generator.ts` (wrap fetch)            | todo   |
| 2     | `lib/services/types.ts` (+ `orgId?: string`)         | todo   |
| 2     | `lib/services/real/script-service.ts` (pass-through) | todo   |
| 2     | `lib/inngest/functions/generate-campaign.ts:104`     | todo   |
| 3     | `lib/ai/script-generator.test.ts` (new, 2 t)         | todo   |

## Out of scope

- Supervisor `executeStep` real LLM call (still stub — Phase 4G)
- RaaS direct workflow endpoints (no user-facing LLM call yet)
- `resolveOrgId()` helper unification (Phase 4F.1)
- Embedding / semantic similarity (Phase 4E.2)
- Per-org purge cron (Phase 4E.3)

## Rollback

- Zero D1 changes; no migration needed
- `LLM_CACHE_ENABLED` env gate remains OFF in prod
- Revert is a single `git revert`
- Wrapper short-circuits when env OFF → zero latency / zero behavior change

## Success criteria

- `callWithCache()` unit-tested (hit / miss / disabled / fetch-throws)
- `script-generator` cache-hit test: OpenRouter `fetch` NOT called
- Tests 1171 → 1176+ (added ≥5 tests)
- `npx tsc --noEmit` clean (no new errors)
- Code-reviewer score ≥9.5 (auto-ship threshold)
- Rule #0 full verify: push → CI → prod HTTP 200 + shortSha match

## Locked decisions (auto-mode defaults)

- **orgId source in Inngest:** use `event.data.userId` as cache scope. Safe
  because (a) cross-tenant isolation enforced at DB-level composite PK even
  if mapping is coarser, (b) consistent with existing Sophia idiom, (c)
  follow-up Phase 4F.1 can refine via `resolveOrgId()` without churn.
- **Skip trackUsage on cache hit:** user pays 0 credits (cache hit = freebie).
  Telemetry preserved via `llm_cache.hit_count` column.
- **Mock service passes orgId through ignored:** signature consistency;
  MockScriptService never hits LLM so caching is irrelevant for it.
