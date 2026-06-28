# Reliability & Scalability Audit — Sophia AI Factory
**SHA audited:** b8c4f6dd | **Date:** 2026-05-21 | **Ref audit:** plans/reports/strategic-audit-260502-1837-go-live.md

---

## May-2 P0 Status Summary

| # | Issue | Status | Evidence |
|---|-------|--------|----------|
| P0.1 | HeyGen per-customer webhook secret | **CLOSED** | `heygen-webhook-secret-resolver.ts` resolves per `user_id`; route.ts:116 calls it |
| P0.2 | Server-side tier limit gate on /api/videos/* /api/heygen/* | **PARTIALLY OPEN** | See F-01 below |
| P0.3 | Remove `getHeyGenClientSync()` platform-key fallback | **CLOSED** | `heygen-client.ts:215`: export deleted, comment confirms P0.3 fix |
| P0.4 | IPN underpayment guard (`actually_paid < price_amount * 0.99`) | **CLOSED** | Subscription path: `ipn-subscription.ts:22-36`. One-time path: `ipn-one-time.ts:50-65`. `UNDERPAYMENT_THRESHOLD=0.99` in both |
| P0.5 | Double-pay dedupe (user+sku+24h window) | **PARTIALLY OPEN** | See F-02 below |

---

## Findings

### F-01 — P1 (was P1 in May-2, still open)
**Tier limit gate missing on `/api/missions/auto-video` (canonical video path)**

**Evidence:** `src/app/api/missions/auto-video/route.ts:28-54` — auth check present, Zod validation present, but `getUserTier()` / `reserveVideoSlot()` not called before `runAutoVideoMission()`. The Server Action `generateVideoAction` (`video-generate-action.ts:86-95`) does call `reserveVideoSlot()` but that action is for the deprecated AI-prompt pipeline (which returns 410 from `/api/videos/generate`). The canonical HeyGen mission path enters through `auto-video` → `runAutoVideoMission` with no quota enforcement at the HTTP boundary.

`/api/heygen/voices`, `/api/heygen/avatars`, `/api/heygen/status/[id]` — auth-only, no tier gate (acceptable: these are read endpoints, not generation).

**Failure mode:** Authenticated user on free/BASIC tier calls `POST /api/missions/auto-video` in a loop; each call creates an `engine_missions` row and invokes HeyGen. No quota accounting. Platform eats cost.

**Blast radius:** Financial. At 10 free users × 50 calls = 500 unmetered HeyGen renders/day. With BYOK the cost is customer-side, but the platform quota promise is broken for subscription upsell motivation.

**Fix effort:** Small (2-4h). Add `getUserTier` + `reserveVideoSlot` check at line 42 in `auto-video/route.ts`, same pattern as `video-generate-action.ts:86-95`.

---

### F-02 — P1 (was P0.5 in May-2, partially fixed)
**Subscription checkout (`/api/checkout`) has no dedupe window**

**Evidence:** `src/app/api/checkout/route.ts:149` writes a `pending_orders` row but has no prior check for an existing pending order for the same `user_id + tier`. The one-time path at `/api/payments/one-time-checkout/route.ts:42-77` has a proper `findPendingInvoiceUrl()` with a 30-minute window. Subscription path has no equivalent.

**Failure mode:** User clicks "Buy PREMIUM" twice in rapid succession → two NOWPayments invoices → pays both → `handleFinished` fires twice for same `order_id` (different `payment_id`) → second IPN is NOT deduplicated by `isPaymentProcessed` (different payment_id) → subscription activated twice (idempotent UPDATE, no financial double-grant), but two receipt emails sent and two auto-handovers triggered. The `subscriptions` table UPDATE is idempotent so no tier escalation, but ops noise is high.

**Blast radius:** Medium. No double-billing (UPDATE is idempotent), but double-email + double-handover + noisy audit log. Support tickets on "why did I get charged twice."

**Fix effort:** Small (2h). Add `findExistingPendingOrder(userId, tier)` check in checkout POST handler before `writeOrder`, mirroring `findPendingInvoiceUrl` pattern.

---

### F-03 — P1
**`decrementCredits` is a read-then-write with optimistic CAS — not atomic under D1 serialization**

**Evidence:** `user-purchases-repo.ts:180-204` — reads `credits_remaining`, then updates with `.eq('credits_remaining', row.credits_remaining)` as optimistic lock. D1 is SQLite-compatible but the supabase-js client layer wraps these as two HTTP calls to D1's REST API. If two concurrent fulfillment workers race on the same `purchaseId`, both may read `credits_remaining=1`, both issue the UPDATE, both succeed (D1 processes them sequentially but neither races at application level), resulting in `credits_remaining = -1` possible depending on D1 serialization guarantees.

**Evidence:** CF D1 does provide per-row serialization for single `UPDATE` statements, but the application-level gap (`SELECT` then `UPDATE` as separate HTTP calls) opens a TOCTOU window. Under current load (1 video/user) this is unlikely. At 50+ concurrent users with shared purchases (org plans), it fires.

**Failure mode:** User burns 1 credit, gets 2 videos. At `$49` bundle with 3 credits, each credit has ~$16 value.

**Blast radius:** Low at current scale, material at 100+ customers with org plans sharing credit pools.

**Fix effort:** Medium (1 day). Replace with `UPDATE user_purchases SET credits_remaining = credits_remaining - 1 WHERE id = ? AND credits_remaining > 0` as raw D1 prepared statement (atomic). Returns `meta.changes = 0` if already zero.

---

### F-04 — P1
**`video-status-sync` cron is sequential, not batched — guaranteed timeout at ~30 customers with backlog**

**Evidence:** `cron/video-status-sync/route.ts:144` — `for (const row of pending)` sequential loop. LIMIT 50 rows. Each iteration: 1 D1 query (user info) + 1 HeyGen GET + optional R2 fetch+put + 1 D1 UPDATE = 3-5 subrequests and ~1-2s wall time per video. At 50 rows × 2s = 100s. CF Worker time limit = 30s for standard Workers, **no extended CPU time configured in wrangler.toml**.

Wrangler.toml does NOT show `[limits]` section or `cpu_ms` override. Default CF Workers CPU time is 10ms (standard) or 30s (paid, unbound Workers). Cron triggers on paid plans get 30s CPU. 50 sequential HTTP calls will breach this.

**May-2 verdict was "BREAK at ~30 customers"** — code unchanged. Confirmed still sequential.

**Blast radius:** At 30 customers with any backlog, cron silently exits mid-loop, leaving videos stuck in `processing` until next 5-min tick. 24h timeout catches stragglers, but user experience degrades immediately.

**Fix effort:** Medium (4-8h). Convert the loop body to `Promise.allSettled` batches grouped by user_id. HeyGen rate limit is 50 req/min per key; per-user grouping keeps each user's calls in sequence, different users run in parallel.

---

### F-05 — P2
**R2 video download is in-band within cron Worker — 5MB × 50 = 250MB potential read in single execution**

**Evidence:** `video-status-sync/route.ts:188-204` — `downloadAndStore()` called synchronously inside the cron loop. `video-storage-service.ts:48-53` does `await fetch(heygenUrl)` + `arrayBuffer()`. 50 completed videos × 5MB = 250MB in-memory during one cron execution. CF Workers memory limit = 128MB.

**Failure mode:** `arrayBuffer()` for a batch of large videos causes OOM → Worker crashes mid-cron → partial updates, some videos stuck. `fulfillment-retry` has separate idempotency (`wasRecentlyRun`) so it won't catch videos that were partially updated.

**Blast radius:** Low at current scale (< 10 completed per tick). Material at 50+ customers with heavy video gen.

**Fix effort:** Medium (1 day). Move R2 transfer to CF Queues (already recommended in May-2 P1). Short term: cap `downloadAndStore` to first 10 completed videos per cron tick; do the rest in the next tick.

---

### F-06 — P2
**KV idempotency check uses `EXPERIMENT_KV` for circuit breaker state — same namespace as PostHog A/B cache**

**Evidence:** `circuit-breaker.ts:44-45` — `KV_STATE_KEY = 'circuit:heygen'`, stored in `EXPERIMENT_KV`. `wrangler.toml` (line ~84): `EXPERIMENT_KV: PostHog feature flag + A/B variant cache (60s TTL)`. Keys with `circuit:` prefix won't collide with PostHog keys, but KV eviction policy (TTL-based) could purge the circuit-open state if the namespace runs hot. KV has no size limit per key but has 1000 write/s per namespace limit.

**Failure mode:** If KV evicts `circuit:heygen` while circuit is OPEN (e.g., namespace writes spike), the circuit silently resets to CLOSED, and retry cron hammers HeyGen again.

**Blast radius:** Low probability. Impact = HeyGen API key rate-limiting or temporary ban during HeyGen outage recovery.

**Fix effort:** Small (1h). Use dedicated KV binding for circuit breaker state (`CIRCUIT_KV`), or add explicit TTL of 24h to the KV write to prevent silent eviction.

---

### F-07 — P2
**Webhook handler: `handleOnboardingDelivery` queries `videos` by `heygen_job_id` without user scope**

**Evidence:** `webhooks/heygen/route.ts:68-75` — `WHERE heygen_job_id = heygenVideoId` (no `user_id` filter). This is the legacy onboarding path, not the fulfillment state machine path (which goes through `completeVideoFromWebhook`). If two users ever share a `heygen_job_id` (collision, or BYOK key reuse), the first match wins → cross-tenant onboarding email.

May-2 flagged this as P0.2 in the "onboarding handler" context. The fulfillment state machine path (`completeVideoFromWebhook`) was fixed (the main webhook route now resolves per-customer secret first). The onboarding delivery sub-function was NOT scoped.

**Blast radius:** Low probability (HeyGen IDs are UUIDs, collision extremely rare). Potential cross-tenant data exposure (email sent to wrong user) if triggered.

**Fix effort:** Trivial (30min). Add `.eq('user_id', resolvedUserId)` to the query if user context is known at call site, or accept as acceptable-risk for legacy onboarding path.

---

### F-08 — P3
**`resolveHeyGenWebhookSecret` falls back to platform `HEYGEN_WEBHOOK_SECRET` if lookup fails**

**Evidence:** `heygen-webhook-secret-resolver.ts:46-52` — on any DB error during lookup, logs warning and returns `platformSecret`. If `HEYGEN_WEBHOOK_SECRET` is unset (which it may be in a BYOK-only deployment), returns `null` → webhook accepts event without signature verification and returns `{ok: true, mode: 'cron-poll-fallback'}` (route.ts:122-124).

**Failure mode:** If D1 is briefly unavailable during a webhook delivery, all HeyGen webhook events bypass HMAC verification and are accepted silently. HeyGen will retry; accepted-without-verification events are processed.

**Blast radius:** Low in practice (D1 rarely unavailable). Risk: forged webhook events accepted during DB blip.

**Fix effort:** Small (1h). On DB lookup failure, return `null` (reject, not accept) instead of falling back to platform secret. Force HeyGen to retry; cron polling handles genuine events.

---

### F-09 — P3
**`decrementCredits` optimistic-check UPDATE has no row-affected validation**

**Evidence:** `user-purchases-repo.ts:196-204` — update issued with `.eq('credits_remaining', row.credits_remaining)` but return value not checked. If the optimistic check fails (another caller changed credits between SELECT and UPDATE), the update silently no-ops and the function returns `true` regardless.

**Failure mode:** Race condition where 2 callers read `credits_remaining=1` → both issue UPDATE → one wins, one silently no-ops but both return `true` → 2 fulfillments dispatched for 1 credit.

**Blast radius:** Low at current scale. See F-03 (same root, different angle).

**Fix effort:** Same fix as F-03 — use atomic SQL `UPDATE ... WHERE credits_remaining > 0` and check `meta.changes`.

---

## Retry Strategy & Idempotency Assessment

**Fulfillment-retry cron (`/api/cron/fulfillment-retry`):**
- Circuit breaker: present (`shouldDispatch()` — KV-backed, OPEN/HALF-OPEN/CLOSED).
- Exponential backoff: present (`isRetryDue()` + `MAX_ATTEMPTS`).
- CAS on permanent failure: present (`markPermanentFailureCAS`).
- Idempotency window: `wasRecentlyRun(90s)` guard prevents double-fire.
- **Gap:** `recordHeyGenAttempt` call is `try/catch` non-fatal — circuit breaker log can miss attempts if KV write fails, leading to under-counting failures and circuit staying CLOSED longer than intended.

**IPN dispatcher:**
- `isPaymentProcessed(payment_id)` checked before processing — idempotent.
- `recordIpnEvent` writes D1 sync — write contention on burst (May-2 concern) partially mitigated by `payment_id UNIQUE` constraint preventing duplicate rows.

**Video webhook:**
- No idempotency key on webhook events. HeyGen retries → `completeVideoFromWebhook` called multiple times for same `video_id`. Need to verify `completeVideoFromWebhook` is idempotent.

---

## Cron Timeout Headroom (video-status-sync)

```
50 rows × (1 HeyGen GET ~300ms + 1 D1 UPDATE ~50ms + optional R2 ~2s) = sequential worst-case ~115s
CF Workers cron paid plan CPU = 30s wall clock
→ BREAKS at ~15 rows if R2 transfer inline, ~50 rows if R2 skipped
```

No `[limits]` override in wrangler.toml. Wrangler TOML confirms cron triggers present but no `cpu_ms` or `memory_mb` extensions. Default 30s wall clock applies.

---

## Throughput Verdict

| Customer count | Status | Primary bottleneck |
|---|---|---|
| **25** | HOLDS | Sequential cron tolerable at low backlog |
| **50** | DEGRADES | `video-status-sync` starts timing out mid-loop; R2 memory pressure starts |
| **100** | BREAKS | Cron consistently exits before processing all rows; subrequest burst hits ~200+ per tick; R2 OOM risk; credit race conditions visible |
| **500** | BREAKS HARD | D1 write contention on `recordIpnEvent`; KV write limit (1000/s) may be hit; circuit breaker log loss; missing tier gate on `auto-video` = unlimited HeyGen spend |

**Verdict unchanged from May-2.** Core bottleneck = sequential cron + inline R2. The P0s that were fixed (webhook secret, getHeyGenClientSync, underpayment guard) remove correctness bugs but do not improve throughput.

---

## Open Questions

1. Is `completeVideoFromWebhook` idempotent if called twice for same `video_id`? (Could not verify in this read-only pass — need to check `lib/fulfillment/complete-video-from-webhook.ts`.)
2. Does `runAutoVideoMission` internally check HeyGen BYOK presence before queuing? If not, a user without HeyGen key configured gets a stuck mission with no compensation path.
3. `wrangler.toml` cron entry `"*/2 * * * *"` comment says "dead since 2026-05-02 commit a4d54d8d" for `fulfillment-retry`. Is this comment stale, or is the cron truly not being dispatched to the route? If cron fires but route returns 200 via early-exit, the circuit-breaker log still accumulates stale entries.
4. Subscription checkout double-click window: `pending_orders` has `order_id PRIMARY KEY` (migration 0070). Does `createInvoiceUrl` embed a stable `order_id` that would cause `writeOrder` to throw on second click, or does it generate a new `order_id` per call? If new ID per call, the dedupe gap is confirmed.
5. `EXPERIMENT_KV` TTL on circuit-breaker keys: what is the KV write rate at 100 customers? Each `recordHeyGenAttempt` is 1 KV write; at 50 videos × 100 customers × every-2-min cron = potentially high KV write volume.
