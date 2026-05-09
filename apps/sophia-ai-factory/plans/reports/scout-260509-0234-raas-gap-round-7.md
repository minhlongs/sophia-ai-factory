# Sophia RaaS Dashboard — GAP Scout Round 7

**Date:** 2026-05-09 02:34
**Branch:** main @ `27e3568d`
**Scope:** Un-scouted surfaces (telegram, inngest, email, rate-limit, CSP, webhook signing, /status, agents/analytics/sop pages, version/health endpoints, admin users)
**Verified:** prod via curl https://sophia.agencyos.network

---

## TOP 8 GAPs (P0/P1 only, ranked by severity × ease)

### F-1 [P0] Inngest crons NOT registered → never run
- **Loc:** `src/app/api/inngest/route.ts:23-46` vs `src/forest/inngest/functions/index.ts:21,30`
- **Evidence:** route.ts registers 14+2=16 funcs (matches prod `function_count:16`). But `offerSyncCron` (hourly affiliate offer sync) and `storageTrackerDaily` (R2 storage usage) are EXPORTED in index.ts BUT NOT imported/registered in route.ts. → never trigger.
- **Curl:** `curl -s https://sophia.agencyos.network/api/inngest` → `{"function_count":16}` (should be 18)
- **Impact:** Affiliate offer catalog stale forever; storage quota never tracked → unbilled overuse.
- **Fix:** Add `offerSyncCron, storageTrackerDaily` to imports + functions array in `src/app/api/inngest/route.ts`.
- **Effort:** XS

### F-2 [P0] Outbound webhooks vulnerable to replay attack
- **Loc:** `src/lib/webhooks/sender.ts:44-52`
- **Evidence:** Headers set: `X-Sophia-Signature`, `X-Sophia-Event`, `X-Sophia-Delivery`. NO `X-Sophia-Timestamp`. Signature signs body only. Receivers cannot reject replays. (Stripe/GitHub include `t=` in HMAC.)
- **Fix:** Add timestamp header + include in HMAC payload (`{timestamp}.{body}` like Stripe). Update verifier docs at `/dashboard/integrations/webhooks/docs`.
- **Effort:** S

### F-3 [P0] 33/34 v1 API routes lack rate-limit-wrapper
- **Loc:** `src/app/api/v1/**/route.ts` (only `usage/route.ts` wrapped)
- **Evidence:** `grep rate-limit-wrapper` in v1/ returns 1 file. Routes including `agent-chat`, `missions`, `factory/url-to-revenue`, `webhooks`, `tracking/links`, `api-keys`, `credits` all unprotected.
- **Impact:** API key abuse → token cost runaway, esp. `agent-chat` (LLM passthrough) + `factory/url-to-revenue` (video gen).
- **Fix:** Wrap each v1 route w/ tier-aware `rate-limit-wrapper`. Tier limits already in `forest/middleware/rate-limit-tiers.ts`.
- **Effort:** M

### F-4 [P1] Public /status page hardcoded English
- **Loc:** `src/app/[locale]/status/page.tsx:44,53,75,90`
- **Evidence:** Strings: "Sophia AI Factory Status", "All Systems Operational", "Degraded Performance", "90-day uptime", "Past Incidents", "Started <date>". `Intl.DateTimeFormat('en-US', ...)` ignores locale param.
- **Curl:** `curl -s https://sophia.agencyos.network/vi/status` → returns same EN strings.
- **Fix:** Pass `params.locale` → `await getTranslations('status')`. Add `status.title`, `status.operational`, etc. to `messages/vi.json`+`en.json`. Use locale-aware Intl.
- **Effort:** S

### F-5 [P1] /dashboard/agents page missing
- **Loc:** N/A (no `src/app/[locale]/dashboard/agents/page.tsx`)
- **Evidence:** `Glob src/app/[locale]/dashboard/agents/**` → no files. But `/api/agents/{task,pause,feedback}/route.ts` exist + `AgentTeamPanel` referenced in Wave 3.
- **Curl:** `curl -sI https://sophia.agencyos.network/dashboard/agents` → 307 → /login (middleware-handled, but page is 404 after auth).
- **Fix:** Create page consuming existing `/api/agents/*` endpoints. Or remove agent endpoints/UI references.
- **Effort:** M

### F-6 [P1] /api/sops returns 404 — SOP marketplace install via server actions only
- **Loc:** No `src/app/api/sops/route.ts` (404 verified)
- **Evidence:** `curl -sI https://sophia.agencyos.network/api/sops` → 404. Marketplace page (`dashboard/sop-marketplace/page.tsx:13`) uses `installSopAction` server action only. No public REST endpoint for v1 API consumers to list/install SOPs programmatically.
- **Impact:** Tier feature "SOP Marketplace API access" promised in pricing-page is undeliverable for ENTERPRISE/MASTER.
- **Fix:** Add `GET /api/v1/sops` (list templates) + `POST /api/v1/sops/:id/install` wrapping repo functions.
- **Effort:** S

### F-7 [P1] /api/admin/users missing — admin tier promotion has no endpoint
- **Loc:** N/A (only `tenants/[id]/quota`, no `users/[id]/tier`)
- **Evidence:** `ls src/app/api/admin/` → no `users/` dir. Wave 4 admin tier promotion shipped UI but admin must `wrangler d1 execute UPDATE` manually for tier changes outside tenants table.
- **Fix:** Add `PATCH /api/admin/users/[id]` accepting `{tier, role}`, RBAC-guarded by `isAdminAuthorized`.
- **Effort:** S

### F-8 [P1] CSP missing report-uri + connect-src for Inngest/Resend
- **Loc:** `src/seed/security/content-security-policy-configuration.ts:38-51`
- **Evidence:** `connectSrc` includes `api.inngest.com` BUT also missing `api.resend.com` (server-side ok, but `/api/inngest` is publicly hit by Inngest cloud during sync — if browser ever embeds, blocked). No `report-uri` directive → silent CSP violations untrackable.
- **Fix:** Add `report-uri /api/csp-report` (route doesn't exist — also create it logging to D1). Add `worker-src 'self' blob:` for OpenNext worker chunks.
- **Effort:** S

---

## State of Dashboard (1 paragraph)

Sophia RaaS dashboard at `27e3568d` is **functionally complete for paid tier flows** (auth, billing, NOWPayments IPN, telegram bot, missions, sop-marketplace UI, video pipeline) with strong foundations (CSRF double-submit, nonce-based CSP, MFA gate, timing-safe metrics auth, signed outbound webhooks, bilingual emails, public /status page, /api/version SHA verification). However, round-7 scout reveals **two operational silent-failure bugs** (F-1: 2 cron functions defined-but-not-registered → affiliate offer staleness + storage untracked; F-2: webhook replay vector missing timestamp), **one massive surface gap** (F-3: 33/34 v1 routes unprotected by rate-limit-wrapper → LLM cost-bomb risk via `agent-chat` + `factory/url-to-revenue`), and **three product-gap pages/endpoints** (F-5: /dashboard/agents 404; F-6: /api/sops 404 breaks promised "API SOP install" tier feature; F-7: no admin user-tier endpoint forces manual D1 writes). F-4 and F-8 are polish items (status page i18n, CSP reporting). Inngest signing key + event key configured (`has_signing_key:true`). Telegram webhook properly secret-gated, pairing flow solid. Recommend immediate F-1 + F-2 + F-3 (P0 batch, ~6h total) before next deploy.

## Unresolved Questions

- F-3 effort estimate assumes existing rate-limit-tiers covers all v1 routes — if some need custom limits (e.g. `agent-chat` per-token), bump to L.
- F-5: is /dashboard/agents intentionally hidden (Wave 4 AgentTeamPanel uses inline panel)? Confirm w/ product before building.
- F-6: was `/api/sops` removed when marketplace shifted to server actions? Check git log for deliberate decision.
- CSP `connect-src` may need additions for Better Stack telemetry endpoint — not verified in this round.
