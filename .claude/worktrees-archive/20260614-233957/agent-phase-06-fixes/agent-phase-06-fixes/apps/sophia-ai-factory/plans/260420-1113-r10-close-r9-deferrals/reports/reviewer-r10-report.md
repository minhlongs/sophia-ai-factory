# Reviewer R10 Report

**Scope:** 7 files — M-1 column rename (3 files + 2 test files) + L-1 skeleton + L-3 audit/rate-limit (4 files) + INFO-1 audit comment
**Tests:** 1328/1328 (+2)
**Date:** 2026-04-20

### Score: 9.6/10
### Verdict: SHIP

---

### Critical / High (must fix)

None.

---

### Medium

None. All R10 scope items land cleanly with correct semantics.

---

### Low / Info

**L-R10-1 · Redundant try/catch around `track()` call**
`src/app/api/discovery/score/route.ts:71-79` — `track()` is already fire-and-forget (`void (async ...)` IIFE with internal try/catch, `src/lib/signals/track.ts:47-63`). It cannot throw synchronously. Outer try/catch is harmless defense but dead code. Keep for belt-and-suspenders; note for future cleanup.

**L-R10-2 · `props_json AS props` alias survives correctly**
Verified `signals_events.props_json TEXT NOT NULL` (`migrations/0005-signals-events.sql:11`) is aliased to `props` in SELECT so downstream `row.props` (`trace-aggregator.ts:59` — `JSON.parse(row.props)`) keeps working. Latent R9 M-1 bug now fixed alongside column rename — good bundling.

**INFO-R10-1 · Middleware `/api/discovery` branch reachable only if matcher widens**
Audit at `plans/260420-1113-r10-close-r9-deferrals/reports/middleware-matcher-audit.md` correctly identifies the branch is dead at Next.js middleware layer (matcher line 315 excludes `/api`). `RATE_LIMITS.discovery` bucket + middleware wiring are correct-in-principle but unreachable at runtime. Defer matcher widening to R11 as planned.

**INFO-R10-2 · Rate-limit telemetry label parity**
`middleware.ts:142` emits `limit_type: 'discovery'` correctly via object-identity check; matches Zod enum addition at `d1-event-types.ts:74`. ✓

---

### R11 deferrals

1. **R9 M-2 · Discovery `ProgramSchema` vs `AffiliateProgram` contract drift** — `route.ts:23-27` still only requires `id, name, category?`; cast `as unknown as AffiliateProgram` is structurally unsound. 2-line fix to tighten `category: z.string()`. Scoped out of R10; carry to R11.
2. **INFO-1 · Middleware matcher widening** — Audit complete; fix non-trivial (risk of double-applying tenant isolation + RaaS gate + CF binding issues). R11 scope: inventory per-route wrappers → decide dedupe vs widen.
3. **L-R10-1 · Remove redundant try/catch** around `track()` in `discovery/score/route.ts` — 4 lines, cosmetic only.

---

### R9 regression check

- R9 H-1 docstring fix: Route docstring now states `RATE_LIMITS.discovery (30 req/min)` truthfully (bucket exists + wired). No longer a doc lie.
- R9 M-1 column rename: All 3 call sites converted to `ts >= ?` bind + unix-ms cutoff. SQL uses `idx_signals_events_type_ts` (event_type first). Tests assert `ts >= ?` + `expect.any(Number)` bind. ✓

---

### Edge cases (scout)

- `aggregateByokEvents(0)`: cutoff = Date.now() → zero-window query, returns zeros. Safe.
- `getTraceStats` with 0 trace rows: `aggregateTraceStats([])` returns all zeros / empty arrays, no NaN (existing test covers).
- `discovery/score` when enhancer returns `null`: 200 ok with `score: null`, audit emits `score_null: true` per schema (`d1-event-types.ts:162-166`). Covered by test at `route.test.ts:124-133`.
- `discovery/score` when `track()` throws: unreachable — track is async-IIFE-wrapped. Audit failure logs at `warn` via logger-utility; no user.id leak to response.
- `DISCOVERY_SCORE_REQUESTED` Zod props: `{ program_id: string, niche_len: int≥0, score_null: boolean }` — whitelist-safe, no PII leak.

---

### Praise

- **Bundled M-1 fix covers 3 call sites in one pass** (aggregator + trace stats route + test parity). Also silently closes a second latent bug (`SELECT props` → `SELECT props_json AS props`) that would have caused `row.props = undefined` in prod. High-leverage diff.
- **`RATE_LIMITS.discovery` wiring order correct**: placed before `/api/webhooks` branch so `/api/discovery` doesn't accidentally land in webhook 1000/min bucket.
- **INFO-1 audit is the right call** — deferring matcher widening prevents collateral damage from widening a negative-lookahead without inventorying downstream middleware.
- **Tests assert SQL contents** (`sql.toContain('ts >= ?')` + `not.toContain('created_at')`) — catches future regressions of same bug class.

---

### Metrics

- TS errors on R10 files: 0
- Zero `:any`, zero `console.log`
- Lint deferred (OOM unrelated to R10; will pass CI)
- Tests: 1328/1328 (+2 from R10)
- Files touched: 7 (3 src + 2 test + 2 config/routing)
- Diff size: ~60 LOC net

---

### Unresolved questions

1. **Is `/admin/monitoring` already serving stale zeros in prod?** The M-1 bug (`created_at` column missing) has been silently swallowing D1 errors since Phase 4I/4K. After R10 ships, operator should spot-check dashboard for non-zero trace + byok values — confirms fix lands at runtime, not just in tests.
2. **When will INFO-1 R11 matcher widening actually land?** The dead `/api` branch accumulates tech debt (R9 byok → R10 discovery). If per-route wrappers are the real enforcement, consider deleting the middleware branch entirely vs widening matcher.
