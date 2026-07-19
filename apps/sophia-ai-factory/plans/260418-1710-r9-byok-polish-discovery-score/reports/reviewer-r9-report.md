# R9 Code Review — 9A (BYOK admin polish) + 9B (/api/discovery/score)

**Reviewer:** code-reviewer
**Date:** 2026-04-18
**Scope:** 7 files (4 modified + 3 new), 1326/1326 tests pass, 0 TS regressions
**Overall score:** **9.3/10**
**Recommendation:** **FIX-THEN-SHIP** — 1 High (doc lie) must fix in <5 min. Remainder SHIP.

---

## Verdict per bundle

- **9A (BYOK admin polish):** 9.4/10 — SHIP. All four items land cleanly. One inherited schema bug flagged as Medium (not R9 fault).
- **9B (/api/discovery/score):** 9.1/10 — FIX-THEN-SHIP. Route docstring states a non-existent rate-limit bucket. Fix the comment, then SHIP.

---

## Critical

None.

---

## High

### H-1 · Route docstring claims non-existent `RATE_LIMITS.discovery` bucket
**File:** `src/app/api/discovery/score/route.ts:8`

```
Rate limiting: RATE_LIMITS.discovery (middleware picks up /api/discovery/* automatically).
```

Verified:
- `RATE_LIMITS` in `src/lib/security/sql-rate-limiter.ts:25-30` exports exactly 4 keys: `api`, `webhook`, `auth`, `admin`. **No `discovery` key.**
- `src/middleware.ts:102` has no `/api/discovery/*` branch. `/api/discovery/score` falls through to the default `RATE_LIMITS.api` (100/min).

**Why High:** Doc lie misleads future auditors + abuse-potential analysis. A user hitting `/api/discovery/score` 100×/min burns OpenRouter tokens on the user's BYOK key (or the platform's fallback key) — 100 calls/min × $0.15/1M tokens on gpt-4o-mini ≈ negligible per-user but non-zero if abused.

**Fix (one of):**
1. **(Minimal)** Change docstring to `Rate limiting: inherits default RATE_LIMITS.api (100 req/min) via /api bucket — future follow-up to add dedicated 'discovery' bucket if abuse observed.`
2. **(Proper)** Add `discovery: { maxRequests: 30, windowSeconds: 60, identifier: 'discovery' }` to `RATE_LIMITS` + wire `/api/discovery` in `src/middleware.ts` before the default fallthrough. *(Note: due to pre-existing matcher exclusion — see INFO-1 — this would also be inert without a broader fix.)*

Minimum acceptable: Fix (1) — one-line comment correction. ~60 sec.

---

## Medium

### M-1 · `aggregateByokEvents` SQL references non-existent column `created_at`
**File:** `src/lib/admin/monitoring-queries.ts:161`

```sql
WHERE event_type IN ('byok_key_set','byok_key_cleared')
  AND created_at >= datetime('now', '-' || ? || ' hours')
```

`signals_events` schema (`migrations/0005-signals-events.sql:5-12`) has:
- `ts INTEGER NOT NULL` (unix ms)
- **no `created_at` column**

In production D1 the query will throw `SQLITE_ERROR: no such column: created_at`. The `try/catch` swallows → dashboard shows zeros silently.

**Severity = Medium (not High):** This is NOT R9's fault — R9 copied the pattern from pre-existing `getTraceStats()` at line 196 (Phase 4K/4M) and `src/app/api/admin/llm-trace-stats/route.ts:56` (Phase 4I). Both are already broken the same way in prod. Tests don't catch it because D1 is mocked and the SQL string is never parsed. Canonical pattern (see `src/lib/signals/digest/d1-aggregates.ts:74-76`) is `WHERE event_type = ? AND ts >= ?` with caller computing unix-ms cutoff.

**Recommended fix (R10 follow-up, not blocking):**
```ts
const cutoffMs = Date.now() - hoursBack * 3600 * 1000
...
`WHERE event_type IN ('byok_key_set','byok_key_cleared') AND ts >= ?`
.bind(cutoffMs)
```
Apply same fix to pre-existing `getTraceStats` + `/api/admin/llm-trace-stats/route.ts` in one pass.

---

### M-2 · Discovery `program` Zod schema diverges from `AffiliateProgram` contract
**File:** `src/app/api/discovery/score/route.ts:19-22`

```ts
const ProgramSchema = z.object({
  id:   z.string().min(1),
  name: z.string().min(1),
}).passthrough()
```

`AffiliateProgram` (`src/types/index.ts:56-69`) requires `category`, `commission`, `commissionType`, `cookieDuration`, `payoutTerms`, `epc`, `link` (non-optional). The `as unknown as AffiliateProgram` cast at line 52 is structurally unsound.

**Concrete downstream effect:** `buildPrompt` in `affiliate-openrouter-niche-enhancer.ts:23` renders `${program.category}` → literal string `"undefined"` when caller omits it. Not a crash, but wasted tokens and degraded match quality.

**Why Medium (not High):** `passthrough()` is safe (no server field leak back — enhancer only reads). Enhancer's graceful-null path (`parseScore` returning null) covers garbage prompts. But the type contract is a fig leaf.

**Recommended fix:** Either (a) tighten schema to require `category: z.string()` minimum for prompt quality, or (b) make `AffiliateProgram` fields conditionally optional in the enhancer. Pick (a) — 2 lines.

---

## Low

### L-1 · Loading skeleton width mismatch
**File:** `src/app/[locale]/dashboard/byok/loading.tsx:7`

Loading wrapper: `max-w-2xl mx-auto`. Real page wrapper (`byok/page.tsx:27`): `space-y-6` (no width constraint). Causes a brief horizontal layout shift as the page content fills wider on load resolve. Cosmetic. Either remove `max-w-2xl mx-auto` or add it to the real page.

### L-2 · Double-cast `as unknown as AffiliateProgram` is a code smell
**File:** `src/app/api/discovery/score/route.ts:52`

Acceptable because `passthrough()` makes Zod's inferred type not assignable directly. But pairs with M-2 — fix together by tightening the schema.

### L-3 · No audit `track()` call on `/api/discovery/score`
**File:** `src/app/api/discovery/score/route.ts`

Spec-correct per R9 plan ("cheap read-like op"). BUT: endpoint makes an outbound OpenRouter call → costs real money per invocation. A light `track(D1Events.DISCOVERY_SCORE_REQUESTED, user.id, { program_id })` would be useful for abuse detection + cost attribution. Not a blocker. Log as R10 nice-to-have.

### L-4 · Test mocks `getCurrentUser` returning `{ id: 'user-abc' } as Awaited<...>`
**File:** `src/app/api/discovery/score/route.test.ts:38`

The cast is safe-ish (route only reads `user.id`), but brittle if `getCurrentUser` contract changes. Prefer a factory helper shared across route tests.

---

## Info (non-actionable)

### INFO-1 · Middleware `/api` matcher exclusion — pre-existing
**File:** `src/middleware.ts:305`

```ts
matcher: ["/((?!api|_next|_worker|setup-wizard|auth/callback|.*\\..*).*)"],
```

The negative lookahead excludes `/api/*` from this middleware entirely. Consequence: the rate-limit branch at lines 69-194 (including R9's new `/api/user/byok → RATE_LIMITS.auth`) is **dead code** for the global Next.js middleware. No `api` path ever triggers it.

**Why Info not Critical:** This is the state shipped by R7 with `/api/auth` and `/api/admin` in the same branch. R9 merely adds cosmetic parity. The real rate-limiter enforcement happens elsewhere (presumably per-route wrappers or Cloudflare edge — not verified here). Flag for orchestrator/architect review but do NOT block R9.

### INFO-2 · 9A.1 telemetry label correctness (verified)
Middleware line 132 uses object-identity check `rateLimitConfig === RATE_LIMITS.auth`. When the byok branch selects `RATE_LIMITS.auth`, the telemetry label emits `'auth'`. Correct. (Moot per INFO-1 but correct on principle.)

### INFO-3 · Zod `passthrough()` safety — verified
Enhancer does NOT echo back the program object. Only reads: `program.name`, `program.category`, `program.description`. No server-controlled field leak. `passthrough()` is safe here.

### INFO-4 · 9A.4 aggregator SQL injection-safety
`bind(hoursBack)` properly parameterizes the numeric input. String concat `'-' || ? || ' hours'` happens inside SQLite's datetime function after binding — safe. (Column-name bug M-1 aside.)

### INFO-5 · 9A.4 netChange negative handling
Tests cover `setCount=0, clearCount=3 → netChange=-3` (line 269). Math is correct for negative case. ✓

### INFO-6 · Regression risk to R8 BYOK admin
None observed. R9 9A only **adds** entries (middleware branch, sidebar icon, loading skeleton, aggregator). `/api/user/byok` route.ts untouched.

### INFO-7 · YAGNI check
- 9A.4 `aggregateByokEvents` exported but not yet wired into `/admin/monitoring` SSR page. Acceptable per plan (staged for R10 UI integration). Keep.
- 9B endpoint is for future discovery UI — no consumer yet. Acceptable per R7 L-2 closure commitment.

---

## Metrics

- **Tests:** 1326/1326 pass (32 targeted). +15 cases from R9 (7 aggregator + 8 discovery-score).
- **TS errors on R9 files:** 0. All pre-existing errors live in `src/worker/*`.
- **Type coverage:** R9 introduces zero `any`. One `as unknown as AffiliateProgram` (L-2/M-2).
- **Lines added:** ~180 (loading 28 + aggregator 28 + tests 87 + discovery route 67 + test 143 — approx).
- **Security:** No secret exposure; no SQL injection; no XSS vector; auth gated on all new surfaces.

---

## Recommended fix list (prioritized)

1. **H-1** (60 sec): Fix docstring in `route.ts:8` — state `RATE_LIMITS.api` default instead of non-existent `RATE_LIMITS.discovery`.
2. **M-2** (2 min): Tighten `ProgramSchema` to at minimum require `category: z.string()`.
3. Log as R10: **M-1** fix `created_at → ts` across all 3 callers (R9 aggregator + pre-existing `getTraceStats` + `/api/admin/llm-trace-stats`).
4. Log as R10: **L-3** add light `track()` on discovery-score for abuse detection.
5. Log as R10 cleanup: **L-1** loading skeleton width parity.

---

## Unresolved questions

1. **M-1 latent bug scope:** Is `/admin/monitoring` already showing zero LLM traces in prod because of the `created_at` column bug? Operator should spot-check prod dashboard before assuming tests cover this surface. If zeros seen, the pre-existing bug from Phase 4I has been silent for weeks — promote to High in R10.
2. **INFO-1 rate-limit enforcement reality:** Where DOES `/api/*` rate-limiting actually happen? Per-route wrapper? Cloudflare edge? Worker? Orchestrator should confirm before a future rate-limit audit. The Phase 8A + R7 + R9 rate-limit branches all appear inert.
3. **L-3 discovery cost attribution:** Does abuse (100 req/min × OpenRouter) need a distinct rate-limit bucket before wider release, or can platform accept this risk at current user base size?
