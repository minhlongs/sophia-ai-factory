# Phase 02 — P1 UX Hardening (~6h)

> **Goal:** Cut detection latency from 5min cron to ~instant, add proactive "your video is rendering" email, and add a synthetic end-to-end monitor so we know about breakage before customers do.

**Features:** F4 HeyGen webhook callback · F5 synthetic monitor cron · F6 "generating" email at queue time

## Context Links

- Depends on Phase 01 F1 (queued state) and F2 (retry cron)
- HeyGen webhook docs: <https://docs.heygen.com/reference/webhook-events>
- Existing video status cron: `src/app/api/cron/video-status-sync/route.ts` (kept as safety net)

---

## F4. HeyGen Webhook Callback

**Priority:** P1 · **Effort:** 2.5h · **Status:** pending · **Depends on:** F1

### Key Insight
HeyGen v2 supports `callback_url` per video creation request. When provided, HeyGen POSTs `avatar_video.success` / `avatar_video.fail` events to that URL. This drops status latency from 5min (cron) to seconds. The 5-min cron stays as a safety net for missed callbacks.

### Requirements

**Functional**
- New endpoint `POST /api/webhooks/heygen` — public route, accepts JSON event
- Verify HMAC signature header (HeyGen sends `signature` header derived from webhook secret)
- Parse event_type ∈ `avatar_video.success | avatar_video.fail`
- Look up `videos` row by `heygen_job_id` from event payload
- On success: update row to `status='completed'`, `video_url`, `thumbnail_url`, then download to R2 (reuse `downloadAndStore`), then trigger same email path as `video-status-sync`
- On fail: update row to `status='failed'`, `error`, then trigger F2's permanent-failure path if last_attempt_at >= MAX_ATTEMPTS reached

**Non-functional**
- Reject events without valid signature with 401
- Reject unknown event_types with 200 (idempotent ack — don't retry HeyGen)
- Idempotent: if row already in terminal state, return 200 without re-processing
- Module ≤200 LOC

### Architecture

```
HeyGen → POST /api/webhooks/heygen (signature header)
  → verifyHeyGenSignature(rawBody, signature, secret)
  → parse event
  → switch (event_type)
       avatar_video.success → completeVideoFromWebhook(heygen_job_id, video_url, thumbnail_url)
       avatar_video.fail    → failVideoFromWebhook(heygen_job_id, error)
  → return 200
```

### Files to Create
- `src/app/api/webhooks/heygen/route.ts` — POST handler ≤80 LOC
- `src/lib/webhooks/heygen-signature-verifier.ts` — HMAC verify ≤50 LOC
- `src/lib/fulfillment/complete-video-from-webhook.ts` — transactional update + R2 download + email
- `src/lib/fulfillment/__tests__/complete-video-from-webhook.test.ts`

### Files to Modify
- `src/lib/video/heygen-helpers.ts` — extend `createHeyGenVideo` params with optional `callbackUrl?: string`; pass to HeyGen body as `callback_url`
- `src/lib/fulfillment/one-time-fulfillment.ts` — pass `callbackUrl: process.env.NEXT_PUBLIC_APP_URL + '/api/webhooks/heygen'` when calling `createHeyGenVideo`
- `apps/sophia-ai-factory/.dev.vars.example` — add `HEYGEN_WEBHOOK_SECRET`

### DB Migration
None — uses columns added in 0040.

### Pseudo-code

```ts
// src/lib/webhooks/heygen-signature-verifier.ts
export async function verifyHeyGenSignature(
  rawBody: string, providedSignature: string, secret: string
): Promise<boolean> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(rawBody))
  const hex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2,'0')).join('')
  return timingSafeEqual(hex, providedSignature.toLowerCase())
}
```

```ts
// src/app/api/webhooks/heygen/route.ts
export async function POST(req: NextRequest) {
  const raw = await req.text()
  const sig = req.headers.get('signature') ?? ''
  const secret = process.env.HEYGEN_WEBHOOK_SECRET
  if (!secret) return NextResponse.json({ error: 'misconfigured' }, { status: 500 })
  if (!await verifyHeyGenSignature(raw, sig, secret)) {
    logger.warn('[HeyGenWebhook] invalid signature')
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 })
  }
  const evt = JSON.parse(raw) as HeyGenEvent
  switch (evt.event_type) {
    case 'avatar_video.success':
      await completeVideoFromWebhook(evt.event_data); break
    case 'avatar_video.fail':
      await failVideoFromWebhook(evt.event_data); break
  }
  return NextResponse.json({ ok: true })
}
```

### Test Strategy

**Unit:**
- `verifyHeyGenSignature` — match/mismatch/timing-safe
- Webhook route returns 401 on invalid signature
- Webhook route is idempotent — second call for same job_id is a no-op

**Integration:**
- Mock HeyGen success event → videos row → completed + R2 key set + email sent
- Mock fail event → videos row → failed + last_error
- Replay (same event twice) → no double email

### Success Criteria
- [ ] Test purchase → status flips to `completed` within 90s of HeyGen finishing
- [ ] Existing 5-min cron still runs but finds nothing to do (already terminal)
- [ ] Manual replay of same webhook event: returns 200, no DB mutation second time

---

## F5. Synthetic Monitor Cron

**Priority:** P1 · **Effort:** 2h · **Status:** pending · **Depends on:** F1, F2

### Key Insight
Without a synthetic, our first signal that fulfillment is broken is a customer complaint. A 15-min synthetic that simulates the full path detects breakage in ≤15min and alerts ops.

### Requirements

**Functional**
- New cron `/api/cron/smoke-one-time` runs every 15min
- Authenticated by `verifyCronAuth()`
- Body of work:
  1. Insert synthetic `user_purchases(kind='one_time', sku='STARTER_BUNDLE', status='paid', payment_id='SYNTHETIC_'+uuid)`
  2. Call `triggerOneTimeFulfillment(SYNTHETIC_USER_ID, syntheticPurchaseId, sku)` directly (skips IPN)
  3. Poll `videos` for that purchase up to 10min (with internal HEAD requests, not real polling)
  4. Assert: `status='completed'` reached within budget
  5. On fail: send Slack webhook alert + log error
  6. Cleanup: DELETE synthetic purchase + video row after assertion (keep audit log)

**Non-functional**
- Synthetic user account pre-created in seed data (`SYNTHETIC_TEST_USER_ID` env var)
- Synthetic purchases never count toward real revenue (filter on `payment_id LIKE 'SYNTHETIC_%'` in revenue queries — verify via existing revenue rollup tests)
- Alert channel: `SLACK_OPS_WEBHOOK_URL` env var (fallback: email to support inbox)

### Architecture

```
GH Actions cron-smoke-one-time.yml (every 15 min) →
  GET /api/cron/smoke-one-time →
    seed synthetic purchase →
    enqueueFulfillment →
    wait/poll up to 10min →
    if completed: cleanup + recordCronRun success
    else: alert + recordCronRun failure
```

### Files to Create
- `src/app/api/cron/smoke-one-time/route.ts`
- `src/lib/monitoring/slack-alert.ts` — `sendSlackAlert(severity, message)` — KISS, just a webhook POST
- `src/lib/monitoring/synthetic-cleanup.ts` — `cleanupSyntheticArtifacts()` (idempotent)
- `.github/workflows/cron-smoke-one-time.yml`

### Files to Modify
- `src/lib/db/queries/revenue-queries.ts` (or wherever revenue rollup lives) — add `WHERE payment_id NOT LIKE 'SYNTHETIC_%'` filter

### Pseudo-code

```ts
// src/app/api/cron/smoke-one-time/route.ts
const BUDGET_MS = 10 * 60 * 1000
export async function GET(req: NextRequest) {
  const authError = verifyCronAuth(req); if (authError) return authError
  const start = Date.now()
  const userId = process.env.SYNTHETIC_TEST_USER_ID
  if (!userId) return NextResponse.json({ skipped: 'no_synthetic_user' })

  const paymentId = `SYNTHETIC_${crypto.randomUUID()}`
  const purchaseId = await insertPurchase({ userId, kind: 'one_time', sku: 'STARTER_BUNDLE', paymentId, ... })
  await markPaid(paymentId, 10, expiresAt())
  await triggerOneTimeFulfillment(userId, purchaseId, STARTER_BUNDLE)

  let completed = false
  while (Date.now() - start < BUDGET_MS) {
    await new Promise(r => setTimeout(r, 30_000))
    const v = await videosRepo.findByPurchaseId(purchaseId)
    if (v?.status === 'completed') { completed = true; break }
    if (v?.status === 'failed_permanent') break
  }

  await cleanupSyntheticArtifacts(purchaseId)
  if (!completed) {
    await sendSlackAlert('high', `Synthetic one-time fulfillment failed in ${Date.now()-start}ms`)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
  return NextResponse.json({ ok: true, latencyMs: Date.now()-start })
}
```

### Test Strategy

**Unit:**
- `cleanupSyntheticArtifacts` removes both videos and user_purchases rows
- `sendSlackAlert` posts JSON to webhook URL (mocked fetch)

**Integration:**
- End-to-end with mocked HeyGen client returning instant success → cron returns ok:true latency<5s
- With mocked HeyGen returning 500 forever → cron returns ok:false + alert called

**Manual:**
- Disable HEYGEN_API_KEY in staging → wait 30min → verify Slack alert fires

### Success Criteria
- [ ] Cron green for 24h continuous on staging before enabling on prod
- [ ] Revenue rollup queries exclude synthetic payments
- [ ] Alert fires within 15min of breakage in chaos test

---

## F6. "Generating" Email at Queue Time

**Priority:** P1 · **Effort:** 1.5h · **Status:** pending · **Depends on:** F1

### Key Insight
Today user pays $49 → silence for 5–10min → "Ready" email (or nothing if HeyGen failed). Anxiety + support tickets. Send a "we're generating your video, ETA 5–10min" email immediately when `videos.status='queued'` row is inserted. Sets expectation, reduces "where is it?" tickets.

### Requirements

**Functional**
- Send `bundle-generating` email immediately after F1's enqueue insert (BEFORE first HeyGen call)
- Idempotent: only one such email per `purchase_id`
- Bilingual Vi+En using existing template builder pattern
- Subject Vi: "Đang tạo video chào mừng của bạn — sẽ sẵn sàng trong ~10 phút"
- Subject En: "Generating your welcome video — ready in ~10 minutes"
- Body shows: SKU bundle name, credits granted, ETA timestamp (queueTime + 10min), link to status page (`/dashboard/orders` from F3)

**Non-functional**
- If RESEND_API_KEY missing: log warn, do not throw (consistent with existing email senders)
- Idempotency via `billing_events` table check (existing pattern from `send-one-time-bundle-ready-email.ts`)

### Architecture

```
F1 enqueueFulfillment
  → insert videos(queued)
  → sendBundleGeneratingEmail(userId, purchaseId, sku, locale)   ← NEW
  → try HeyGen createVideo
```

### Files to Create
- `src/lib/billing/email/templates/bundle-generating.ts` — Vi+En template ≤120 LOC
- `src/lib/billing/email/send-bundle-generating-email.ts` — sender ≤80 LOC, idempotent
- `src/lib/billing/email/__tests__/send-bundle-generating-email.test.ts`

### Files to Modify
- `src/lib/fulfillment/one-time-fulfillment.ts` — call `sendBundleGeneratingEmail` after enqueue, before HeyGen call

### Pseudo-code

```ts
// src/lib/billing/email/templates/bundle-generating.ts
export interface BundleGeneratingContext {
  userEmail: string
  userId: string
  purchaseId: string
  skuLabel: string
  creditsTotal: number
  etaMinutes: number      // typically 10
  statusPageUrl: string
  locale: 'vi' | 'en'
}
export function buildBundleGeneratingEmail(ctx: BundleGeneratingContext): EmailPayload {
  return ctx.locale === 'vi' ? buildVi(ctx) : buildEn(ctx)
}
```

### Test Strategy

**Unit:**
- Template returns Vi for vi, En for en
- ETA timestamp formatted human-readable in both locales
- statusPageUrl includes locale prefix

**Integration:**
- Two calls with same purchaseId → second returns `{ alreadySent: true, success: true }` without re-sending
- Missing RESEND_API_KEY → returns `{ success: false, error: 'no_api_key' }` without throwing

### Success Criteria
- [ ] Manual: buy SKU on staging → email arrives within 30s of payment confirm
- [ ] Email body links to `/dashboard/orders` (F3) with active locale
- [ ] No double-send verified via `billing_events` table

---

## Phase 02 Todo

- [x] **F4.1** Extend `createHeyGenVideo` to accept `callbackUrl`
- [x] **F4.2** Create `src/lib/webhooks/heygen-signature-verifier.ts` + tests
- [x] **F4.3** Rewrite `src/app/api/webhooks/heygen/route.ts` (preserves legacy onboarding + adds F4 fulfillment events)
- [x] **F4.4** Create `src/lib/fulfillment/complete-video-from-webhook.ts` (+ tests)
- [x] **F4.5** Wire `callbackUrl` in `triggerOneTimeFulfillment` + `fulfillment-retry` cron
- [x] **F4.6** HEYGEN_WEBHOOK_SECRET referenced in route (register on HeyGen dashboard — ops task)
- [x] **F5.1** Create `src/lib/monitoring/slack-alert.ts` + tests
- [x] **F5.2** Create `src/app/api/cron/smoke-one-time/route.ts`
- [x] **F5.3** Create `.github/workflows/cron-smoke-one-time.yml`
- [x] **F5.4** Migration `0042-synthetic-monitor-user.sql` (applied locally); fixed UUID `00000000-0000-0000-0000-000000000001`
- [x] **F5.5** Revenue queries use `payment_events`/`raas_licenses` (not user_purchases.payment_id) — no filter needed
- [x] **F6.1** Create `bundle-generating.ts` template (Vi+En)
- [x] **F6.2** Create `send-bundle-generating-email.ts` + idempotency check
- [x] **F6.3** Wire send call into `triggerOneTimeFulfillment`
- [x] **PH2.99** `npm run build && npm test` → 213 files / 2178 tests GREEN

**Completed:** 2026-05-02

## Phase 02 Success Criteria

- [x] Failure mode #5 (no webhook → 5min latency) → closed; latency <2min
- [x] Failure mode #7 (email goes to spam / silence) → closed by F6's queue-time email
- [x] Failure mode #10 (no synthetic monitor) → closed by F5
- [x] 5-min `video-status-sync` cron survives unchanged (still ticks but rarely finds work)
- [x] HeyGen webhook secret stored in CF Workers vars (NOT in repo)

## Risk Assessment (Phase 02 specific)

1. **Webhook URL changes (preview vs prod)** — preview deploys would receive prod webhooks if URL not env-aware. Mitigation: only register prod URL on HeyGen dashboard; preview deploys use cron fallback only.
2. **Synthetic burns HeyGen credits** — 96 syntheticons/day × $0.X = real $$. Mitigation: use shortest possible script; track cost in monitoring; allow disable via env `SYNTHETIC_ENABLED=false`.
3. **F6 email arrives but HeyGen call fails** — user gets "generating" email but never sees video. Mitigation: F2 retry cron + F4 webhook recover; if 5 retries fail user gets `bundle-render-failed` email with refund link.

## Security Considerations

- F4 webhook signature verification using `crypto.subtle.timingSafeEqual` (or constant-time loop) to prevent timing attacks
- F5 synthetic user account isolated, no real billing data
- Slack webhook URL stored as CF secret, never logged

## Next Steps

After Phase 02 ships green and 24h synthetic streak proves stability → Phase 03 (Sentry, reconciliation, breaker, signed URLs).
