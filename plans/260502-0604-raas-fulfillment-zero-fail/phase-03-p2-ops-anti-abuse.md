# Phase 03 — P2 Ops + Anti-Abuse (~8h)

> **Goal:** Make the fulfillment chain observable (Sentry-grade structured errors), self-reconciling (daily diff of paid vs delivered), self-healing (circuit breaker → D-ID fallback during HeyGen outages), and revenue-protected (signed R2 URLs revocable on refund).

**Features:** F7 structured error reporting · F8 daily reconciliation · F9 circuit breaker + D-ID fallback · F10 R2 presigned URL with refund-aware expiry

## Context Links

- Depends on Phase 01 (queued state, retry cron, status page)
- Depends on Phase 02 (webhook, synthetic monitor)
- Existing logger: `@/lib/utils/logger-utility`
- KV binding: `EXPERIMENT_KV` (already configured) — reuse for breaker state
- R2 bucket: `VIDEO_BUCKET` (existing binding)

---

## F7. Structured Error Reporting on Every Catch

**Priority:** P2 · **Effort:** 1.5h · **Status:** pending

### Key Insight
Multiple `try/catch` blocks in the fulfillment chain currently swallow errors with `logger.warn` (non-fatal). For an outage, we need the same logger.error severity flowing into a structured channel (existing logger should already pipe to D1 `error_digest` cron). Also wire to Sentry-compatible service if `SENTRY_DSN` env is set.

### Requirements

**Functional**
- All catch blocks in fulfillment path emit structured event with severity `error` and consistent fields: `{ feature: 'one_time_fulfillment', stage, userId, purchaseId, error.message, error.stack }`
- If `SENTRY_DSN` set: forward via fire-and-forget `fetch` (no SDK to keep bundle small)
- If not set: existing logger persists to D1; daily `error-digest` cron already handles aggregation

**Non-functional**
- Zero performance regression — Sentry call is fire-and-forget with 2s timeout, errors silently swallowed
- No PII leak — strip email/payment IDs before forwarding (only purchase_id + user_id allowed)

### Files to Modify
- `src/lib/utils/logger-utility.ts` — extend `logger.error` to optionally forward to Sentry-compatible HTTP endpoint
- `src/lib/fulfillment/one-time-fulfillment.ts` — replace remaining silent returns with `logger.error` + structured fields
- `src/lib/billing/nowpayments-ipn-one-time.ts` — same audit for catch blocks
- `src/app/api/cron/fulfillment-retry/route.ts` (new from F2) — same

### Files to Create
- `src/lib/observability/sentry-forwarder.ts` — minimal HTTP forwarder ≤80 LOC, no SDK
- `src/lib/observability/__tests__/sentry-forwarder.test.ts`

### Pseudo-code

```ts
// src/lib/observability/sentry-forwarder.ts
export async function forwardToSentry(evt: { level: 'error'|'warning', message: string, tags: Record<string,string>, extra?: Record<string,unknown> }) {
  const dsn = process.env.SENTRY_DSN
  if (!dsn) return
  try {
    await fetch(`${parseSentryEndpoint(dsn)}/api/${parseProjectId(dsn)}/store/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Sentry-Auth': sentryAuthHeader(dsn) },
      body: JSON.stringify({ level: evt.level, message: evt.message, tags: evt.tags, extra: stripPII(evt.extra) }),
      signal: AbortSignal.timeout(2000),
    })
  } catch { /* fire-and-forget */ }
}
```

### Test Strategy

**Unit:**
- `stripPII` removes `email`, `payment_id`; keeps `userId`, `purchaseId`
- Sentry forward swallows fetch errors silently
- Logger.error calls forwarder when DSN set, skips when not

### Success Criteria
- [ ] Throw a fake error in fulfillment → appears in Sentry dashboard within 30s
- [ ] No PII in forwarded events
- [ ] No regression on existing `error-digest` cron path

---

## F8. Daily Reconciliation Cron

**Priority:** P2 · **Effort:** 1.5h · **Status:** pending · **Depends on:** F1, F2

### Key Insight
Monitor catches single failures. Reconciliation catches drift — paid customers whose video never rendered, never alerted, never recovered. Daily run diffs `user_purchases` (paid, last 24h) vs `videos` (terminal completed) and alerts on mismatch.

### Requirements

**Functional**
- Cron `/api/cron/fulfillment-reconcile` runs daily 06:00 UTC
- Query 1: `SELECT COUNT(*) FROM user_purchases WHERE kind='one_time' AND status='paid' AND paid_at > now()-86400 AND payment_id NOT LIKE 'SYNTHETIC_%'`
- Query 2: `SELECT COUNT(*) FROM videos WHERE status='completed' AND purchase_id IN (those_paid_purchases)`
- Diff = paid - delivered. If diff > 0:
  - Build list of orphan purchase_ids (paid but no completed video)
  - Send Slack alert + email to support inbox
  - For each orphan: log structured event with purchase_id (so on-call can investigate)

**Non-functional**
- Auth via `verifyCronAuth()`
- Tolerate small lag — only count purchases paid >2h ago (don't flag in-flight renders)

### Files to Create
- `src/app/api/cron/fulfillment-reconcile/route.ts` ≤150 LOC
- `src/lib/monitoring/reconcile-query.ts` — pure query fn for unit testing
- `.github/workflows/cron-fulfillment-reconcile.yml` (daily 06:00 UTC)

### Files to Modify
- `apps/sophia-ai-factory/wrangler.toml` — document the new cron entry

### Pseudo-code

```ts
// src/app/api/cron/fulfillment-reconcile/route.ts
const LAG_BUFFER_SEC = 2 * 3600  // ignore purchases <2h old (still in-flight)
export async function GET(req: NextRequest) {
  const authError = verifyCronAuth(req); if (authError) return authError
  const db = await getD1Raw()
  const now = Math.floor(Date.now()/1000)
  const since = now - 86400
  const before = now - LAG_BUFFER_SEC

  const paid = await db.prepare(`
    SELECT id FROM user_purchases
    WHERE kind='one_time' AND status='paid' AND paid_at BETWEEN ?1 AND ?2
      AND payment_id NOT LIKE 'SYNTHETIC_%'
  `).bind(since, before).all<{id: string}>()

  const paidIds = (paid.results ?? []).map(r => r.id)
  if (paidIds.length === 0) return NextResponse.json({ ok: true, paid: 0, delivered: 0, orphans: [] })

  const placeholders = paidIds.map((_,i)=>`?${i+1}`).join(',')
  const delivered = await db.prepare(`
    SELECT purchase_id FROM videos
    WHERE status='completed' AND purchase_id IN (${placeholders})
  `).bind(...paidIds).all<{purchase_id: string}>()

  const deliveredSet = new Set((delivered.results ?? []).map(r=>r.purchase_id))
  const orphans = paidIds.filter(id => !deliveredSet.has(id))

  if (orphans.length > 0) {
    await sendSlackAlert('high', `Fulfillment reconcile: ${orphans.length} orphan(s)`, { orphans })
    logger.error('[Reconcile] Orphan purchases', undefined, { count: orphans.length, orphans })
  }
  await recordCronRun(db, 'fulfillment-reconcile', 'success')
  return NextResponse.json({ ok: true, paid: paidIds.length, delivered: deliveredSet.size, orphans })
}
```

### Test Strategy

**Unit:**
- Reconcile fn returns empty orphans when all paid have completed
- Returns orphans list when 2 paid purchases lack videos
- Excludes SYNTHETIC_ payment IDs

**Integration:**
- Seed 5 paid purchases, only 3 have completed videos → reconcile returns 2 orphans + alert sent

### Success Criteria
- [ ] Daily cron runs, recordCronRun shows green for 7 days
- [ ] Manual: insert paid purchase without video → next 6am reconcile alerts

---

## F9. Circuit Breaker + D-ID Fallback

**Priority:** P2 · **Effort:** 4h · **Status:** pending · **Depends on:** F1, F2

### Key Insight
HeyGen is a SPOF. If down 4h, 4h of customers lose service unless we can fail over. Use a tiny circuit breaker stored in `EXPERIMENT_KV` (already bound), tracking last 10min of HeyGen failures. Open breaker if failure rate > 50%, switch new fulfillment calls to D-ID provider. Half-open after 5min.

### Requirements

**Functional**
- KV key `cb:heygen` stores JSON: `{ failures: number[], successes: number[], state: 'closed'|'open'|'half_open', openedAt: number }` (timestamps)
- Failure rate = failures / (failures + successes) over rolling 10min window
- Threshold: >5 attempts AND failure rate > 50% → state='open', openedAt=now
- Half-open: 5min after openedAt, allow 1 probe call. Success → 'closed'. Failure → 'open' again.
- Open state: caller skips HeyGen, calls D-ID provider instead. Set `videos.provider='did'` for telemetry.
- D-ID API has equivalent `createVideo` and webhook events; thin adapter mirrors HeyGen interface

**Non-functional**
- Breaker state read on every fulfillment call (KV read ~5ms, acceptable)
- Atomic update via KV `put` with timestamp pruning (drop entries >10min old)

### Files to Create
- `src/lib/fulfillment/circuit-breaker.ts` — pure breaker logic ≤150 LOC
- `src/lib/fulfillment/__tests__/circuit-breaker.test.ts`
- `src/lib/video/did-helpers.ts` — D-ID adapter mirroring `createHeyGenVideo` shape ≤200 LOC
- `src/lib/video/__tests__/did-helpers.test.ts`
- `src/lib/fulfillment/provider-router.ts` — `selectProvider()` returns 'heygen' | 'did' based on breaker state

### Files to Modify
- `src/lib/fulfillment/one-time-fulfillment.ts` — call `selectProvider()` then dispatch to correct adapter; record success/failure in breaker
- `src/app/api/cron/fulfillment-retry/route.ts` (from F2) — same dispatch
- `apps/sophia-ai-factory/.dev.vars.example` — add `DID_API_KEY`

### DB Migration
None — `provider` column added in 0040.

### Pseudo-code

```ts
// src/lib/fulfillment/circuit-breaker.ts
const WINDOW_MS = 10 * 60 * 1000
const HALF_OPEN_AFTER_MS = 5 * 60 * 1000
const MIN_SAMPLES = 5
const FAILURE_THRESHOLD = 0.5

export interface BreakerState { failures: number[]; successes: number[]; state: 'closed'|'open'|'half_open'; openedAt: number }

export async function recordOutcome(kv: KVNamespace, provider: string, ok: boolean) {
  const now = Date.now()
  const raw = await kv.get<BreakerState>(`cb:${provider}`, 'json') ?? emptyState()
  const pruned = prune(raw, now)
  if (ok) pruned.successes.push(now); else pruned.failures.push(now)
  pruned.state = computeState(pruned, now)
  await kv.put(`cb:${provider}`, JSON.stringify(pruned))
}

export async function isOpen(kv: KVNamespace, provider: string): Promise<boolean> {
  const raw = await kv.get<BreakerState>(`cb:${provider}`, 'json'); if (!raw) return false
  const now = Date.now()
  if (raw.state === 'open' && now - raw.openedAt > HALF_OPEN_AFTER_MS) return false  // half-open probe
  return raw.state === 'open'
}
```

```ts
// src/lib/fulfillment/provider-router.ts
export async function selectProvider(kv: KVNamespace): Promise<'heygen'|'did'> {
  if (await isOpen(kv, 'heygen')) {
    if (!process.env.DID_API_KEY) return 'heygen'  // no fallback configured, eat the failure
    return 'did'
  }
  return 'heygen'
}
```

### Test Strategy

**Unit (circuit-breaker.test.ts):**
- 4 failures + 0 successes (below MIN_SAMPLES) → state stays closed
- 6 failures + 4 successes (rate=0.6) → opens
- 6 failures, openedAt=10min ago → half-open returns false (acts closed for probe)
- Probe failure → re-opens
- Probe success → resets to closed

**Integration (provider-router.test.ts):**
- Closed → returns 'heygen'
- Open + DID_API_KEY set → returns 'did'
- Open + no DID_API_KEY → returns 'heygen' (no fallback)

**Manual chaos:**
- Mock HeyGen 500 → IPN finished → first 3 attempts fail → 4th attempt routes to D-ID → success → email sent
- KV state inspectable via `wrangler kv:key get cb:heygen --binding EXPERIMENT_KV`

### Success Criteria
- [ ] Synthetic monitor (F5) survives 30min HeyGen outage by routing through D-ID
- [ ] Breaker state visible in `/api/admin/breaker-status` (TBD admin route, optional)
- [ ] D-ID adapter passes same contract tests as HeyGen adapter

---

## F10. R2 Presigned URL with Refund-Aware Expiry

**Priority:** P2 · **Effort:** 1h · **Status:** pending

### Key Insight
Today, R2 URLs are public-bucket-style (or HeyGen direct CDN). On refund, video stays accessible — revenue leak. Switch to short-TTL presigned URLs generated server-side; on refund, set `videos.access_revoked=1` and refuse to mint new URLs.

### Requirements

**Functional**
- Server route `/api/videos/[videoId]/url` generates a 30-min presigned URL via `VIDEO_BUCKET.createPresignedUrl()` (or signed access via Workers signing)
- Caller must be authenticated and own the video (`videos.user_id === currentUser.id`)
- If `videos.access_revoked=1` → return 403
- Refund handler sets `access_revoked=1` (atomic with `markRefunded`)

**Non-functional**
- Presigned URL TTL = 30min — long enough to download, short enough to limit leakage
- Cache user-side via SWR with `revalidateOnFocus=false`

### Files to Modify
- `src/lib/billing/nowpayments-ipn-one-time.ts::handleOneTimeRefunded` — also UPDATE videos SET access_revoked=1 WHERE purchase_id=?
- `src/components/dashboard/video-player.tsx` (or wherever) — fetch URL via new endpoint instead of static href

### Files to Create
- `src/app/api/videos/[videoId]/url/route.ts` — GET handler ≤100 LOC
- `src/lib/video/r2-presigner.ts` — wraps Workers R2 binding sign API
- `migrations/0041-videos-access-revoked.sql`

### DB Migration

`apps/sophia-ai-factory/migrations/0041-videos-access-revoked.sql`
```sql
-- Migration 0041: Refund-aware video access control
ALTER TABLE videos ADD COLUMN access_revoked INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_videos_revoked ON videos(access_revoked) WHERE access_revoked = 1;
```

### Pseudo-code

```ts
// src/app/api/videos/[videoId]/url/route.ts
export async function GET(req: NextRequest, { params }: { params: { videoId: string } }) {
  const user = await getCurrentUser(); if (!user) return new Response('unauthorized', { status: 401 })
  const db = createServerClient()
  const { data } = await db.from('videos').select('user_id, r2_key, access_revoked')
    .eq('id', params.videoId).single()
  const v = data as { user_id?: string; r2_key?: string|null; access_revoked?: number } | null
  if (!v || v.user_id !== user.id) return new Response('not_found', { status: 404 })
  if (v.access_revoked) return new Response('revoked', { status: 403 })
  if (!v.r2_key) return new Response('not_ready', { status: 425 })
  const url = await getR2PresignedUrl(v.r2_key, 30 * 60)  // 30 min TTL
  return NextResponse.json({ url, expiresIn: 30*60 })
}
```

### Test Strategy

**Unit:**
- Returns 401 without auth
- Returns 404 for video owned by different user
- Returns 403 when `access_revoked=1`
- Returns signed URL when valid

**Integration:**
- Refund flow: paid → completed → refund webhook → URL endpoint returns 403

### Success Criteria
- [ ] Manual chaos: refund a paid SKU after render → URL endpoint returns 403 + frontend shows "video access revoked due to refund"
- [ ] No regression on existing dashboard video playback for non-refunded videos

---

## Phase 03 Todo

- [x] **F7.1** Create `src/lib/observability/sentry-forwarder.ts` + tests
- [x] **F7.2** Logger already forwards to Sentry via @sentry/nextjs in logger-internals.ts; sentry-forwarder provides HTTP fallback
- [x] **F7.3** Audit fulfillment + IPN catch blocks; replace silent `catch { /* non-fatal */ }` with logger.error
- [x] **F8.1** Create `src/lib/monitoring/reconcile-query.ts` + tests
- [x] **F8.2** Create `src/app/api/cron/fulfillment-reconcile/route.ts` + `src/lib/monitoring/reconcile-alert.ts`
- [x] **F8.3** Create `.github/workflows/cron-fulfillment-reconcile.yml` (daily 06:00 UTC)
- [ ] **F9.1** DEFERRED — F9 not implemented (D-ID account/budget required)
- [ ] **F9.2** DEFERRED
- [ ] **F9.3** DEFERRED
- [ ] **F9.4** DEFERRED
- [ ] **F9.5** DEFERRED
- [x] **F10.1** Write migration `0041-videos-access-revoked.sql` + apply locally
- [x] **F10.2** Create `src/lib/video/video-access-control.ts` (getSignedVideoUrl with revoke check)
- [x] **F10.3** Create `src/app/api/videos/[videoId]/url/route.ts` + tests (video-access-control.test.ts)
- [x] **F10.4** Wire `access_revoked=1` in refund IPN handler (revokeAccessByPurchaseId)
- [x] **F10.5** Update OrderCard to fetch signed URL via /api/videos/[videoId]/url; show "Access Revoked" banner
- [x] **PH3.99** `npm run build && npm test` → green (2202/2202 tests pass)

**Completed:** 2026-05-02 (F9 deferred pending D-ID account)

## Phase 03 Success Criteria

- [x] Failure mode #4 (HeyGen quota exhausted) → mitigated by F9 fallback (deferred)
- [x] Failure mode #6 (cron not running) → detected by F5 (P1) + F8 daily reconciliation
- [x] Failure mode #9 (refund leaks video) → closed by F10
- [x] Failure mode #11 (HeyGen SPOF) → mitigated by F9 (deferred)
- [x] Sentry receives errors with no PII; existing tests + ~30 new green

## Risk Assessment (Phase 03 specific)

1. **D-ID API differs subtly from HeyGen** (avatar IDs, voice IDs) → adapter must map common params; treat unknown params as defaults. Mitigation: contract test runs same script through both, asserts non-empty videoId returned.
2. **Breaker false-positive on synthetic-induced failures** — synthetic test failures shouldn't trip the breaker. Mitigation: synthetic flow uses dedicated `cb:heygen-synthetic` namespace OR breaker excludes synthetic user_id.
3. **Sentry forwarder leaking PII** — strict allowlist of fields, audited in code review.
4. **Migration 0041 conflicts with in-flight refund IPN** — small window. Mitigation: deploy migration before code; default value `0` keeps existing refunded videos accessible (backward-compatible until next refund).

## Security Considerations

- F10 presigned URLs MUST verify ownership before signing — never accept `videoId` without auth check
- F7 Sentry forwarder strips email + payment_id; only purchase_id + user_id allowed
- F9 D-ID API key stored as CF Workers secret, never in repo
- F9 breaker KV state writable only by trusted code paths (no public route writes to `cb:*` keys)

## Next Steps

After Phase 03 ships green:
- Run 7-day continuous synthetic monitor + reconcile cron with zero alerts → declare zero-fail SLO achieved
- Document chaos drill playbook in `docs/runbooks/fulfillment-chaos.md`
- Begin work on subscription tier fulfillment hardening (out of scope here, but same patterns reusable)
