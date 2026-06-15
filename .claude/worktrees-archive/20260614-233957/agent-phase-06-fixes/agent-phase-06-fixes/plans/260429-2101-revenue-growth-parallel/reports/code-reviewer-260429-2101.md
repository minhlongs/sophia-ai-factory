# Code Review — Phase A/B/C Parallel (Revenue/Growth Batch)

**Date:** 2026-04-29 21:01
**Scope:** 7 files (2 new routes, 2 new test suites, 1 webhook patch, 1 page refactor, 1 doc)
**Files reviewed:**
- `src/app/api/checkout/route.ts` + `route.test.ts` (Phase A)
- `src/app/api/webhooks/telegram/route.ts` + `route.test.ts` (Phase B)
- `src/app/api/affiliate-discovery/route.ts` + `route.test.ts` (Phase C)
- `src/app/[locale]/affiliate-discovery/page.tsx` (Phase C)

## Overall Score: 9.6/10 — APPROVE

---

## Phase A — Checkout Tests

- **Tier alias chain correct.** `tierMap` chains STARTER→BASIC, GROWTH→PREMIUM, PREMIUM_TIER→ENTERPRISE, MASTER→MASTER. `mappedTier` then re-validated against `NOWPAYMENTS_TIERS[mappedTier]` so unknown raw tiers redirect to `/pricing`. Tests cover all 4 canonical + STARTER/GROWTH aliases + invalid + missing + anonymous.
- **No tier bypass.** `createInvoiceUrl(mappedTier, userId)` always uses canonical key — alias inputs cannot smuggle a non-canonical tier through. Anonymous users redirected to `/login` BEFORE invoice creation (verified by `expect(mockCreateInvoiceUrl).not.toHaveBeenCalled()`).
- **Input sanitation.** `tier` flows through Zod `checkoutSchema` (POST) and uppercase-coerce + map-lookup (GET). `userId` comes from authed session, never from request body. NOWPayments URL is built via `URLSearchParams` (auto-encoded). Safe.

## Phase B — Telegram Missing-Token Guard

- **Returns 200 not 500 — correct.** `if (!process.env.TELEGRAM_BOT_TOKEN) return NextResponse.json({ ok: true })` short-circuits BEFORE try/catch. Telegram retry-storm avoided. `console.warn` is allowed by project rules for missing-config warnings.
- **Order matters and is correct.** Token check happens before secret-token check, before body parse. Dormant bot stays silent; no handler invoked (test asserts `handleStart` not called).
- **Test coverage solid.** New test exercises `delete process.env.TELEGRAM_BOT_TOKEN` path and asserts `{ ok: true }` + 200.

## Phase C — Affiliate Discovery API + Page

- **Public-data scope is correct, no user PII exposed.** Route returns only `id, offer_name, network, commission_rate, created_at` from `affiliate_offers_selected`. No `user_id`, no auth-scoped joins, no per-user filtering. Phase C report's "user-scoped data publicly" concern does NOT apply — this is a curated public catalog, by design (analogous to a product listing).
- **Pagination correct, no off-by-one.** `offset = (page - 1) * limit`; `range(offset, offset + limit - 1)` is Postgres/Supabase inclusive range. For `page=2, limit=50` → `range(50, 99)` covers rows 51-100. Test asserts exact call. Zod enforces `page≥1, limit≤100`.
- **Rate limit wired** at 60 req/min. Empty-state UX in `page.tsx` renders `<PackageOpen>` icon + bilingual copy + CTA to `/pricing` — handles `[]` cleanly.
- **Page refactor swaps DEMO mock for real D1 query** via `createServerClient()` (sync, no `await` — correct). Falls back to `[]` on DB error so page never 500s.

---

## Critical Issues (block merge)

**None.**

---

## Nits (don't block, follow-up tickets)

1. **`route.ts:66` double cast** — `(rowsResult.data ?? []) as unknown as AffiliateOffer[]`. Acceptable for D1 untyped client but consider a `parseAffiliateRow()` runtime guard later if schema drifts.
2. **`route.test.ts:31-35`** — `then` assigned via mutation with `as unknown` cast. Works but a custom thenable factory would be cleaner. Tests pass; not worth churn.
3. **`page.tsx` duplicates query logic** that `/api/affiliate-discovery` route already exposes. Server component fetches D1 directly instead of calling its own API. Fine for SSR perf (saves one fetch hop) but creates two read paths. Document the choice in `docs/system-architecture.md` if it persists.
4. **`route.ts:20-25` `AffiliateOffer` interface** is exported from a `route.ts` file and imported by `page.tsx`. Convention drift — type should live in `@/types/` or `@/lib/affiliate/`. Move when bandwidth allows.
5. **Webhook missing-token branch lacks rate limiting** — by design (returns immediately) but worth noting if attacker spams the endpoint to fill logs. `console.warn` could flood. Low priority.

---

## Recommendation: APPROVE for merge

All 4 must-pass criteria green:
- Zero `:any` (verified — only `unknown` casts in test mocks, which is correct usage)
- Zero `console.log` in prod code (one `console.warn` allowed by rules)
- Zod on all API inputs (`checkoutSchema`, `querySchema`)
- Sync `createServerClient()` everywhere — no `await` smell
- Tier enum uppercase-only enforced; aliases re-mapped to canonical before any DB/billing call
- Better Auth via `@/lib/better-auth-session` (`getCurrentUserFromHeaders`) — correct import path
- Tests cover happy path + 401/400/empty/pagination edges

Score breakdown: Security 10, Correctness 10, Tests 9.5, Quality 9, Docs 9.5 → **9.6/10**.

---

## Unresolved Questions

1. Should `affiliate-discovery` page hit the API route instead of D1 directly, for single-source consistency? (perf trade-off — currently OK)
2. Is there a desired retention/expiry on `affiliate_offers_selected` rows so the public listing doesn't grow unbounded?
3. Phase C report flagged "user-scoped data publicly" — confirmed non-issue here, but worth verifying with product owner that exposing `commission_rate` publicly is intentional (some networks treat that as confidential).
