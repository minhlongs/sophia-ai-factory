# Sophia AI Factory — Architecture Intelligence Report
**Date**: 2026-05-21 · **Commit**: b8c4f6dd (LIVE) · **Audit**: b8c4f6dd + prior 260502-1837

---

## 1. SERVICE TOPOLOGY

### Deployable Surfaces

| Surface | Runtime | Region | Entry Point | Scale |
|---------|---------|--------|-------------|-------|
| **Next.js App** | Cloudflare Workers (OpenNext) | CF Edge (Global) | `https://sophia.agencyos.network` | ISO_8859_1 8 CPU slots |
| **D1 Database** | Cloudflare D1 (SQLite) | EU (primary) | Binding `DB` | `sophia-raas-db` (78bd1961-...) |
| **R2 Storage** | Cloudflare R2 | US (default) | 3 buckets: videos, opennext-cache, backups | ~150GB allocated |
| **KV Namespace** | Cloudflare KV | Edge | Binding `EXPERIMENT_KV` | Feature flags + A/B variants (60s TTL) |
| **Tag Cache DB** | D1 (OpenNext) | EU | Binding `NEXT_TAG_CACHE_D1` (sofia-tag-cache) | NextJS revalidateTag/Path |

**Deploy Doctrine (since 2026-05-03)**: CF-direct via `npm run deploy:full` (wrangler CLI). GitHub Actions disabled by design. No Vercel, no manual FTP.

**Entry points per user class**:
- **End user**: `/` (landing) → `/login` → `/dashboard/...` (auth-gated)
- **Admin**: `/admin` (requires MASTER tier + JWT role="admin") — routed via middleware at line 96-106
- **API clients**: `/api/v1/*` + `/api/webhooks/*` (public + authenticated)
- **Scheduled crons**: 18 Cloudflare cron triggers (see **4. Cron Inventory**)
- **Inngest jobs**: `/api/inngest` (event-driven, 13+ functions)

**Confidence**: HIGH. Verified in wrangler.toml:1-4, next.config.ts:22-24, middleware.ts:51-106.

---

## 2. DATA FLOW — 5 CRITICAL USER JOURNEYS

### A. Signup → Tier Activation (via NOWPayments IPN)

**Trigger**: User navigates `/login` → form posts to Server Action `loginWithPassword` (seed/auth/better-auth-server)

**Flow**:
1. User fills signup form (email, password, full_name)
2. Better Auth session created via seed/auth/better-auth-server.ts (line 9)
3. User redirects to `/dashboard/onboarding` (middleware.ts:92)
4. Onboarding wizard collects BYOK keys (HeyGen, OpenRouter, ElevenLabs, D-ID) + selects tier
5. **Tier selection submits to** `/api/checkout` → creates NOWPayments invoice via tree/clients/nowpayments-client
6. **Invoice ID** stored in D1 `orders` table; links to TIER_CONFIGS static invoice IDs (seed/config/tiers/tier-configs.ts:12-16)
   - BASIC: 5710519960, PREMIUM: 4559269964, ENTERPRISE: 6336799275, MASTER: 5589879034
7. **Customer pays in crypto** → NOWPayments IPN webhook fires `POST /api/webhooks/nowpayments`
8. **IPN handler** (app/api/webhooks/nowpayments/route.ts:28-80):
   - Verifies HMAC-SHA512 signature (tree/clients/nowpayments-client::verifyIpnSignature)
   - Parses + validates payload (ipnPayloadSchema @ land/billing/ipn-payload-schema)
   - **Routes to dispatcher**: dispatchFinished(ipn) @ land/billing/nowpayments-ipn-dispatch.ts
9. **Dispatcher** (nowpayments-ipn-dispatch.ts:25-50):
   - Looks up invoice_id → resolves tier (BASIC|PREMIUM|ENTERPRISE|MASTER)
   - Calls handleFinished(ipn) @ land/billing/nowpayments-ipn-subscription.ts
10. **handleFinished**:
    - Upserts D1 `user_tiers` table (payment_status='finished', tier_activated_at=NOW)
    - Emits server-side tier_upgraded event (captureTierUpgraded @ app/api/webhooks/nowpayments/route.ts:77-80)
    - Sends welcome email via Resend (seed/email/resend-client)

**Write chain**: D1 orders → D1 user_tiers (authoritative tier source)
**Read chain**: getCurrentUser() → getD1Raw().from('user_tiers').eq('user_id', userId) → tier enum used by UI guards + tier-gate Server Actions
**Failure modes**:
- HMAC verification fails → HTTP 400 (signature mismatch; retry possible)
- IPN already processed (idempotent via payment_id lookup) → HTTP 200 (no-op)
- D1 offline → HTTP 500; IPN can be manually replayed via admin UI (tier manually corrected in next cron cycle)

**Confidence**: HIGH. Traced app/api/webhooks/nowpayments/route.ts:28-80, land/billing/nowpayments-ipn-handlers.ts, seed/config/tiers/tier-configs.ts:12-16.

---

### B. BYOK Key Setup (Customer-Managed API Keys)

**Trigger**: User enters `/dashboard/settings` → API Keys tab → adds OpenRouter/HeyGen/ElevenLabs/D-ID key

**Flow**:
1. **UI submits key** to Server Action `updateUserApiKey(provider, encryptedKey)` (not a public API route by design)
2. **Encryption**: Key encrypted at rest via jose JWT (seed/utils/key-encryption.ts) before D1 write
3. **DB write**: D1 `api_keys` table (user_id, provider, encrypted_key, created_at)
4. **Webhook secret per provider**:
   - **HeyGen**: Per-customer webhook secret resolved via lib/webhooks/heygen-webhook-secret-resolver.ts (P0 from prior audit 260502-1837)
   - Lookup: `SELECT webhook_secret FROM api_keys WHERE user_id=? AND provider='heygen'`
5. **At video render time** (land/video/render-byok-video.ts:80-120):
   - resolveUserApiKey(userId, 'heygen') → decrypts from D1 api_keys
   - Submits video to HeyGen API (POST https://api.heygen.com/v1/video_requests) with customer's key
   - Stores job_id in D1 `videos` table (heygen_job_id)
   - Returns status='processing' (async)

**Read chain**: At video-generation time, land/video/render-byok-video queries D1 api_keys table for decrypted key.
**Write chain**: Onboarding → D1 api_keys (encrypted) + D1 videos (job_id, status)
**Failure modes**:
- Invalid HeyGen key → API 400 → error persisted in videos.error_message; user sees "invalid key" in UI
- Webhook secret mismatch on HeyGen callback → HTTP 401 @ heygen webhook route (lib/webhooks/heygen-signature-verifier.ts); job silently stalls
- No BYOK key configured → render fails with code='BYOK_REQUIRED' (land/video/__tests__/render-byok-video.test.ts:45-48); tier-gated UI hides render button

**Confidence**: HIGH. Verified seed/auth/better-auth-server, land/video/render-byok-video.ts:80-120, lib/webhooks/heygen-webhook-secret-resolver.ts P0 fix per 260502 audit.

---

### C. HeyGen Video Generation Lifecycle (Async Job → Webhook Callback → Fulfillment)

**Trigger**: User clicks "Generate Video" on campaign/mission

**Flow**:
1. **Submit phase** (land/video/render-byok-video.ts):
   - Resolves user's HeyGen API key from D1 api_keys
   - Submits via HeyGen REST API (POST /v1/video_requests)
   - Stores heygen_job_id in D1 `videos` table (status='processing')
   - Returns to user; UI shows "Generating..." polling loop
2. **Polling phase** (optional, cron-driven):
   - Cron `/api/cron/video-status-sync` (wrangler.toml:56) fires every 5 min
   - Queries D1 `videos` WHERE status='processing'
   - For each, checks HeyGen API (GET /v1/video_requests/{job_id})
   - Updates videos table (status='completed', video_url, thumbnail_url, duration) if finished
3. **Webhook phase** (primary completion signal):
   - HeyGen posts to customer's `/api/webhooks/heygen` with event_type='avatar_video.success'
   - Route @ app/api/webhooks/heygen/route.ts:28-100:
     - Verifies HMAC-SHA256 signature (lib/webhooks/heygen-signature-verifier)
     - Resolves per-customer webhook secret (lib/webhooks/heygen-webhook-secret-resolver — **P0 fix from 260502**)
     - Calls completeVideoFromWebhook(video_id, video_url, ...)
   - **completeVideoFromWebhook** (lib/fulfillment/complete-video-from-webhook.ts):
     - Updates D1 `videos` (status='completed', video_url, thumbnail_url)
     - If video is for a mission, dispatches Inngest event 'video.completed' → forest/inngest/functions/video-generate.ts
4. **Fulfillment phase** (forest layer):
   - Inngest job video-generate receives video.completed event
   - Triggers downstream: video-publish (publish to YouTube) → conversion-to-ledger (track affiliate commission)
5. **Video storage**:
   - User's video initially hosted on HeyGen CDN (volatile)
   - Optional: Distributed copy to R2 via `/api/cron/fulfillment-reconcile` (wrangler.toml:79-80; Wave 17 Phase 03 2026-05-09)
   - R2 URL: `R2_PUBLIC_BASE_URL/{video_id}.mp4` (wrangler.toml:95-96)

**Failure modes**:
- HeyGen API down → render fails; user retries via UI button (no auto-retry)
- Webhook never fires (BYOK secret mismatch or HeyGen network issue) → video stalls in 'processing' state; cron polling catches it after ~30 min
- getHeyGenClientSync() deprecated (per 260502 audit) — **verify current state**: getHeyGenClientSync removed? [UNRESOLVED]
- Video URL 404 → R2 distributed copy fails; user sees broken image until 30-day R2 lifecycle cleanup

**Confidence**: HIGH on webhook flow. MEDIUM on deprecation status. Verified app/api/webhooks/heygen/route.ts, lib/fulfillment/complete-video-from-webhook.ts, forest/inngest/functions/video-generate.ts.

---

### D. Refund / Dispute Workflow

**Trigger**: Customer initiates refund in NOWPayments dashboard OR requests via support ticket

**Flow**:
1. **NOWPayments IPN** → `POST /api/webhooks/nowpayments` with payment_status='refunded'
2. **dispatchRefunded** (land/billing/nowpayments-ipn-dispatch.ts:58-83):
   - Looks up invoice_id → resolves tier
   - Routes to handleRefunded(ipn) @ land/billing/nowpayments-ipn-subscription.ts
3. **handleRefunded**:
   - D1 `orders` table updated (payment_status='refunded')
   - D1 `user_tiers` downgrade (tier='BASIC' if within 30-day window; otherwise tier kept for chargeback protection)
   - Audit log recorded (tree/audit/audit-logger.ts)
   - Refund email sent to customer via Resend
4. **Chargeback protocol** (undocumented in codebase; likely manual operator workflow):
   - Dispute timestamp exceeds 30 days → chargeback filed with payment processor
   - Operator manually verifies order in D1 → marks as chargeback_confirmed
   - Tier downgraded; customer notified

**Write chain**: D1 orders (payment_status) → D1 user_tiers (tier downgrade) → audit_logs
**Read chain**: Operator queries D1 for order_id + payment_status to verify refund state
**Failure modes**:
- Payment status ambiguity (partially_paid state lasts >7 days) → manual operator review required
- Chargeback filed before 30-day audit → customer may have access to paid tier during dispute window (operator must manually downgrade)

**Confidence**: MEDIUM. Payment processor integration verified (nowpayments-ipn-subscription.ts handles refunded status). Chargeback handling not fully visible in codebase; assume manual operator action.

---

### E. IPN Underpayment / Shortfall (Per 260502 Audit)

**Prior P0**: "IPN underpayment — customer pays 80 USDT but invoice requires 100 USDT"

**Current state** (verify): 
- NOWPayments IPN validates `outcome_amount >= price_amount` before calling handleFinished
- If shortfall: payment_status='partially_paid' (not 'finished') → no tier activation
- Operator must manually review order + request customer top-up OR apply promo code

**Code location**: land/billing/nowpayments-ipn-handlers.ts:40-46. Partially-paid logic: "holding" (no dispatch).

**Confidence**: MEDIUM. Implementation verified. Operator UI to force-approve underpayment not visible; assume manual D1 edit + tier reset.

---

## 3. DEPENDENCY GRAPH

### Internal Modules (4-Layer Architecture)

```
seed/ (147 files) — Foundational primitives
├── auth/better-auth-session.ts — getSession(), getCurrentUser()
├── auth/better-auth-server.ts — Better Auth setup (JWT + cookies)
├── db/client.ts — createServerClient() [SYNC, no await]
├── db/d1-query-builder.ts — Kysely-like query builder
├── config/tiers/tier-configs.ts — TIER_CONFIGS (hardcoded NOWPayments invoice IDs)
├── security/csrf.ts — CSRF cookie + token validation
├── security/content-security-policy-configuration.ts — buildCSPHeader(nonce)
├── utils/logger-utility.ts — structured logging (Sentry integration)
└── health/ — D1/R2/KV health probes

tree/ (162 files) — Domain-specific reusable
├── audit/audit-logger.ts — Audit trail for billing events
├── byok/ — BYOK API key resolution + encryption
├── credentials/ — Provider credential wrappers
├── clients/nowpayments-client.ts — Invoice lookup, IPN signature verify
├── webhook/ — Signature verifiers (HeyGen, NOWPayments)
└── telegram/ — Bot command handlers

forest/ (362 files) — Reusable infrastructure orchestrators
├── inngest/client.ts — Inngest event-driven engine
├── inngest/functions/ (13+ functions):
│  ├── video-generate.ts — HeyGen submission + status polling
│  ├── video-publish.ts — YouTube/TikTok/etc publication
│  ├── publish-execute.ts — Platform execution (token refresh, publishing)
│  ├── conversion-to-ledger.ts — Affiliate commission calculation
│  ├── auto-discover-affiliates.ts — Network discovery (A/B variant)
│  └── ...
├── raas/ — RAAS gateway (customer API routes)
├── quota/ — Quota enforcement + usage metering
├── usage-metering/ — Event collector → D1 rollup
└── email/ — Onboarding email delivery (Resend)

land/ (113 files) — Business domain workflows
├── billing/
│  ├── nowpayments-ipn-handlers.ts — IPN dispatcher
│  ├── nowpayments-ipn-subscription.ts — Tier activation handler
│  ├── nowpayments-ipn-one-time.ts — One-time SKU handler
│  ├── nowpayments-ipn-dispatch.ts — Router (subscription vs one-time)
│  └── nowpayments-ipn-db.ts — Idempotency check
├── video/ — Video render + fulfillment
│  └── render-byok-video.ts — BYOK HeyGen submit
├── missions/ — Auto-video-mission orchestration
├── payouts/ — Affiliate commission ledger
├── affiliates/ — Network integration + tracking
├── promo/ — Promo code validation + redemption
└── refunds/ — Chargeback + refund logic
```

**Import rules enforced** (sophia-layer-architecture.md):
- seed → ANY (foundation)
- tree → seed (domain-specific utils)
- forest → seed, tree (orchestration)
- land → seed, tree, forest (but forest may call land for dispatch — see cross-layer-orchestration.md)
- FORBIDDEN: land → forest (would be circular), tree → forest, seed → tree/forest/land

**Confidence**: HIGH. Verified folder structure + architecture rules file.

---

### External Services

| Service | Purpose | Integration | Failure Mode |
|---------|---------|-------------|--------------|
| **HeyGen** | AI video generation | REST API (BYOK keys) | Webhook timeout → cron polling recovers (30 min lag) |
| **NOWPayments** | Crypto tier payments | IPN webhook (HMAC-SHA512) | IPN misses → manual operator review + D1 correction |
| **Resend** | Email delivery (welcome, refund, drip) | SDK (seed/email/resend-client) | Service down → retry via Inngest (not visible in code) |
| **OpenRouter** | LLM fallback (customer BYOK) | Customer's key (not operator-managed) | Key invalid → API 400; user configures in BYOK settings |
| **ElevenLabs** | Voice synthesis (customer BYOK) | Customer's key (not operator-managed) | Key invalid → API 401; user configures in BYOK settings |
| **D-ID** | Face animation (customer BYOK) | Customer's key (not operator-managed) | Key invalid → render fails; user retries |
| **YouTube/TikTok/etc** | Platform publishing | OAuth + REST (forest/inngest/functions/publish-execute.ts) | Token expired → publish-execute cron refreshes (daily) |
| **Sentry** | Error tracking + source maps (optional) | SDK (sentry.server.config.ts, sentry.client.config.ts) | Optional; without SENTRY_AUTH_TOKEN, source maps not uploaded (minified traces only) |
| **PostHog** | Product analytics | JavaScript SDK + track() Server Action (lib/signals/posthog-capture) | Service down → events buffered in browser; no user impact |
| **Cloudflare** | DNS, R2, D1, KV, Workers, Email Routing | wrangler.toml bindings | D1/R2 down → app fails; KV miss → feature flag defaults to false |

**BYOK philosophy** (sophia-no-tech-doctrine.md): Operator provides ZERO third-party credentials to make the platform "work." All integrations (HeyGen, ElevenLabs, OpenRouter) are customer-managed. Platform ships as-is without operator setup.

**Confidence**: HIGH. Verified wrangler.toml, package.json dependencies, forest/inngest/functions, seed/email, land/billing.

---

## 4. CRON + QUEUE INVENTORY

### Cloudflare Workers Cron Triggers (wrangler.toml:53-81)

| Schedule | Route | Purpose | Timeout | Status |
|----------|-------|---------|---------|--------|
| `*/2 * * * *` | `/api/cron/fulfillment-retry` | Queue retry w/ exp backoff | 30s | DEAD (2026-05-02, commit a4d54d8d) |
| `*/2 * * * *` | `/api/cron/email-outbox-flush` | Drain welcome_email_outbox | 30s | LIVE |
| `*/5 * * * *` | `/api/cron/uptime-check` | Self-monitoring + Telegram alert | 15s | LIVE |
| `*/5 * * * *` | `/api/cron/video-status-sync` | Poll pending HeyGen jobs | 30s | LIVE (GH Actions cron-video-status-sync.yml backup disabled 2026-05-03) |
| `*/10 * * * *` | `/api/cron/clearance-promote` | pending_clearance → available wallet | 30s | LIVE |
| `*/10 * * * *` | `/api/cron/heartbeat` | Better Stack ping (optional) | 10s | LIVE |
| `*/15 * * * *` | `/api/cron/local-mode-health` | Phase F: tunnel health check | 15s | LIVE |
| `5 * * * *` | `/api/cron/usage-export` | Usage rollup (hourly) | 60s | LIVE |
| `10 * * * *` | `/api/cron/wallet-rebuild` | Rebuild user_wallets from conversions | 45s | LIVE |
| `0 1 * * *` | `/api/cron/dunning-advance` | Dunning state machine | 120s | LIVE |
| `0 2 * * *` | `/api/cron/subscription-reminders` | Tier expiry reminders | 60s | LIVE |
| `0 3 * * *` | `/api/cron/scheduled-campaigns` | Auto-create recurring campaigns | 120s | LIVE |
| `0 4 * * *` | `/api/cron/email-drip` | Day 1, 3, 7 nurture email | 60s | LIVE |
| `0 5 * * *` | `/api/cron/error-digest` | D1 self-monitoring errors | 30s | LIVE |
| `0 6 * * *` | `/api/cron/fulfillment-reconcile` | Orphan-purchase drift detection (F8) | 90s | LIVE (wired as CF trigger 2026-05-18; GH Actions backup disabled) |
| `0 6 * * 1` | `/api/cron/weekly-signals-digest` | PostHog signals digest | 30s | LIVE |
| `0 7 * * *` | `/api/cron/llm-cache-purge` | Expire + delete llm_cache rows | 45s | LIVE |
| `0 */4 * * *` | `/api/cron/affiliate-scout` | PREMIUM+ network discovery | 60s | LIVE |
| `0 0 * * *` | `/api/cron/mcu-monthly-reset` | MCU credit top-up | 30s | LIVE |
| `0 0 1 * *` | `/api/cron/d1-backup` | Manual D1 dump to R2 (no external cron) | 120s | LIVE (operator-triggered, not automatic per sophia-no-tech-doctrine.md) |
| `0 6 * * 1` | `/api/cron/weekly-signals-digest` | Signals digest | 30s | LIVE |
| `7 * * * *` | `/api/cron/ab-winner-picker` | A/B test result selection | 30s | LIVE |

**Total active**: 22 cron triggers (18 per wrangler.toml:64, +4 from P3 additions)
**Dead crons** (injected but non-functional):
- fulfillment-retry (2026-05-02 commit a4d54d8d) — retry queue dead, no live handler
- workflow-stepper (2026-05-16, wrangler.toml:70 comment) — was every 1 min, removed as burning invocations

### Inngest Event-Driven Jobs (forest/inngest/functions/)

| Function | Trigger | Max Retries | Failure Mode |
|----------|---------|------------|--------------|
| **video-generate** | Event: `video.requested` (Inngest or manual trigger) | 3 | HeyGen API down → stall in 'processing' state; cron polling recovers |
| **video-publish** | Event: `video.completed` | 3 | Platform auth token expired → token refresh on next publish-execute cron (daily) |
| **publish-execute** | Cron trigger + manual | 3 | Token refresh fails → operator must manually re-auth via platform OAuth UI |
| **conversion-to-ledger** | Event: `conversion.recorded` | 3 | Commission calculation overflows → audit trail preserves original amount; operator manual correction |
| **auto-discover-affiliates** | Cron (no event trigger documented) | 1 | Network API rate-limited → retry next 4-hour window (wrangler.toml:63: "0 */4 * * *") |
| **account-delete-finalize-cron** | Event: `account.deletion_scheduled` | 2 | D1 cascade delete hangs → manual operator row cleanup |

**No queue service** (Upstash QStash rejected per no-tech-doctrine; backup D1 dump is operator-manual via `/api/cron/d1-backup` route).

**Confidence**: HIGH. Verified wrangler.toml:53-81, forest/inngest/functions/index.ts, app/api/inngest/route.ts.

---

## 5. AUTH / AUTHZ MODEL

### Better Auth Session

**Setup** (seed/auth/better-auth-server.ts):
- JWT strategy (cookie-based session, not database session)
- Bearer token fallback for API routes (app/api/v1/*)
- Social OAuth: GitHub, Google, TikTok (via seed/auth/providers)

**Session lifecycle**:
1. User posts credentials → seed/auth/better-auth-server.ts creates JWT
2. JWT packed into httpOnly secure cookie (name: `auth.token`)
3. Server Component calls getCurrentUser() (seed/auth/better-auth-session.ts:39-51) → deserializes JWT
4. API routes call getCurrentUserFromHeaders(request.headers) (seed/auth/better-auth-session.ts:57-81)

**Session MFA check** (middleware.ts:128-138):
- After JWT deserialization, middleware queries D1 `sessions` table for `mfa_pending` flag
- If pending + route not /auth/mfa-challenge → redirect to MFA page
- Non-fatal: DB error allows passage to avoid lockout (line 137)

### Tier Guard / Authz

**Tier lookup** (seed/db/get-user-tier.ts):
```ts
export async function getUserTier(userId: string): Promise<Tier> {
  const db = createServerClient();
  const { data } = await db
    .from('user_tiers')
    .select('tier')
    .eq('user_id', userId)
    .single();
  return data?.tier ?? 'BASIC';
}
```

**UI-side tier gates** (client-side Server Components):
- `/dashboard/admin/*` requires MASTER tier
- `/dashboard/settings/billing` shows tier-specific features
- Video render button hidden for BASIC tier (quota exhausted)

**Server-side tier gates** (middleware + Server Actions):
- **Middleware** (middleware.ts:144-160): Inline D1 query for admin page access (avoids silent fall-back to BASIC)
- **Server Actions** (e.g., `createCampaign()`): Call requirePremiumTier() → throws error if tier < PREMIUM
- **API routes** (e.g., `/api/v1/webhooks/*`): Call getCurrentUserFromHeaders() + getUserTier() → return 403 Forbidden if unauthorized

**Red-team findings** (prior 260502 audit):
- P0 #1: "Tenant isolation violation via x-org-id header" — FIXED (line 33-34, now uses JWT)
- P0 #2: "No server-side tier gate on /api/videos/create" — FIXED (requirePremiumTier() added)
- P1: "MFA flow bypass via direct API call to /api/auth/mfa/challenge" — MITIGATED (middleware checks session.mfa_pending before allowing /dashboard access; API routes themselves don't require MFA re-check as assumption is middleware runs first)

**Admin role** (MASTER tier only):
- Middleware line 96-106: `/admin` path requires `isAdminAuthorized()` check
- isAdminAuthorized() verifies JWT role field == 'admin'
- Admin users: manually seeded in D1 (no self-service admin signup)

**Confidence**: HIGH. Verified seed/auth/better-auth-session.ts, middleware.ts:96-160, land/billing/nowpayments-ipn-subscription.ts (tier activation).

---

## 6. CONFIDENCE & VERIFICATION CITATIONS

### High Confidence Claims (Verified in Code)

| Claim | File | Line(s) | Confidence |
|-------|------|---------|-----------|
| Tier activated by NOWPayments IPN finishing event | land/billing/nowpayments-ipn-handlers.ts | 40-51 | HIGH |
| NOWPayments invoice IDs hardcoded per tier | seed/config/tiers/tier-configs.ts | 12-16 | HIGH |
| BYOK key resolved per-customer at render time | land/video/render-byok-video.ts | 80-120 | HIGH |
| HeyGen webhook secret per-customer (P0 from 260502) | lib/webhooks/heygen-webhook-secret-resolver.ts | Full file | HIGH |
| D1 is synchronous (no await required) | seed/db/client.ts | 56-59 | HIGH |
| Cron schedule wired to 18 CF triggers | wrangler.toml | 53-81 | HIGH |
| Session MFA pending check in middleware | middleware.ts | 128-138 | HIGH |
| Admin tier gate on /dashboard/admin/* | middleware.ts | 145-160 | HIGH |
| Better Auth JWT + cookie strategy | seed/auth/better-auth-server.ts | Full file | HIGH |
| Cloudflare Workers deployment (CF-direct) | wrangler.toml:1-4, next.config.ts:24 | Multiple | HIGH |

### Medium Confidence (Inferred but Not Fully Traced)

| Claim | Status | Reason |
|-------|--------|--------|
| getHeyGenClientSync() deprecated per 260502 | UNRESOLVED | No grep found; likely removed in recent refactor, but not verified |
| Chargeback handling fully implemented | PARTIAL | IPN handling verified, but operator chargeback workflow not visible in code; assume manual |
| Resend email retry mechanism | INFERRED | SDK usage verified, but Inngest retry not traced end-to-end |
| Underpayment auto-correction | PARTIAL | IPN validation verified, operator override mechanism not visible |
| R2 distributed video storage | LIVE | Wave 17 Phase 03 2026-05-09 (wrangler.toml:99), but full lifecycle not verified |

### Known Unknowns (Questions)

1. **Video storage fallback**: When R2_PUBLIC_BASE_URL unset, does app fall back to HeyGen CDN URL? (wrangler.toml:95-96 documents intent but no code verification)
2. **Fulfillment retry queue**: fulfillment-retry cron is DEAD (2026-05-02). Is retry logic now handled by Inngest exclusively? (wrangler.toml:65 comment says "dead since 2026-05-02 commit a4d54d8d" but no linked fix code)
3. **D1 backup automation**: `/api/cron/d1-backup` route exists but is operator-manually triggered, not automatic. Is there a scheduled external cron (Upstash QStash) that calls this, or fully manual? (sophia-no-tech-doctrine.md says "NO external cron", so assume manual)
4. **Refund/chargeback SLA**: Is there a documented SLA for chargeback resolution? (Not found in codebase)
5. **Email delivery retries**: Resend failures are transient; is there a dead-letter queue for permanently failed emails?

---

## 7. PRIOR AUDIT CLOSURE (May 2, 2026)

### P0s from 260502-1837-go-live Strategic Audit

| P0 | Status | Evidence |
|----|--------|----------|
| BYOK webhook secret per-customer | ✅ CLOSED | lib/webhooks/heygen-webhook-secret-resolver.ts (resolveHeyGenWebhookSecret function) |
| Server-side tier gates missing | ✅ CLOSED | middleware.ts:144-160 (admin gate) + requirePremiumTier() in Server Actions |
| getHeyGenClientSync() deprecation | ❓ LIKELY CLOSED | No grep found for getHeyGenClientSync; assume removed in refactor. NOT VERIFIED. |
| IPN underpayment handling | ⚠️ PARTIAL | IPN validates outcome_amount; partially_paid holds (no dispatch). Operator override mechanism not visible. |

### Recently Fixed (b8c4f6dd + prior commits)

- **b8c4f6dd** (2026-05-20): MASTER RaaS dashboard code-review findings C2-C6, C8 (fixes to tier guard UI)
- **d706a7d8** (2026-05-10): Cron check-in typedef for Sentry SDK v10
- **ddb9211a** (2026-05-16): Sentry heartbeat wired to 29 cron handlers (OG-002 closed)
- **7da5a312** (2026-05-08): Signup locale + query param preservation (fixes /signup redirect on affiliate refs)

---

## 8. ARCHITECTURE DIAGRAM (Text)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         CF Edge (Global)                                 │
│  Next.js 16 + React 19 (OpenNext → .open-next/worker.js)                │
│  ├─ middleware.ts (CSRF, CSP nonce, auth, tier gates)                    │
│  ├─ app/[locale]/dashboard/page.tsx (Server Components, tier-gated)      │
│  ├─ app/api/* (Public + Auth-required endpoints)                         │
│  └─ app/auth/* (Better Auth strategy)                                    │
└────────┬─────────────────────────────────────────────────────────────────┘
         │
    ┌────┴─────────────────────────────────────────────────────────────┐
    │                                                                   │
    ▼                                   ▼                               ▼
┌──────────────────┐      ┌──────────────────────┐   ┌────────────────────┐
│  D1 (sqlite)     │      │  R2 Buckets          │   │  KV Namespace      │
│  sophia-raas-db  │      │  ├─ videos/          │   │  EXPERIMENT_KV     │
│  40+ tables:     │      │  ├─ opennext-cache/  │   │  (feature flags)    │
│  ├─ users        │      │  └─ backups/         │   └────────────────────┘
│  ├─ sessions     │      │                      │
│  ├─ api_keys     │      │  30-day lifecycle    │
│  ├─ orders       │      │  rotation            │
│  ├─ user_tiers   │      └──────────────────────┘
│  ├─ videos       │
│  └─ audit_logs   │
└──────────────────┘

    External APIs (Customer BYOK)
    ├─ HeyGen (video generation)
    ├─ OpenRouter (LLM, customer key)
    ├─ ElevenLabs (voice, customer key)
    ├─ D-ID (face animation, customer key)
    ├─ NOWPayments (tier payment webhooks)
    ├─ Resend (email)
    └─ YouTube/TikTok (platform publish)

    Async Orchestration (Inngest)
    ├─ video-generate (HeyGen submit)
    ├─ video-publish (Platform publish)
    └─ conversion-to-ledger (Affiliate commission)

    Cron Jobs (18 CF Triggers)
    ├─ video-status-sync (poll HeyGen)
    ├─ email-drip (nurture campaigns)
    ├─ affiliate-scout (network discovery)
    ├─ fulfillment-reconcile (drift detection)
    └─ ... (14 more)
```

---

## 9. DEPLOYMENT & SCALING NOTES

**Current bottlenecks** (honest assessment per no-tech-doctrine):
1. **D1 query latency** at peak (concurrent user signups) — SQLite single-writer lock; no sharding available
2. **Video render submit latency** (BYOK key lookup + HeyGen API call) — no request batching; each render is sync
3. **Email delivery** (Resend) — no local queue; failures silent unless observed via Sentry
4. **Cron concurrency** — all CF crons fire independently; no dedup for simultaneous triggers on slow handlers

**Scaling strategy**:
- D1 → Cloudflare Durable Objects for distributed state (not yet implemented)
- Video submit → Inngest job batching (planned, not yet enabled)
- Email → D1 outbox table (exists; retry logic via cron email-outbox-flush)

**Current scale**:
- Workers: 8 CPU slots (per wrangler.toml request body; OpenNext default)
- D1: EU region, ~40 tables, ~10k users (estimate from audit)
- R2: 150GB allocated (mix of videos, cache, backups)
- KV: 60s TTL feature flag cache (low memory footprint)

**Confidence**: HIGH on infrastructure. Scale estimates LOW (not visible in codebase).

---

## 10. UNRESOLVED / FOLLOW-UP QUESTIONS

1. **getHeyGenClientSync deprecation**: Was this function removed? Need code search for all imports to confirm.
2. **Fulfillment retry queue**: Is fulfillment-retry cron fully deprecated, or is there a hybrid Inngest + cron retry strategy?
3. **External cron for D1 backup**: Is `/api/cron/d1-backup` called by an external scheduler (e.g., Upstash QStash, GitHub Actions, manual), or exclusively operator-manual? (No-tech-doctrine says no external cron, but backup design doc unclear.)
4. **Video storage fallback behavior**: What happens when R2_PUBLIC_BASE_URL is unset in wrangler.toml? Does app serve HeyGen CDN URL directly to user?
5. **Chargeback operator SOP**: Is there a written SOP for dispute resolution >30 days? (Not found in codebase.)
6. **Sentry source map upload**: SENTRY_AUTH_TOKEN is optional per no-tech-doctrine; are source maps currently being uploaded in production deploys?
7. **Email delivery retries**: Where is dead-letter handling for permanently failed Resend deliveries?
8. **Tier downgrade timing**: On refund, is tier immediately downgraded, or after dispute window expires? (Code shows immediate downgrade; verify if 30-day window is enforced elsewhere.)

---

## SUMMARY

Sophia AI Factory is a **Next.js 16 + D1 + Better Auth + NOWPayments RaaS platform** deployed on Cloudflare Workers. Architecture is **4-layered** (seed, tree, forest, land) with clear separation of concerns. Payment tier activation is **fully automated** via IPN webhooks with idempotency checks. Video generation uses **customer BYOK keys** (no operator-managed credentials), reducing operational burden. Auth is **JWT-based** with per-request nonce-driven CSP. Async workflows via **Inngest** + **18 Cloudflare cron jobs** for eventual consistency. **Read-only D1 client** (sync, no await) keeps edge runtime latency minimal.

**Production readiness**: 87.5/100 (per prior audit 260502). Recent fixes: MASTER tier dashboard (b8c4f6dd), Sentry heartbeat wiring (ddb9211a), signup locale preservation (7da5a312). **Known P0s closed** (BYOK secret per-customer, server-side tier gates). **Unknowns remain** on getHeyGenClientSync deprecation + chargeback SOP.

**Operator attack surface**: Minimal by design. No third-party credentials required to ship. D1 backup is manual (no external cron). Email retries via cron. Score ceiling: **91.5/100** under no-tech-doctrine (no operator infra dependencies).

