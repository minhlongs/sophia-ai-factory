# API Endpoint Audit — sophia.agencyos.network
**Date:** 2026-03-26 | **Tester:** billwill.mentor@gmail.com
**User ID:** 0f349b42-0aa9-4a20-947c-7cb8d4d738b2
**Org ID:** dc70471e-a2b9-47a0-bb6d-9c70b76bbc2e (owner, balance: 25,000 MCU)

---

## Executive Summary

6/8 endpoints fail. Root causes: 2 distinct bugs — (1) `affiliate_programs` table schema mismatch (missing `is_active`, `score`, `niche`, `signup_url`, `description`, `commission_rate` as TEXT), (2) no org record found for user in RaaS missions/templates/usage (missions table has only `org_test_001` data, not the real org).

---

## Endpoint Results

| # | Endpoint | Method | Status | Result |
|---|----------|--------|--------|--------|
| 1 | `/api/affiliate/programs` | GET | **500** | Schema mismatch — code queries `is_active`, `score`, `niche` columns that don't exist in D1 |
| 2 | `/api/affiliate/programs` | POST | **405** | No POST handler in route.ts — intentional (add via `/scrape` instead) |
| 3 | `/api/affiliate/content` | GET | **500** | D1 query fails — `affiliate_content` table likely empty + possible missing `idempotency_key` column |
| 4 | `/api/affiliate/content/generate` | POST | **400** | Auth passed, validation works correctly — requires `programId` + `contentTypes[]` array |
| 5 | `/api/affiliate/clicks/stats` | GET | **500** | D1 query fails on `affiliate_clicks` — needs investigation |
| 6 | `/api/raas/missions` | GET | **500** | `getOrgId()` returns null — user's org `dc70471e-...` has no missions; D1 query throws on empty result |
| 7 | `/api/raas/templates` | GET | **500** | Auth passes but `getUser()` → D1 lookup fails — `createAuthClient()` can't resolve D1 binding during auth verify |
| 8 | `/api/raas/usage` | GET | **500** | Same auth chain failure as #6/#7 |

---

## Root Cause Analysis

### Bug 1: `affiliate_programs` schema mismatch (CRITICAL)
**Endpoint:** GET /api/affiliate/programs (500)

Code in `app/api/affiliate/programs/route.ts` queries:
```
.eq('is_active', isActive)
.gte('score', ...)
.eq('niche', niche)   // optional filter
```

D1 production table `affiliate_programs` actual columns:
```
id, org_id, name, url, commission_rate (REAL), status, metadata, created_at, updated_at
```

Missing columns: `is_active`, `score`, `niche`, `description`, `signup_url`
Table is also **empty** (0 rows) — no seed data.

**Fix needed:** Migration to add missing columns OR update route to query existing `status` column instead of `is_active`.

---

### Bug 2: RaaS endpoints — D1 binding unreachable during `createAuthClient()` (CRITICAL)
**Endpoints:** GET /api/raas/missions, /templates, /usage (all 500)

`createAuthClient(token)` in `lib/db/client.ts` calls `getD1Async()` to verify JWT against `users` table. When this D1 binding resolution fails, `getUser()` throws → caught → returns 500 "Failed to fetch X".

Evidence: Missions endpoint returns `{"error":"Failed to fetch missions"}` not `{"error":"Unauthorized"}`, meaning it gets past token parse but fails at `createServerClient()` DB call (getOrgId step). User's org exists but missions table only has `org_test_001` data.

Two sub-issues:
- `getOrgId()` works (org membership confirmed in D1) but `createServerClient()` throws intermittently
- `missions` table has no data for org `dc70471e-...` → throws on empty query result

---

### Bug 3: `affiliate_content` / `affiliate_clicks` — x-org-id auth pattern inconsistency
**Endpoints:** GET /api/affiliate/content, /clicks/stats (500)

These routes use `x-org-id` header (no JWT auth), relying on caller to supply org ID. Header sent correctly but D1 queries fail — likely missing columns (`idempotency_key` in `affiliate_content`, `org_id` in `affiliate_clicks`).

---

### Note: POST /api/affiliate/programs = 405 (by design)
Route file only exports `GET`. Add programs via `/api/affiliate/programs/scrape` (POST). This is intentional per code comments.

---

## D1 Production State

| Table | Row Count | Notes |
|-------|-----------|-------|
| `affiliate_programs` | 0 | Empty + schema mismatch |
| `affiliate_content` | unknown | 500 on query |
| `affiliate_clicks` | unknown | 500 on query |
| `missions` | 2 | Both `org_test_001` — not user's org |
| `mission_templates` | 17 | Present |
| `org_balances` | 1 | 25,000 MCU for real org |
| `org_members` | 1 | User is owner of `dc70471e-...` |
| `usage_logs` | 0 | Empty |

---

## Recommendations (Priority Order)

### P0 — Schema migration for `affiliate_programs`
Add missing columns to match code expectations:
```sql
ALTER TABLE affiliate_programs ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;
ALTER TABLE affiliate_programs ADD COLUMN score INTEGER NOT NULL DEFAULT 0;
ALTER TABLE affiliate_programs ADD COLUMN niche TEXT;
ALTER TABLE affiliate_programs ADD COLUMN description TEXT;
ALTER TABLE affiliate_programs ADD COLUMN signup_url TEXT;
```
Then seed with test data or fix code to query `status` column.

### P0 — Fix affiliate_content / affiliate_clicks schema
Run `PRAGMA table_info(affiliate_content)` and `PRAGMA table_info(affiliate_clicks)` to identify missing columns. Apply migrations `0006-schema-alignment.sql` if not yet applied.

### P1 — RaaS endpoints: verify D1 binding availability
Add error logging in `createAuthClient()` to surface D1 binding errors distinctly from auth errors. Current catch-all masks root cause.

### P1 — Seed missions for real org
Either add test missions for `dc70471e-a2b9-47a0-bb6d-9c70b76bbc2e` or verify `getOrgId()` doesn't throw on empty `missions` result (it shouldn't, but query chain error in D1Client may bubble up).

### P2 — POST /api/affiliate/programs
If needed, add POST handler to route.ts. Currently 405.

---

## Unresolved Questions

1. Why does `affiliate_content` and `affiliate_clicks` return 500 even when `x-org-id` is valid? Need `PRAGMA table_info` on both tables in production.
2. Is the D1 binding intermittently unavailable in CF Workers, or always failing for specific request paths?
3. Are migrations `0005-mission-steps.sql` through `0009-blog-posts-seo.sql` applied to production D1? The `d1_migrations` table exists but contents not checked.
4. `affiliate_programs.commission_rate` is `REAL` in D1 but code treats it as string (`commission_rate` in type). Type mismatch may cause serialization bugs.
