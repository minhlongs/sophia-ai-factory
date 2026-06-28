# Affiliate Catalog Refactor — Code Review

**Reviewer:** code-reviewer
**Date:** 2026-04-29
**Scope:** 5 files (2 migrations + route + tests + page)
**Verdict:** Score **8.5/10** — APPROVED for deploy. No blockers. Minor follow-ups listed.

---

## 1. Sanity Check — PII / Security

**No PII leaked.** Catalog table is pure marketing metadata (offer_name, network, url, commission_rate, category, description). Zero FK to users/campaigns. SELECT projection in route + page lists exact columns — `is_active` and any future internal fields stay server-side.

Security positives:
- `rel="noopener noreferrer sponsored"` on outbound anchors — prevents reverse-tabnabbing + complies with FTC/Google sponsored-link guidelines.
- `target="_blank"` paired with `noopener` — correct.
- Rate limit 60 req/min/IP via `withRateLimit` — appropriate for public endpoint.
- Zod input validation with min/max bounds — page>=1, limit 1..100. Coercion handles string params from URL.
- `is_active=1` filter applied in BOTH the row query and count query — consistent. Test asserts this.
- DB error caught + only message string returned — no stack trace leak.

**Minor concerns:**
- URLs are stored as TEXT with no scheme validation in DB. If a future seed accidentally inserts `javascript:` URL, the anchor would still render. **Recommendation:** add `CHECK (url LIKE 'https://%')` to the table or sanitize at write-time. Not a blocker because all current 10 seeds are HTTPS and writes are migration-only.
- `description` is rendered with `{offer.description}` (React auto-escapes) — safe from XSS. Good.

## 2. Schema Design

**Indexes are reasonable for current scale (10 rows, expected <1k):**
- `idx_catalog_active_created (is_active, created_at DESC)` — composite matches the route's WHERE+ORDER BY exactly. Excellent.
- `idx_catalog_network` and `idx_catalog_category` — pre-emptive for future filter UI. Cheap on D1, fine.

**Constraints — small gaps:**
- No `UNIQUE` on `(offer_name, network)` or `url` — re-running seed with same data would dedupe by `INSERT OR IGNORE` only on PK, but PK is random hex so no collision = duplicates possible if seed re-applied. **Recommendation:** add `UNIQUE(network, url)` constraint OR change seed to deterministic IDs. Low risk because migrations run once.
- `commission_rate REAL` allows negative values. Add `CHECK (commission_rate IS NULL OR commission_rate >= 0)`.
- `is_active` lacks `CHECK (is_active IN (0,1))` — D1/SQLite would accept 2, 99, etc. Cheap to add.
- No `updated_at` column — if the catalog ever supports edits, you'll want it. Not needed yet.

## 3. Code Quality

**Route (`route.ts`):**
- Clean. Zod-first, explicit projection, parallel `Promise.all` for data + count — good.
- `as unknown as AffiliateOffer[]` double-cast is a code smell but acceptable given the D1 client returns `unknown`. Acceptable.
- `rowsResult.error` is not checked — if the data query fails but count succeeds, you'd return `{ offers: [], total: N }` silently. **Recommendation:** check `rowsResult.error` and `countResult.error` and 500 if either is set. Not a blocker since `try/catch` will catch thrown errors, but D1 client may return error in result rather than throw.

**Page (`page.tsx`):**
- `fetchOffers` swallows errors with `catch {}` — empty state UI handles this gracefully but you lose observability. **Recommendation:** log via `console.error` minimum (or your structured logger) so prod issues surface.
- `networkBadge` map is duplicated knowledge with the SQL `CHECK` enum — consider extracting to a shared `affiliate-networks.ts` constants file. Minor DRY.
- Anchor card is fully clickable — good UX. `group-hover` works correctly.
- Empty-state CTA pushes /pricing — strong funnel hook. Bilingual (VI primary + EN fallback line) per `sophia-handover-rules.md`. Good.

**Tests (`route.test.ts`):**
- 6 tests cover: empty, populated, is_active filter, pagination offset, limit>100 reject, page=0 reject. Solid coverage.
- `makeChain` uses round-robin via `callCount % 2` to alternate row vs count chain — fragile if `from()` is called >2 times. Works for current code. Acceptable.
- Missing test cases (nice-to-have, not blockers):
  - 500 response when DB throws.
  - Default pagination behavior (no params).
  - `range(0, 49)` assertion for `limit=50` default.

## 4. Network Mapping & Formatting

- `formatCommission(null)` returns `—` — handles NULL properly.
- Network shorthand badges (CB/SAS/AMZ/IMP/CJ/M) consistent with major affiliate ecosystem norms.
- Tailwind classes follow project style — gradient header, glass card pattern. Visual consistency maintained.

## 5. Verification Echo

- TypeScript: 0 errors ✅
- Tests: 6/6 route tests pass, 1715/1746 suite ✅
- Build: success ✅
- D1 remote: 10 active rows confirmed ✅

## Score Breakdown

| Area              | Score  | Notes                                   |
| ----------------- | ------ | --------------------------------------- |
| Security/PII      | 9/10   | No leaks. URL scheme check missing.     |
| Schema            | 8/10   | Indexes great. UNIQUE + CHECKs missing. |
| Route logic       | 8/10   | Clean. result.error unchecked.          |
| Page UX           | 9/10   | Anchor + sponsored rel correct.         |
| Tests             | 8/10   | Core paths covered. Edge gaps.          |
| **Total**         | **8.5/10** | **Production-ready**                |

## Blockers

**None.** Ship it.

## Recommended Follow-Ups (post-deploy)

1. Add `CHECK (url LIKE 'https://%')` + `UNIQUE(network, url)` in migration 0033.
2. Replace `catch {}` in `page.tsx` with logged error path.
3. Add `rowsResult.error` / `countResult.error` checks in route.
4. Extract network badge map + label list to shared constants (DRY with SQL CHECK).
5. Add `updated_at` column when first edit-flow lands.

## Unresolved Questions

- Should the public route include filter params (`network`, `category`)? Indexes are already in place — trivial follow-up if PM wants it.
- Seed re-apply policy: is `INSERT OR IGNORE` enough, or do we want a migration that diffs against current rows? Decide before adding new offers.
