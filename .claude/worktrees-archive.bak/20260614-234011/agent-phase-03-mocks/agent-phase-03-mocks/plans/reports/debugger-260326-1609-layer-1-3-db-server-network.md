# Sophia AI Factory — Infrastructure Audit: Layers 1–3
**Date:** 2026-03-26
**Auditor:** debugger subagent
**Stack:** Next.js 15.5 + opennextjs-cloudflare + Cloudflare Workers + D1 SQLite
**Production:** https://sophia.agencyos.network

---

## Layer 1: Database (D1) — 6/10

### Schema & Tables
- [x] 40 tables present — comprehensive domain coverage (missions, proposals, billing, RaaS API, referrals, onboarding, CRM, affiliate)
- [x] 23 indexes defined on high-traffic columns (org_id, status, created_at, key_hash, etc.)
- [x] `d1_migrations` tracking table exists
- [x] users table has correct columns: id, email, password_hash, role, email_verified, magic_link_token, jwt fields

### Migrations
- [ ] **CRITICAL GAP: 3 unapplied migrations** — d1_migrations shows only 0005 and 0006 applied; files 0007-leads-table.sql, 0008-blog-posts.sql, 0009-blog-posts-seo.sql exist but are NOT recorded in d1_migrations
  - `leads` table IS present in DB (0007 was run manually, bypassing migration tracker)
  - `blog_posts` table is NOT present (0008/0009 never applied at all)
  - This means blog feature code will throw errors at runtime
- [ ] Migrations start at 0005 — migrations 0001–0004 are missing from the repo (historical gap)
- [ ] No migration timestamps in filenames (e.g., `0007_20260301_leads.sql`) — harder to audit order

### Auth / RLS Equivalent
- [x] D1 has no native RLS; auth enforced at API layer via JWT (PBKDF2)
- [x] middleware.ts correctly derives org_id from verified JWT (not from headers) — security fix present
- [x] protectedApiRoutes list covers `/api/org`, `/api/billing`, `/api/onboarding`, `/api/admin`
- [ ] `/api/proposals/` and `/api/video/` only check MCU balance when `hasAuthCookie`; unauthenticated requests fall through to `NextResponse.next()` for non-protectedApiRoutes — verify these routes do their own auth check

### Backup / DR
- [x] Cloudflare D1 provides automatic daily backups (platform-level)
- [ ] No off-site backup configuration documented
- [ ] No DR runbook / RTO-RPO defined
- [ ] DB size: 487 KB — small, backup is trivial but undocumented

### Stats
- Users: 7 (dev/test accounts)

---

## Layer 2: Server (CF Workers) — 7/10

### Build & Config
- [x] wrangler.toml correctly configured: D1 binding `DB`, R2 cache bucket, self-reference service, cron triggers
- [x] `compatibility_date = "2026-03-17"` — current
- [x] `nodejs_compat` + `global_fetch_strictly_public` flags set
- [x] Cron trigger `*/5 * * * *` (every 5 min) for scheduled tasks
- [x] No secrets hardcoded in wrangler.toml — JWT_SECRET set via CF dashboard (env var)
- [ ] **Wrangler version outdated:** v3.114.17 installed, v4.77.0 available — may hit known bugs
- [ ] Build output: server-functions/default is 45 MB — large for CF Workers (limit is 10 MB compressed). Needs verification at deploy time; opennextjs-cloudflare chunking may handle this

### Middleware / Auth Guards
- [x] middleware.ts handles all routes via matcher
- [x] JWT_SECRET absence handled gracefully (503 for API, redirect to /status for pages)
- [x] MCU balance check on billable routes (`/api/proposals/`, `/api/video/`)
- [x] Auth cookie check before org lookup — correct flow
- [ ] `console.error` in middleware (line 132) — production noise; should be structured logging
- [ ] `/api/v1/` is in publicRoutes — entire v1 API is unauthenticated by default; relies on individual route handlers to enforce API key auth (acceptable for RaaS but risky if any route forgets)

### API Routes
- [x] 19 API route directories: admin, affiliate, analytics, auth, billing, crm, cron, feedback, health, onboarding, org, proposals, raas, referral, templates, usage, v1, video, webhooks
- [x] `/api/health` endpoint exists (public)
- [ ] No response time monitoring or APM configured
- [ ] ESLint disabled during builds (`ignoreDuringBuilds: true`) — type errors may be silently skipped

### Performance
- [x] R2 cache bucket configured for opennextjs incremental cache
- [x] `cache-control: s-maxage=31536000` on static assets (verified in prod headers)
- [ ] `images.unoptimized: true` — no image optimization (expected for CF Workers limitation)

---

## Layer 3: Networking — 8/10

### SSL / TLS
- [x] HTTPS enforced, HTTP/2 active
- [x] SSL cert valid: issued by Google Trust Services (WE1), expires 2026-06-24
- [x] Auto-renewal managed by Cloudflare (Let's Encrypt via Google)
- [x] `alt-svc: h3=":443"` — HTTP/3 (QUIC) enabled

### Security Headers (from live production)
- [x] `x-frame-options: DENY` — clickjacking protection
- [x] `x-content-type-options: nosniff` — MIME sniffing protection
- [x] `referrer-policy: strict-origin-when-cross-origin` — referrer controlled
- [ ] **MISSING: `strict-transport-security` (HSTS)** — not present in response headers. Without HSTS, browsers may attempt HTTP first on repeat visits. Fix: add `Strict-Transport-Security: max-age=31536000; includeSubDomains` in next.config.js headers
- [ ] **MISSING: Content-Security-Policy (CSP)** — no CSP header. XSS risk without CSP
- [ ] **MISSING: Permissions-Policy** — no feature policy header

### CORS
- [x] CORS only on `/api/v1/:path*` (RaaS public API) — correct scope
- [ ] `Access-Control-Allow-Origin: *` on `/api/v1/` — wildcard is appropriate for RaaS but document intentionally

### DNS
- [x] `sophia.agencyos.network` resolves correctly
- [x] Cloudflare proxied (cf-ray header present, served from HKG edge)
- [ ] Email DNS (SPF/DKIM/DMARC) not audited — out of scope for this check but should be verified for outreach features

### Response
- [x] HTTP 200 on production
- [x] `server: cloudflare` — DDoS protection inherited
- [x] `nel` + `report-to` headers present — Cloudflare Network Error Logging active

---

## Summary Scores

| Layer | Score | Top Issue |
|-------|-------|-----------|
| Database | 6/10 | 3 unapplied migrations (blog_posts table missing) |
| Server | 7/10 | Wrangler v3 outdated; 45MB bundle needs verification |
| Networking | 8/10 | HSTS and CSP headers missing |
| **Total** | **21/30** | |

---

## Critical Fixes Before Handover

1. **Apply migrations 0007–0009** (immediate)
   ```bash
   cd apps/sophia-proposal
   npx wrangler d1 execute sophia-raas-db --remote --file=migrations/0007-leads-table.sql
   npx wrangler d1 execute sophia-raas-db --remote --file=migrations/0008-blog-posts.sql
   npx wrangler d1 execute sophia-raas-db --remote --file=migrations/0009-blog-posts-seo.sql
   ```
   Note: 0007 was applied manually — running again may fail with "table already exists"; wrap in `CREATE TABLE IF NOT EXISTS` or skip with `--command` check first.

2. **Add HSTS header** in `next.config.js`:
   ```js
   { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' }
   ```

3. **Upgrade wrangler** to v4:
   ```bash
   npm install --save-dev wrangler@4
   ```

4. **Add basic CSP header** for XSS protection.

---

## Unresolved Questions

1. Was migration 0007 applied via wrangler CLI directly (bypassing d1_migrations tracking)? Need to confirm `leads` table schema matches 0007-leads-table.sql exactly.
2. Blog feature (`/blog` route) — is it used by the client? If yes, 0008/0009 are blocking.
3. CF Worker bundle 45 MB uncompressed — what is the actual compressed deploy size? Need `wrangler deploy --dry-run` output to confirm within 10 MB limit.
4. `/api/proposals/` and `/api/video/` routes — do individual route handlers enforce auth, or do they rely solely on middleware MCU balance check?
5. Email DNS (SPF/DKIM/DMARC) for `agencyos.network` — required for Sophia email outreach feature reliability.
6. No error monitoring (Sentry/etc.) detected — is this intentional? Production errors invisible without it.
