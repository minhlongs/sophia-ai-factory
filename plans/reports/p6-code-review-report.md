# P6 Code Review Report — Revenue Ingestion (YouTube Analytics → performance_events)

Date: 2026-08-25 · Agent: code-reviewer · Commit under review: `5c21ccb1f` + untracked P5 test file
Plan: `.orchestrate/latest/plan.md` · Task: `.orchestrate/latest/task.md`

## Verdict: PASS

The slice is correct, idempotent, additive, and fully gated. No critical or high-severity findings. Four low/medium observations documented below; none block ship.

## Scope

- Source (5 files, 672 LOC): `src/land/analytics/youtube-analytics-fetcher.ts` (117), `src/land/analytics/analytics-normalizer.ts` (76), `src/tree/performance/events.ts` (197), `src/forest/inngest/functions/analytics-sync.ts` (180), `src/land/analytics/revenue-ingestion.ts` (102)
- Tests (5 files, 624 LOC): fetcher (109), normalizer (56), events-idempotent (98), revenue-ingestion (164), analytics-sync-revenue (197)
- Focus: P1-P5 implementation + P6 gates

## Gate verification (all run by reviewer, 2026-08-25)

| Gate | Result |
|---|---|
| `npx tsc --noEmit` (from `apps/sophia-ai-factory/`) | PASS — exit 0 |
| `npm test` | PASS — 7979 passed, 1 failed = pinned C1 (`src/land/youtube/__tests__/actions.test.ts:322`, pre-existing, protected file untouched) |
| `npm run build` | PASS — exit 0 (Sentry sourcemap skip is expected per no-tech doctrine) |
| ESLint on all 10 touched files | PASS — exit 0, no new suppressions |
| Grep gates (`:any`, `console.*`, `TODO`, `FIXME`, `eslint-disable`) | PASS — zero matches in all 10 files |
| File size ≤200 lines | PASS — max is `events.ts` at 197 |
| Banned imports (`@/lib/auth`, `@/lib/subscription`, `@/lib/unified-tier-config`, `@/lib/tier-gate`) | PASS — none |
| Layer rules | PASS — forest→land in `analytics-sync.ts:16` is the sanctioned orchestration exception; no land→forest imports in slice |
| Migrations | PASS — `git diff 9227f197e 5c21ccb1f -- migrations/` empty |
| Protected flows | PASS — Setup Wizard, Telegram, NOWPayments, `land/creative-mission/` all untouched in commit |
| Slice tests | PASS — 27/27 (5 files) on real node:sqlite via shared-d1-shim |

## Correctness verification

1. **Positional parsing (plan risk #2):** `estimatedRevenue` appended LAST in `METRICS` (`youtube-analytics-fetcher.ts:34-45`) with a "do not reorder" comment; parser maps `row[10] ?? 0` (:107); indices 0-9 unchanged. Fetcher test asserts all 11 indices plus missing-11th-column → 0.
2. **Unit conversion (plan risk: microUSD):** `Math.max(0, Math.round(raw.estimatedRevenue / 10_000))` (`analytics-normalizer.ts:59`) is correct — YouTube Analytics `estimatedRevenue` is documented as micro USD (1 USD = 1,000,000), so ÷10⁶×100 = ÷10⁴. Verified against Google's metric documentation. Test table covers 1M→100, 999_999→100, 1→0, 0→0, 12_345→1, negative→0.
3. **Idempotency (plan TOP RISK):** deterministic id `rev_{userId}_{videoId}_{date}` (`revenue-ingestion.ts:83`) + `INSERT OR IGNORE` returning `meta.changes > 0` (`events.ts:136-148`). Proven at three levels: writer unit test (re-insert → false, no overwrite), ingestion test (second pass → `{written:0, skipped:2}`), and full-cron integration (second handler run → 0 new rows).
4. **Multi-tenant scoping (plan risk #3):** workspace resolved once per user from `org_members` (`revenue-ingestion.ts:37-45`), matching the dashboard's membership pattern (`dashboard-summary.ts:52-56`). No-org user → warn + skip, never throw; integration test proves no cross-workspace rows.
5. **`recorded_at` unit (plan risk #5):** UTC-midnight epoch-ms via `new Date(\`${date}T00:00:00Z\`).getTime()` (`revenue-ingestion.ts:48-50`), matching the dashboard's ms-window filter (`dashboard-summary.ts:8,72-73`). Test asserts `Date.UTC(2026, 7, 1)`.
6. **Dashboard read path:** `dashboard-summary.ts:67` sums `value_cents` for `event_type IN ('revenue','conversion','impression')` scoped by `workspace_id` — the written rows (`event_type='revenue'`, populated `workspace_id`, positive `value_cents`) land exactly in this sum.
7. **Non-fatal wiring (plan risk #4):** revenue write is after the upsert loop, in its own try/catch (`analytics-sync.ts:142-152`); failure does not reduce `synced`. Existing upsert behavior unchanged (diff shows only return-shape widening `number` → `{count, revenueWritten}` inside the step).
8. **Circuit breaker + failure classification:** fetcher uses `shouldAllowRequest`/`recordSuccess`/`recordFailure` with `classifyHttpStatus`/`classifyError` per quality gates (`youtube-analytics-fetcher.ts:58-60,78-85,113-114`).
9. **Tests are real:** DB tests run against node:sqlite via `shared-d1-shim` (real `INSERT OR IGNORE` semantics, real PK collisions). Integration test stubs only true boundaries: HTTP fetch, credential decryption, `video_analytics` upsert (table absent from shim schema — documented in P5 report), feedback loop. No fake-pass hacks.

## Findings

### Medium

**M1. `entityType: 'video'` is outside the documented enum.**
`revenue-ingestion.ts:87` writes `entityType: 'video'`, but `creative-domain.ts:317` documents `'asset' | 'mission' | 'campaign'` and `src/app/api/roi/route.ts:27` enforces `z.enum(['mission', 'asset', 'campaign'])`. The plan explicitly sanctioned this (Assumptions, confidence medium) and the type is `string` so nothing breaks at runtime; no consumer filters `entity_type` in a way that would misread these rows (`content-roi-resolver.ts` joins on `'content_project'` in `roi_records`, a different table; `performance-aggregation.ts` groups dynamically). However, revenue events will be invisible to any future query constrained to the documented enum, and the ROI route can never query them.
Recommendation (non-blocking): either widen the documented enum comment + ROI zod enum to include `'video'`, or switch to `'asset'` (videoId is an asset id). Decide before other domains start reading `entity_type='video'`.

### Low

**L1. `completionRate` is a constant 1.0, and this slice now persists it every sync.**
`analytics-normalizer.ts:51`: `Math.min(avgViewDuration / Math.max(avgViewDuration, 1), 1.0)` evaluates to 1.0 for every positive input. Pre-existing (not introduced here), but P4 wiring now writes it into `video_analytics` on every cron pass. The comment acknowledges the API limitation. Consider emitting `0`/`null`-equivalent or dropping the field from the upsert until video duration metadata is available, so downstream consumers don't treat 1.0 as a real 100% completion signal.

**L2. Sequential await-per-row in revenue writes (N+1).**
`revenue-ingestion.ts:82-95` awaits one INSERT per row inside the loop (and `analytics-sync.ts:121` does the same for upserts, pre-existing). Worst case ≈ users × videos × 30 days of sequential D1 round-trips per 12h run. Fine at current scale; if the published-video count grows, batch with `db.batch()` or a multi-row INSERT.

**L3. Non-deterministic workspace pick for multi-org users.**
`revenue-ingestion.ts:41`: `SELECT org_id FROM org_members WHERE user_id = ? LIMIT 1` has no `ORDER BY`. A user in multiple orgs gets whichever row SQLite returns first; the choice is stable in practice but not guaranteed. Acceptable given the dashboard read path is membership-gated per workspace, but add `ORDER BY` (e.g., by membership creation) if multi-org users become a real case.

### Informational

**I1. Error re-throw detection by message substring** (`youtube-analytics-fetcher.ts:110`): pre-existing pattern; a non-HTTP error whose message contains "YouTube Analytics API" would skip `recordFailure`. Not introduced by this slice.

**I2. P5 test file is untracked.** `src/forest/inngest/functions/__tests__/analytics-sync-revenue.test.ts` shows as `??` in git status (P5 was test-only per file ownership). Must be included in the ship commit.

**I3. Zero-cent skip is a documented trade-off** (plan risk #7): video-days earning $0 produce no events, so event-count-based dashboards undercount active days. Accepted by plan; noted for future reference only.

## Positive observations (risk calibration)

- Idempotency is defended at three independent test levels (writer, ingestion, full cron) — the TOP RISK is genuinely covered, not asserted.
- The `METRICS` "do not reorder" comment and the 11-index fetcher test directly guard the positional-parsing corruption risk.
- Integration test deliberately gives the no-org user a *positive* revenue row (500K microUSD) so its exclusion proves workspace-resolution skip rather than zero-cent skip — good test design.
- `domainToRow` reuse keeps `metrics_json`/`value_cents` NOT NULL invariants intact for the new writer.

## Recommended actions

1. Ship as-is (PASS). Include the untracked P5 test file in the commit (I2).
2. Decide M1 (`'video'` vs `'asset'` enum widening) before any new consumer reads `entity_type` — cheapest to fix now while row volume is zero.
3. Optional backlog: L1 completionRate semantics, L2 batching if volume grows, L3 `ORDER BY` if multi-org users appear.

## Metrics

- Type coverage: 100% (tsc exit 0, zero `:any` in touched files)
- Tests: 27/27 slice tests; full suite 7979 pass / 1 pinned-C1 fail / 34 skip
- Lint issues: 0 on touched files
- Build: exit 0

## Unresolved questions

None blocking. M1 is a product/schema decision for the lead, not a correctness defect.
