# Code Review — Phase 28 Wave 2 `getErrorMessage()` Sweep (`src/app/api/**`)

**Date:** 2026-04-24
**Reviewer:** code-reviewer
**Scope:** 14 sites / 8 files in `src/app/api/**`
**Plan:** `plans/260424-0325-phase-28-ternary-sweep-wave-2-api/phase-28-ternary-sweep-wave-2-api.md`

## Summary
Mechanical DRY sweep replacing `err instanceof Error ? err.message : String(err)` with `getErrorMessage(err)` across 8 API route files. Pure refactor — zero semantic drift. Same pattern as Phase 27 Wave 1 (APPROVE SHIP 9.8/10), broader surface.

## Scope Verification (per-file hit counts)

| File | Plan | Actual `getErrorMessage` usages | ✓ |
|------|------|-------------------------------|---|
| `health/detail/route.ts` | 2 | 2 (lines 62, 80) | ✓ |
| `user/byok/route.ts` | 2 | 2 (lines 73, 111) | ✓ |
| `discovery/score/route.ts` | 1 | 1 (line 66) | ✓ |
| `admin/llm-cache-stats/route.ts` | 1 | 1 (line 38) | ✓ |
| `admin/llm-trace-stats/route.ts` | 1 | 1 (line 71) | ✓ |
| `cron/llm-cache-purge/route.ts` | 1 | 1 (line 65) | ✓ |
| `cron/workflow-stepper/route.ts` | 1 | 1 (line 327) | ✓ |
| `cron/weekly-signals-digest/route.ts` | 5 | 5 (lines 60, 136, 173, 194, 292) | ✓ |
| **Total** | **14** | **14** | ✓ |

Residual `err instanceof Error ? err.message : String(err)` matches under `src/app/api/**`: **0** (confirmed via Grep).

## Import Path Audit
All 8 files import from canonical path: `import { getErrorMessage } from '@/lib/utils/to-error'` (health/detail uses `"` quotes — stylistic, file-local consistency preserved). No import duplication. No unused imports.

## Behavior Preservation Audit

**Site-by-site:**
1. `health/detail/route.ts:62,80` — `catch (err)` → `error: getErrorMessage(err)` on `SubsystemCheck` JSON field. String output identical.
2. `user/byok/route.ts:73,111` — `logger.warn` metadata field. String output identical.
3. `discovery/score/route.ts:66` — `logger.warn` metadata field. String output identical.
4. `admin/llm-cache-stats/route.ts:38` — `const message = getErrorMessage(err)` → NextResponse JSON `error` field. Variable shape preserved per plan step 3.
5. `admin/llm-trace-stats/route.ts:71` — same pattern as above. Preserved.
6. `cron/llm-cache-purge/route.ts:65` — same pattern. Preserved.
7. `cron/workflow-stepper/route.ts:327` — `const msg = getErrorMessage(err)` → used downstream via `msg.slice(0, 500)` and `msg.slice(0, 200)`. `getErrorMessage` returns string → `.slice()` contract intact. The 3 other `catch (err)` blocks in this file (lines 169, 255, 478) pass `err` directly to `logger.warn` as full error object — correctly untouched, not within sweep pattern.
8. `cron/weekly-signals-digest/route.ts:60,136,173,194,292` — all `logger.warn` metadata fields. String output identical.

**Semantic delta:** Only observability can *improve* for PostgrestError-shaped inputs (previously `"[object Object]"`, now `.message`). Aligns with Phase 26 `toError()` design intent.

## Edge Case Scouting

- **Throw-chain:** `workflow-stepper:357` rethrows `err` after mutating `msg` — `msg` is derived-from-err via `getErrorMessage()`, the original `err` object is preserved for rethrow. No behavior change.
- **Null/undefined err:** `getErrorMessage(undefined)` → `new Error(String(undefined))` → `"undefined"`. Same as prior `String(err)` branch.
- **No await around sync call:** `getErrorMessage` is synchronous — all call sites correctly non-awaited.
- **Type narrowing:** All sites previously typed `err: unknown` (implicit from catch). `getErrorMessage(unknown): string` — no TS regression.

## Out-of-Scope Observations (Not Blocking)

Broader `src/app/api/**` still contains shape-equivalent ternaries using different variable names (`error`, `e` instead of `err`) — e.g. `cron/uptime-check/route.ts:96`, `cron/usage-export/route.ts:259,378`, `admin/api-keys/route.ts:194`. Plan explicitly scoped to `err` identifier only; these 4 sites remain candidates for Phase 29 Wave 3 or a follow-up pass. Flagging for visibility — **not blocking** this wave.

## Verification (user-reported, spot-confirmed)

- 1321/1321 tests pass (Δ 0 vs baseline) ✓
- 611 TS errors (Δ 0 vs baseline) ✓
- Lint: 0 errors on touched files ✓
- Build exit 0 ✓
- `src/app/api/**` residual `err`-variant ternary count: 0 ✓ (re-confirmed)

## Risk Assessment
**Blast radius:** Very low. Same transform as Phase 27 Wave 1 (9.8/10 ship). All 14 sites are `catch`-block → string output (logger metadata OR JSON error fields). Zero throw-chain changes. Single-commit revert available.

## Score
**9.7 / 10** — deducted 0.3 for the 4 shape-equivalent `error`/`e`-variant sites left in `src/app/api/**` (plan-scoped out, but ideally one wave could have absorbed all identifier variants).

## Verdict
**APPROVE SHIP**
