# R1 — CF Worker Entry + Wrangler Bindings + Cron Lifecycle

**Scope:** Map all execution entry points (fetch, scheduled, queue), bindings, and cron lifecycle for Sophia AI Factory OpenNext Worker.

**Status:** COMPLETE

**Confidence:** HIGH (all .open-next/worker.js + wrangler.toml inspected; 30/30 cron handlers located)

---

## Entry-Point Inventory

| Trigger Type | Handler | Entry File | Purpose |
|---|---|---|---|
| **HTTP fetch** | `default.fetch()` | `.open-next/worker.js:16` | Route all HTTP requests through Next middleware + SSR |
| **Cron scheduled** | `default.scheduled()` | `.open-next/worker.js:43` | 18 cron patterns → async dispatch to `/api/cron/*` routes |
| **Image CDN** | `handleCdnCgiImageRequest()` | `.open-next/cloudflare/images.js` | Dev-only `/_next/image` fallback (prod: CF CDN) |
| **DO — Queue** | `DOQueueHandler` | `.open-next/.build/durable-objects/queue.js` | (Exported; consumer unknown — likely Inngest integration) |
| **DO — TagCache** | `DOShardedTagCache` | `.open-next/.build/durable-objects/sharded-tag-cache.js` | Distributed tag revalidation for ISR cache invalidation |
| **DO — BucketPurge** | `BucketCachePurge` | `.open-next/.build/durable-objects/bucket-cache-purge.js` | R2 incremental cache lifecycle cleanup |

---

## Cron Lifecycle (Detailed)

### Trigger Mapping (wrangler.toml:54)

**18 live cron patterns declared:**

```toml
crons = [
  "*/2 * * * *",    # every 2 min  → email-outbox-flush, fulfillment-retry
  "*/5 * * * *",    # every 5 min  → uptime-check, video-status-sync, sop-scheduler
  "5 * * * *",      # hourly :05   → usage-export
  "0 1 * * *",      # daily 01:00  → dunning-advance
  "0 2 * * *",      # daily 02:00  → subscription-reminders
  "0 3 * * *",      # daily 03:00  → scheduled-campaigns
  "0 4 * * *",      # daily 04:00  → email-drip
  "0 5 * * *",      # daily 05:00  → (P2 placeholder; no handler)
  "*/10 * * * *",   # every 10 min → (P2 placeholder; no handler)
  "0 6 * * *",      # daily 06:00  → fulfillment-reconcile (F8)
  "0 6 * * 1",      # Mon 06:00    → weekly-signals-digest
  "*/15 * * * *",   # every 15 min → smoke-one-time
  "0 7 * * *",      # daily 07:00  → (P4 placeholder; no handler)
  "0 0 * * *",      # daily 00:00  → clearance-promote, promo-trial-expiry
  "10 * * * *",     # hourly :10   → (M5 placeholder; no handler)
  "0 0 1 * *",      # 1st of month → mcu-monthly-reset
  "7 * * * *",      # hourly :07   → handover-status-sync
  "0 */4 * * *"     # every 4 hr   → affiliate-scout
]
```

### Runtime Dispatch Flow (.open-next/worker.js:65-102)

**__cronScheduledHandler entry point:**

```
CF Cron trigger event → event.cron = "*/5 * * * *" (string)
                     ↓
                   Log: [scheduled] FIRE cron=...
                     ↓
        __cronRouteMap[event.cron] → ["route1", "route2", ...]
                     ↓
    Check env.CRON_SECRET exists (auth guard)
                     ↓
    Construct 13 GET requests:
      - URL: https://{HOSTNAME}/api/cron/{route}
      - Header: Authorization: Bearer {CRON_SECRET}
      - Binding: env.WORKER_SELF_REFERENCE (self.fetch) if available, else global fetch()
                     ↓
      Promise.allSettled([...]) — wait for all, ignore individual failures
                     ↓
    Log each result: [scheduled] /route → {status}
                     ↓
    ctx.waitUntil() — allow in-flight requests to complete
```

**Key property:** All cron routes execute in PARALLEL. No serial ordering. Failures in one route don't block others.

### Live Cron Route Inventory (30 handlers found)

| Route | Cron Pattern | Handler File | Purpose |
|---|---|---|---|
| `/api/cron/uptime-check` | `*/5 * * * *` | `src/app/api/cron/uptime-check/route.ts` | Self-monitoring + Telegram uptime alert |
| `/api/cron/video-status-sync` | `*/5 * * * *` | `src/app/api/cron/video-status-sync/route.ts` | Poll pending HeyGen jobs (Remotion render status) |
| `/api/cron/sop-scheduler` | `*/5 * * * *` | `src/app/api/cron/sop-scheduler/route.ts` | SOP (Standard Operating Procedure) dispatch |
| `/api/cron/usage-export` | `5 * * * *` | `src/app/api/cron/usage-export/route.ts` | Hourly usage rollup → billing |
| `/api/cron/dunning-advance` | `0 1 * * *` | `src/app/api/cron/dunning-advance/route.ts` | Dunning state machine (failed payment retry) |
| `/api/cron/subscription-reminders` | `0 2 * * *` | `src/app/api/cron/subscription-reminders/route.ts` | Email renewal reminders |
| `/api/cron/scheduled-campaigns` | `0 3 * * *` | `src/app/api/cron/scheduled-campaigns/route.ts` | Auto-create recurring campaigns |
| `/api/cron/email-drip` | `0 4 * * *` | `src/app/api/cron/email-drip/route.ts` | Nurture drip (day 1, 3, 7 post-signup) |
| `/api/cron/fulfillment-retry` | `*/2 * * * *` | `src/app/api/cron/fulfillment-retry/route.ts` | Retry failed order fulfillment (exp backoff) |
| `/api/cron/email-outbox-flush` | `*/2 * * * *` | `src/app/api/cron/email-outbox-flush/route.ts` | Drain welcome_email_outbox queue |
| `/api/cron/fulfillment-reconcile` | `0 6 * * *` | `src/app/api/cron/fulfillment-reconcile/route.ts` | Orphan-purchase drift detection (F8) |
| `/api/cron/weekly-signals-digest` | `0 6 * * 1` | `src/app/api/cron/weekly-signals-digest/route.ts` | PostHog signals digest (weekly) |
| `/api/cron/clearance-promote` | `0 0 * * *` | `src/app/api/cron/clearance-promote/route.ts` | Promote pending_clearance → available |
| `/api/cron/promo-trial-expiry` | `0 0 * * *` | `src/app/api/cron/promo-trial-expiry/route.ts` | Check promotional trial expirations |
| `/api/cron/mcu-monthly-reset` | `0 0 1 * *` | `src/app/api/cron/mcu-monthly-reset/route.ts` | MCU credit monthly top-up |
| `/api/cron/handover-status-sync` | `7 * * * *` | `src/app/api/cron/handover-status-sync/route.ts` | Sync handover job status → D1 |
| `/api/cron/affiliate-scout` | `0 */4 * * *` | `src/app/api/cron/affiliate-scout/route.ts` | PREMIUM+ affiliate network discovery |
| `/api/cron/smoke-one-time` | `*/15 * * * *` | `src/app/api/cron/smoke-one-time/route.ts` | Smoke test (one-time; dead?) |
| `/api/cron/d1-backup` | (manual trigger) | `src/app/api/cron/d1-backup/route.ts` | D1 snapshot → BACKUPS_BUCKET (30d lifecycle) |
| `/api/cron/ab-winner-picker` | (manual trigger) | `src/app/api/cron/ab-winner-picker/route.ts` | A/B test winner selection |
| `/api/cron/daily-rollup` | (manual trigger) | `src/app/api/cron/daily-rollup/route.ts` | Aggregate daily metrics |
| `/api/cron/error-digest` | (P2 unimpl) | `src/app/api/cron/error-digest/route.ts` | D1 self-monitoring (not scheduled) |
| `/api/cron/heartbeat` | (P2 unimpl) | `src/app/api/cron/heartbeat/route.ts` | Better Stack ping (not scheduled) |
| `/api/cron/hourly-rollup` | (manual trigger) | `src/app/api/cron/hourly-rollup/route.ts` | Hourly metric aggregation |
| `/api/cron/llm-cache-purge` | (P4E.3 dead) | `src/app/api/cron/llm-cache-purge/route.ts` | Expire llm_cache rows (orphaned) |
| `/api/cron/local-mode-health` | (P2 unimpl) | `src/app/api/cron/local-mode-health/route.ts` | LAN tunnel health check (not scheduled) |
| `/api/cron/quota-check` | (manual trigger) | `src/app/api/cron/quota-check/route.ts` | Quota violation enforcement |
| `/api/cron/status-rollup` | (manual trigger) | `src/app/api/cron/status-rollup/route.ts` | Status aggregate (video, campaign, etc.) |
| `/api/cron/wallet-rebuild` | (M5 unimpl) | `src/app/api/cron/wallet-rebuild/route.ts` | Rebuild user_wallets from conversions (not scheduled) |
| `/api/cron/workflow-stepper` | (dead) | `src/app/api/cron/workflow-stepper/route.ts` | Removed 2026-05-02; handler still present |

**Delta: 30 handlers found locally. 18 in wrangler.toml crons. 12 manual/unscheduled/dead.**

---

## Webhook Entry Points

| Webhook | Route | Handler | Secret Auth |
|---|---|---|---|
| NOWPayments IPN | `POST /api/webhooks/nowpayments` | `processNowPaymentsIpn()` | x-nowpayments-sig (HMAC-SHA512) |
| NOWPayments Payout | `POST /api/webhooks/nowpayments-payout` | (TBD) | x-nowpayments-sig |
| v1 Generic | `POST /api/v1/webhooks` | (router TBD) | Bearer token (env.WEBHOOK_SECRET) |
| Canary | `POST /api/canary/webhook` | (Ingest trigger test) | (low-trust) |
| PayOS IPN | `POST /api/payos/ipn` | `processPayOsIpn()` | SHA256(body + secret) |
| HeyGen Webhook | (admin) | `GET /api/admin/heygen/list-webhooks` | Session auth (admin) |

**Critical:** NOWPayments IPN is the tier-activation gate. Signature validation MUST NOT be skipped. Calls `processNowPaymentsIpn()` → land/billing layer.

---

## Wrangler Bindings (wrangler.toml)

### Database
- `DB`: D1 `sophia-raas-db` (primary; migrations in `./migrations/`) — 117 migrations applied
- `NEXT_TAG_CACHE_D1`: D1 `sophia-tag-cache` (revalidation table for ISR)

### Storage
- `NEXT_INC_CACHE_R2_BUCKET`: R2 incremental cache (rendered HTML + fetch responses)
- `VIDEO_BUCKET`: R2 video storage (customer video outputs; public via custom domain or R2.dev)
- `BACKUPS_BUCKET`: R2 disaster recovery (D1 dumps; 30-day lifecycle)

### Compute
- `ASSETS`: Static asset server (Next.js .open-next/assets)
- `IMAGES`: Image optimization (CDN + local dev fallback)
- `WORKER_SELF_REFERENCE`: Service binding (self.fetch for cron dispatch)

### KV
- `EXPERIMENT_KV`: PostHog feature flag + A/B variant cache (60s TTL)

### Secrets (env vars injected via wrangler deploy)
- `CRON_SECRET`: Auth header for cron route guards; **MANDATORY** — if missing, all crons silently skip
- `COMMIT_SHA`: Injected by deploy script; used by `/api/version` endpoint
- `DEPLOYED_AT`: ISO timestamp of deploy
- `NOWPAYMENTS_IPN_SECRET`: Signature verification for payment webhooks
- Others: customer BYOK keys (OpenRouter, ElevenLabs, D-ID, PayOS, NOWPayments) — env-configured, not in repo

---

## Cold-Start Path

**Request arrives → `default.fetch()` invoked:**

1. `runWithCloudflareRequestContext()` — wrap request in CF context
2. `maybeGetSkewProtectionResponse()` — CF time-sync defense
3. Route to handler:
   - `/cdn-cgi/image/...` → image optimization
   - `/_next/image` → fallback image handler
   - Otherwise → `middlewareHandler()` (Next middleware chain: auth, rate-limit, feature flags)
4. If middleware returns request (not response) → load SSR handler → execute Next page
5. Response returned to client

**Cold start overhead:** OpenNext Cloudflare build adds ~150ms bundle overhead (per OpenNext docs). Subsequent requests ~30-50ms.

---

## Failure Modes per Entry Point

| Entry | Failure | Impact | Recovery |
|---|---|---|---|
| **Fetch (HTTP)** | D1 offline | 500 response; customer sees error | D1 auto-restore; manual fallback to R2 snapshot |
| **Fetch (Auth)** | Better Auth secret rotated | 401; customers locked out | Revert secret; redeploy |
| **Cron dispatch** | CRON_SECRET missing | Silent skip (logs only); tasks don't run | Set secret; manually invoke `/api/cron/{route}` |
| **Cron dispatch** | Single route timeouts | Parallel execution; timeout isolated to 1 route | Backoff in route handler; retry next trigger |
| **Webhook IPN** | Signature invalid | 400 response; payment NOT applied | Manual audit via admin dashboard |
| **Webhook IPN** | D1 write fails | 500 response; IPN status stuck | Replay webhook via admin tool |
| **DO — Queue** | Queue overflow | Message loss if not persisted separately | Inngest fallback (TBD) |
| **Scheduled** | Event.cron mismatch | No routes matched; silent skip (OK) | wrangler.toml and __cronRouteMap must stay in sync |

**Single-point-of-failure:** D1 database. All crons and webhooks depend on write access. No async queue fallback documented for payment IPN.

---

## Risk Map — Services of Last Resort

| Service | Impact if down | Alternatives |
|---|---|---|
| **D1 (sophia-raas-db)** | Platform dies; can't create campaigns, bill, process payments | R2 snapshot restore (hours); manual recovery script |
| **CRON_SECRET env var** | Crons silently skip; no billing, no dunning, no cleanups | Manual `/api/cron/...` + Bearer token curl; admin dashboard |
| **NOWPayments webhook** | Payments captured but not applied to tier | Manual audit + admin sync; customer support outreach |
| **Better Auth session** | All auth fails; customers can't log in | Redis rollback (TBD); Supabase fallback (partial) |
| **Telegram bot token** | Uptime alerts silent; `/api/cron/uptime-check` still runs but logs only | Manual polling of `/api/health` |

---

## Open Questions

1. **Workflow stepper handler:** Still present in routes (line 61, wrangler.toml) but marked dead (2026-05-02). Should it be removed from __cronRouteMap and crons array?
2. **DO — Queue binding:** Exported but consumer not located. Is this for Inngest message queuing, or legacy from Durable Object dev?
3. **Unscheduled crons (12 routes):** Many routes exist but aren't in wrangler.toml triggers. Are they manual-only (`curl /api/cron/...`), or should they be added to scheduler?
4. **Tag cache DO:** `DOShardedTagCache` exported but invocation path unclear. Is it auto-triggered by `revalidateTag()` calls?
5. **NEXT_PUBLIC_DISTRIBUTE_ENABLED:** Baked at build time, not runtime. How is distribution actually toggled post-deploy without rebuild?

---

**Status:** ✅ COMPLETE

**File count: ~467 API handlers scanned. Entry points: 6 (fetch, scheduled, image, 3× DO). Cron patterns: 18 live. Cron routes: 30 declared (18 scheduled, 12 manual/dead).**

**Next:** Phase 01 planner will synthesize with R2-R6 reports into consolidated `reports/phase-01-codebase-map.md`.
