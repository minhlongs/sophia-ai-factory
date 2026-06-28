# OpenClaw & API Endpoints Audit
Date: 2026-03-26 | App: sophia-proposal (CF Workers + D1 + JWT cookie auth)

---

## OpenClaw Commands Status

| Command | Handler File | Model Tier | Status |
|---------|-------------|------------|--------|
| `proposal:create` | command-helpers.ts → `runProposalCreate` | default (Sonnet) | IMPLEMENTED |
| `video:create` | command-helpers.ts → `runVideoCreate` | default (Sonnet) | IMPLEMENTED (HeyGen) |
| `affiliate:generate` | command-router.ts → `runAffiliateGenerate` | default (Sonnet) | IMPLEMENTED |
| `affiliate:scrape` | command-router.ts → `runAffiliateScrape` | default (Sonnet) | IMPLEMENTED |
| `content:blog` | command-router.ts → `runContentBlog` | default (Sonnet) | IMPLEMENTED |
| `content:social` | command-router.ts → `runContentSocial` | default (Sonnet) | IMPLEMENTED |
| `crm:sync` | command-helpers.ts → `runCrmSync` | default (Sonnet) | CHECK (not read) |
| `analytics:export` | command-helpers.ts → `runAnalyticsExport` | default (Sonnet) | CHECK (not read) |
| `gtm:campaign` | command-helpers.ts → `runGtmCampaign` | default (Sonnet) | CHECK (not read) |
| `sales:battlecard` | command-helpers.ts → `runSalesBattlecard` | default (Sonnet) | IMPLEMENTED |
| `sales:proposal-deck` | sales-commands.ts → `runProposalDeck` | default (Sonnet) | IMPLEMENTED |
| `sales:roi-calculator` | sales-commands.ts → `runRoiCalculator` | default (Sonnet) | CHECK (not read) |
| `sales:competitor-analysis` | sales-commands.ts → `runCompetitorAnalysis` | heavy (Opus) | IMPLEMENTED |
| `sales:pricing-optimizer` | sales-commands.ts → `runPricingOptimizer` | default (Sonnet) | CHECK (not read) |
| `sales:outreach-sequence` | sales-commands.ts → `runOutreachSequence` | default (Sonnet) | IMPLEMENTED |
| `lead:generate` | lead-email-commands.ts → `runLeadGenerate` | default (Sonnet) | CHECK (not read) |
| `email:send` | lead-email-commands.ts → `runEmailSend` | fast (Haiku) | CHECK (not read) |

**Note:** 17 commands in command-router.ts vs 15 in command-model-routing.ts — `affiliate:generate` and `affiliate:scrape` have handlers but no entry in model routing table (default tier applied via fallback).

---

## API Endpoints Status

All endpoints tested unauthenticated from `https://sophia.agencyos.network` (CF Workers deployment).

| Endpoint | Method | Auth Required | HTTP Status | Issue |
|----------|--------|--------------|-------------|-------|
| `/api/v1` | GET | No | 200 OK | None — returns `{"version":"v1","status":"ok"}` |
| `/api/raas/usage` | GET | Yes (JWT cookie) | 401 | Expected — auth working |
| `/api/raas/keys` | GET | Yes (JWT cookie) | 401 | Expected — auth working |
| `/api/raas/missions` | GET | Yes (JWT cookie) | 401 | Expected — auth working |
| `/api/raas/templates` | GET | Yes (JWT cookie) | 401 | Expected — auth working |
| `/api/affiliate/content` | GET | Yes (JWT cookie) | 401 | Expected — auth working |
| `/api/affiliate/clicks/stats` | GET | Yes (JWT cookie) | 401 | Expected — auth working |
| `/api/admin/provision` | POST | Yes (JWT cookie + admin role) | 401 | Expected — auth working |
| `/api/onboarding` | POST | Yes (JWT cookie) | 401 | Expected — auth working |
| `/api/billing/checkout` | POST | Yes (JWT cookie) | 401 | Expected — auth working |

All protected endpoints return 401 with `content-type: application/json` — correct behavior. No 500s observed on unauthenticated probes.

**Missing from middleware protectedApiRoutes list:** `/api/raas` and `/api/affiliate` are NOT in `protectedApiRoutes` in middleware.ts (only `/api/org`, `/api/billing`, `/api/onboarding`, `/api/admin` are listed). These routes rely on in-handler auth via `getAuthContext()` — works but lacks early rejection at middleware layer, meaning requests hit route handler before auth check.

---

## D1 Query Issues

The D1QueryBuilder (`lib/db/d1-query-builder.ts`) implements most Supabase-style methods natively. However, the following usages have risks or confirmed compatibility issues:

### `{ count: 'exact', head: true }` pattern — RISK
D1QueryBuilder `select()` accepts `opts?.count` to set `isCount = true`, but does NOT handle `head: true` (which in Supabase means return only the count, no rows). The builder always fetches rows AND runs a separate COUNT query. In most cases this means extra data returned, not an error — but behavior diverges from Supabase.

- `apps/sophia-proposal/app/api/onboarding/status/route.ts:56` — `.select('*', { count: 'exact', head: true })` → proposals count check. Will return rows (wasted data) but count will be correct.
- `apps/sophia-proposal/app/api/analytics/metrics/route.ts:48,55,65,80` — multiple count+head queries. Same issue — no error but row data unnecessarily fetched.
- `apps/sophia-proposal/app/api/analytics/export/route.ts:66,72,81,94` — same pattern repeated 4x.

### `onboarding/status/route.ts` — CRITICAL AUTH BUG
```
const orgId = request.headers.get('x-org-id');
if (!orgId) return 401
```
This endpoint trusts `x-org-id` header directly — **user-controlled input, no JWT verification**. Any caller can forge any orgId and read another org's onboarding status, subscription tier, and checklist. This is a **tenant isolation violation**.

Note: middleware.ts has a comment explicitly noting this was fixed for MCU balance checks: *"SECURITY FIX: Derive org_id from authenticated session, NOT from header"* — but `onboarding/status/route.ts` was not updated.

### `.gte()`, `.lte()`, `.range()` — COMPATIBLE
These are all implemented in D1QueryBuilder and translate to SQL `>=`, `<=`, and `LIMIT/OFFSET`. No runtime errors expected.

- `app/api/affiliate/programs/route.ts:43,45` — `.gte('score', ...)` + `.range(...)` — OK
- `app/api/affiliate/content/route.ts:34` — `.range(offset, offset + pageSize - 1)` — OK
- `app/api/affiliate/clicks/stats/route.ts:44` — `.gte('clicked_at', ...)` — OK
- `app/api/raas/missions/route.ts:42` — `.range(...)` — OK
- `app/api/health/deep/route.ts:40,62` — `.gte('created_at', ...)` — OK

### `missions/route.ts` — select with count issue
`.select('*', { count: 'exact' })` followed by `.range()` — D1QueryBuilder runs two queries (rows + COUNT). Functionally correct, but 2x DB roundtrips per paginated missions list. Low severity, performance concern only.

### `rpc('credit_mcu_balance')` double-write bug
In `d1-query-builder.ts` creditMcuBalance: runs `UPDATE org_balances` then also runs an `INSERT ... ON CONFLICT DO UPDATE` (upsert). This means every credit operation does 2 writes. If the UPDATE succeeds, the upsert also increments balance again by the same amount — **potential double-credit bug** if the org_balances row already exists.

---

## Auth Flow

- [x] JWT cookie (`auth-token`) — custom HMAC-SHA256 HS256, 7-day expiry, CF Web Crypto API compatible
- [x] `verifyJwt` in auth-verify.ts — validates signature, checks `exp` claim, returns payload
- [x] `getUserOrganization` in auth.ts — looks up org via `org_members` join
- [x] `getAuthContext()` in raas/auth-context.ts — shared helper used by all `/api/raas/*` and `/api/affiliate/*` routes
- [x] middleware.ts — public route list correct, JWT_SECRET=REDACTED missing → 503 on API or redirect to /status
- [x] middleware extracts orgId from JWT (not header) for MCU balance checks — SSRF-safe
- [x] Webhook SSRF protection in engine.ts — blocks localhost, 10.x, 192.168.x, 172.x, 169.254.169.254, *.internal
- [ ] **BUG: `/api/onboarding/status`** trusts `x-org-id` header without JWT verification — tenant isolation violation
- [ ] **MISSING: `/api/raas` and `/api/affiliate` not in middleware `protectedApiRoutes`** — auth enforced in-handler only (weaker — allows middleware to pass request through, no early rejection)
- [ ] **BUG: admin/provision GET** — no admin role check, only checks cookie presence. Any authenticated user can list all provisioned clients.
- [ ] `affiliate:generate` and `affiliate:scrape` missing from command-model-routing.ts TIER_MAP — fallback to default tier silently

---

## Summary: Top Issues by Severity

| Sev | Issue | File |
|-----|-------|------|
| P0 | `x-org-id` header trusted without auth in onboarding/status | `app/api/onboarding/status/route.ts` |
| P0 | `creditMcuBalance` double-write — UPDATE + upsert both increment balance | `lib/db/d1-query-builder.ts:439-451` |
| P1 | `admin/provision` GET has no admin role check | `app/api/admin/provision/route.ts` |
| P1 | `/api/raas` and `/api/affiliate` missing from middleware protectedApiRoutes | `middleware.ts:29` |
| P2 | `count+head: true` pattern — extra row fetch, wasted D1 reads | analytics/metrics, analytics/export, onboarding/status |
| P3 | `affiliate:generate`, `affiliate:scrape` not in command-model-routing.ts | `lib/ai/command-model-routing.ts` |

---

## Unresolved Questions

1. Are `crm:sync`, `analytics:export`, `gtm:campaign`, `sales:roi-calculator`, `sales:pricing-optimizer`, `lead:generate`, `email:send` fully implemented in their handler files or stubs? (command-helpers.ts not fully read)
2. Is the double-credit bug in `creditMcuBalance` triggered in production? The first `UPDATE` would succeed on existing rows, making the upsert's `balance + ?` fire again. Needs D1 transaction log review.
3. Does CF Workers D1 support multi-statement batches atomically? The `this.db.batch([])` in debitMcuBalance assumes atomicity — D1 batch is NOT atomic by default.
