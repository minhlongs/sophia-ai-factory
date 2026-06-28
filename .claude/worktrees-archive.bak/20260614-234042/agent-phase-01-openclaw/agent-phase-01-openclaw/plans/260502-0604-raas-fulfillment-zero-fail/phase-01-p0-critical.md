# Phase 01 — P0 Critical (must-ship today, ~6h)

> **Goal:** A paid customer can never end up with no video and no recovery path. Every paid one-time purchase has a durable `videos` row from second one, retried on failure, surfaced in a status page.

**Features:** F1 queue-first persistence · F2 retry cron · F3 customer status page

## Context Links

- Source audit: `plans/260502-0508-raas-one-time-zero-bug/` (happy path) + 11-failure-mode audit injected by user
- Existing fulfillment: `apps/sophia-ai-factory/src/lib/fulfillment/one-time-fulfillment.ts`
- Existing IPN: `apps/sophia-ai-factory/src/lib/billing/nowpayments-ipn-one-time.ts`
- Existing cron: `apps/sophia-ai-factory/src/app/api/cron/video-status-sync/route.ts`
- Existing repo: `apps/sophia-ai-factory/src/lib/db/repositories/user-purchases-repo.ts`
- Migrations dir: `apps/sophia-ai-factory/migrations/` (last = `0039-videos-purchase-id.sql`)

---

## F1. Persist Intent BEFORE HeyGen Call

**Priority:** P0 · **Effort:** 1.5h · **Status:** pending

### Key Insight
Today, `triggerOneTimeFulfillment` only inserts `videos` row AFTER HeyGen succeeds. If HeyGen 5xx → silent return → no row → nothing to retry. Flip the order: insert `videos(status='queued')` first, then call HeyGen, then update `status='processing'` + `heygen_job_id`. Failure leaves a queued row that F2 will pick up.

### Requirements

**Functional**
- Insert `videos` row with `status='queued'` BEFORE HeyGen call
- New columns: `attempt_count INTEGER DEFAULT 0`, `last_attempt_at INTEGER`, `last_error TEXT`, `script TEXT`, `locale TEXT`
- HeyGen failure path leaves row recoverable (status stays `queued`, increments `attempt_count`, stores `last_error`)
- HeyGen success path updates row to `status='processing'` + sets `heygen_job_id`
- Email/locale fetched once at queue time, persisted to row (avoids re-fetching during retry; also fixes failure mode #2 where missing email blocks fulfillment — we now queue regardless and skip email send if email is missing later)

**Non-functional**
- Idempotent: if `videos` row already exists for `purchase_id`, do not double-insert
- Module ≤200 LOC

### Architecture

```
IPN finished
  → markPaid                       (existing)
  → enqueueFulfillment(userId, purchaseId, sku)         ← NEW NAME
       1. Fetch user.email + locale
       2. Insert videos(status='queued', purchase_id, script, locale, ...)
       3. Try createHeyGenVideo
          → success: UPDATE videos SET status='processing', heygen_job_id, attempt_count=1
          → failure: UPDATE videos SET attempt_count=1, last_attempt_at, last_error
       4. Return (always non-throwing for caller)
```

### Files to Modify
- `src/lib/fulfillment/one-time-fulfillment.ts` — rewrite `triggerOneTimeFulfillment` → `enqueueFulfillment` (keep export name for compatibility, internal flip)
- `src/lib/billing/nowpayments-ipn-one-time.ts` — no change to call site (still `triggerOneTimeFulfillment`)
- `src/lib/db/repositories/videos-repo.ts` — NEW (create) — typed CRUD for new columns

### Files to Create
- `src/lib/db/repositories/videos-repo.ts` — `enqueueVideo`, `markVideoProcessing`, `recordAttempt`, `markPermanentFailure`
- `src/lib/fulfillment/__tests__/one-time-fulfillment.test.ts` — extend existing tests

### DB Migration

`apps/sophia-ai-factory/migrations/0040-videos-fulfillment-state.sql`
```sql
-- Migration 0040: Extend videos table for fulfillment retry state machine
-- Adds queued/failed_permanent statuses + retry bookkeeping fields.

ALTER TABLE videos ADD COLUMN attempt_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE videos ADD COLUMN last_attempt_at INTEGER;
ALTER TABLE videos ADD COLUMN last_error TEXT;
ALTER TABLE videos ADD COLUMN script TEXT;
ALTER TABLE videos ADD COLUMN locale TEXT;
ALTER TABLE videos ADD COLUMN provider TEXT NOT NULL DEFAULT 'heygen';

-- Status CHECK relaxation: D1/SQLite cannot ALTER CHECK; we manage in app layer.
-- New valid values: 'queued', 'processing', 'completed', 'failed', 'failed_permanent'

CREATE INDEX IF NOT EXISTS idx_videos_status_queued
  ON videos(status, created_at) WHERE status = 'queued';

CREATE INDEX IF NOT EXISTS idx_videos_purchase_status
  ON videos(purchase_id, status) WHERE purchase_id IS NOT NULL;
```

### Pseudo-code

```ts
// src/lib/fulfillment/one-time-fulfillment.ts (rewrite)
export async function triggerOneTimeFulfillment(userId, purchaseId, sku) {
  const { email, locale } = await fetchUser(userId)
  const script = getOneTimeWelcomeScript(sku, locale ?? 'vi')
  const title = `Welcome Bundle — ${sku.id} — ${userId.slice(0,8)}`

  // 1. Idempotent enqueue
  const existing = await videosRepo.findByPurchaseId(purchaseId)
  if (existing) return // already queued, F2 will handle

  const videoId = await videosRepo.enqueueVideo({
    userId, purchaseId, title, script, locale: locale ?? 'vi',
    status: 'queued', provider: 'heygen',
  })

  // 2. First attempt (synchronous, fail-soft)
  const apiKey = process.env.HEYGEN_API_KEY
  if (!apiKey) {
    await videosRepo.recordAttempt(videoId, 'no_api_key')
    return // F2 retry will pick up
  }

  try {
    const { videoId: heygenJobId } = await createHeyGenVideo({ script, title, apiKey })
    await videosRepo.markVideoProcessing(videoId, heygenJobId)
  } catch (err) {
    await videosRepo.recordAttempt(videoId, errorMessage(err))
    // do NOT throw — caller is non-fatal; F2 will retry
  }
}
```

### Test Strategy

**Unit (videos-repo.test.ts):**
- enqueueVideo writes correct columns
- enqueueVideo returns existing id when called twice with same purchase_id
- recordAttempt increments count + stores error

**Integration (one-time-fulfillment.test.ts):**
- HeyGen success → videos row status='processing', heygen_job_id set
- HeyGen 500 → videos row status='queued', attempt_count=1, last_error set
- Missing API key → status='queued', attempt_count=1, last_error='no_api_key'
- Missing user email → still enqueues (email checked at delivery time, not queue time)

### Success Criteria
- [ ] Migration 0040 applied locally + remote
- [ ] After IPN finished, `videos` row exists with `purchase_id` set, regardless of HeyGen outcome
- [ ] HeyGen failure does NOT log error to logger.error (only logger.warn) — recoverable state
- [ ] All existing tests pass

---

## F2. Fulfillment Retry Cron

**Priority:** P0 · **Effort:** 2.5h · **Status:** pending · **Depends on:** F1

### Key Insight
A queued video with `attempt_count<5` and last attempt >30s ago should be retried with exponential backoff. After 5 failed attempts (~1h elapsed), mark `failed_permanent`, send failure email, grant +1 credit as compensation.

### Requirements

**Functional**
- New cron `/api/cron/fulfillment-retry` runs every 2min
- Selects rows: `status='queued' AND attempt_count<5 AND (last_attempt_at IS NULL OR last_attempt_at < now() - backoff(attempt_count))`
- Backoff schedule (seconds): `[30, 60, 300, 900, 3600]` (30s, 1m, 5m, 15m, 1h)
- On retry success: same path as F1's HeyGen-success branch
- On 5th failure: `status='failed_permanent'`, send `bundle-render-failed` email (Vi+En), grant +1 credit via `user_purchases.credits_remaining += 1`
- Cap 20 rows per run to stay under CPU budget

**Non-functional**
- Auth: `verifyCronAuth()`
- Idempotent: handle case where another worker concurrently flipped row to `processing`
- Tracked via `recordCronRun()`

### Architecture

```
GH Actions cron-fulfillment-retry.yml (every 2min) →
  GET /api/cron/fulfillment-retry →
    SELECT queued rows where backoff window elapsed →
    For each:
      - increment attempt_count
      - if attempt > 5 → mark failed_permanent + email + +1 credit
      - else → call createHeyGenVideo → on success markVideoProcessing
                                       → on failure recordAttempt
```

### Files to Create
- `src/app/api/cron/fulfillment-retry/route.ts` — cron handler
- `src/lib/fulfillment/retry-backoff.ts` — pure fn `nextRetryAt(attemptCount, lastAttemptAt) → epochSec`
- `src/lib/fulfillment/compensation.ts` — `grantCompensationCredit(purchaseId, reason)` (idempotent via audit log check)
- `src/lib/billing/email/templates/bundle-render-failed.ts` — Vi+En template
- `src/lib/billing/email/send-bundle-render-failed-email.ts` — sender (idempotent)
- `.github/workflows/cron-fulfillment-retry.yml` — 2-min schedule

### Files to Modify
- `apps/sophia-ai-factory/wrangler.toml` — add `*/2 * * * *` documentation comment (cron triggered via GH Actions, not CF crons)

### Pseudo-code

```ts
// src/lib/fulfillment/retry-backoff.ts
const BACKOFF_SCHEDULE_SEC = [30, 60, 300, 900, 3600]
export function nextRetryAt(attemptCount: number, lastAttemptAt: number | null): number {
  if (lastAttemptAt === null) return 0
  const idx = Math.min(attemptCount - 1, BACKOFF_SCHEDULE_SEC.length - 1)
  return lastAttemptAt + BACKOFF_SCHEDULE_SEC[idx]
}
export const MAX_ATTEMPTS = 5
```

```ts
// src/app/api/cron/fulfillment-retry/route.ts (skeleton)
export async function GET(req: NextRequest) {
  const authError = verifyCronAuth(req); if (authError) return authError
  const db = await getD1Raw()
  const now = Math.floor(Date.now()/1000)

  const rows = await db.prepare(`
    SELECT id, user_id, purchase_id, script, locale, attempt_count, last_attempt_at
    FROM videos
    WHERE status = 'queued' AND attempt_count < ?1
    LIMIT 20
  `).bind(MAX_ATTEMPTS).all()

  const summary = { retried: 0, succeeded: 0, failed: 0, permanent: 0 }
  const apiKey = process.env.HEYGEN_API_KEY

  for (const row of rows.results ?? []) {
    if (now < nextRetryAt(row.attempt_count, row.last_attempt_at)) continue
    summary.retried++
    if (row.attempt_count + 1 >= MAX_ATTEMPTS && !apiKey) {
      await markPermanentFailure(row); summary.permanent++; continue
    }
    try {
      const { videoId } = await createHeyGenVideo({ script: row.script, apiKey })
      await markVideoProcessing(row.id, videoId)
      summary.succeeded++
    } catch (err) {
      await recordAttempt(row.id, errorMessage(err))
      if (row.attempt_count + 1 >= MAX_ATTEMPTS) {
        await markPermanentFailure(row.id)
        await grantCompensationCredit(row.purchase_id, 'render_failed_permanent')
        await sendBundleRenderFailedEmail({ purchaseId: row.purchase_id, locale: row.locale })
        summary.permanent++
      } else {
        summary.failed++
      }
    }
  }

  await recordCronRun(db, 'fulfillment-retry', 'success')
  return NextResponse.json({ ok: true, ...summary })
}
```

### Test Strategy

**Unit (retry-backoff.test.ts):**
- attempt 0 → retry immediately (lastAttemptAt null)
- attempt 1 with last=t → next at t+30
- attempt 5 → not retried (caller checks MAX_ATTEMPTS)

**Integration (fulfillment-retry.route.test.ts):**
- 3 queued rows, 2 within backoff window, 1 outside → only 1 retried
- HeyGen succeeds on retry → row → processing
- HeyGen fails 5th attempt → row → failed_permanent + compensation credit row + email tracked

**Manual chaos test:**
- Set HEYGEN_API_KEY=invalid → IPN finished → wait 65min → assert email received + credits_remaining incremented

### Success Criteria
- [ ] Cron executes every 2min, audit row in `cron_runs`
- [ ] After 5 failed attempts, customer gets failure email + +1 credit grant logged in audit
- [ ] No duplicate compensation credits (idempotency via audit_log check)
- [ ] Existing `video-status-sync` cron unaffected (still scans `status='processing'` only)

---

## F3. Customer Status Page `/dashboard/orders`

**Priority:** P0 · **Effort:** 2h · **Status:** pending · **Depends on:** F1

### Key Insight
Today there is no place a paid customer can answer "where is my video?" without bothering support. Need a single timeline view: Paid (IPN) → Queued (videos.status=queued) → Rendering (status=processing) → Ready (status=completed) — with timestamps, ETA, and credit balance.

### Requirements

**Functional**
- Route: `/[locale]/dashboard/orders` (auth required, locale-aware Vi+En)
- Lists `user_purchases` where `kind='one_time'` ordered DESC, joined to `videos.status` via `purchase_id`
- Each card shows: SKU title, payment status, video status timeline, credits remaining, retry attempts (if >0), estimated ready time
- SWR refetch every 30s for in-flight rows (`status IN queued|processing`)
- "Download video" button when `videos.status='completed'` → links to `/dashboard/videos`

**Non-functional**
- Bilingual via `next-intl` (existing pattern)
- Mobile responsive
- Accessibility: timeline uses `<ol>` with `aria-current` on active step

### Architecture

```
/[locale]/dashboard/orders/page.tsx           (server component, initial load)
  → calls /api/orders                          (server action OR route)
    → SELECT user_purchases JOIN videos
    → returns OrderTimelineRow[]
  → renders <OrderCard> per row (client component, SWR)
```

### Files to Create
- `src/app/[locale]/dashboard/orders/page.tsx` — server component
- `src/app/[locale]/dashboard/orders/order-card.tsx` — client component, SWR, ≤150 LOC
- `src/app/[locale]/dashboard/orders/order-timeline.tsx` — pure presentational (Paid→Queued→Rendering→Ready)
- `src/app/api/orders/route.ts` — GET handler, returns user's orders
- `src/lib/orders/order-query.ts` — DB join logic
- `src/lib/orders/order-types.ts` — TS types
- `src/messages/en/orders.json` + `vi/orders.json` — i18n strings

### Files to Modify
- `src/app/[locale]/dashboard/layout.tsx` — add "Orders" nav link

### Pseudo-code

```ts
// src/lib/orders/order-query.ts
export interface OrderTimelineRow {
  purchaseId: string
  sku: string
  status: 'pending' | 'paid' | 'refunded' | 'failed'
  paidAt: number | null
  creditsRemaining: number
  videoStatus: 'queued' | 'processing' | 'completed' | 'failed' | 'failed_permanent' | null
  videoId: string | null
  attemptCount: number
  estimatedReadyAt: number | null   // paidAt + 8min default
}

export async function getUserOrders(userId: string): Promise<OrderTimelineRow[]> {
  const db = await getD1Raw()
  const rows = await db.prepare(`
    SELECT
      p.id AS purchase_id, p.sku, p.status, p.paid_at, p.credits_remaining,
      v.id AS video_id, v.status AS video_status, v.attempt_count
    FROM user_purchases p
    LEFT JOIN videos v ON v.purchase_id = p.id
    WHERE p.user_id = ?1 AND p.kind = 'one_time'
    ORDER BY p.created_at DESC
    LIMIT 50
  `).bind(userId).all()
  return (rows.results ?? []).map(toOrderTimelineRow)
}
```

### Test Strategy

**Unit (order-query.test.ts):**
- Returns empty array for user with no purchases
- Joins correctly when video row exists
- Returns null videoStatus when no video row yet

**Component (order-card.test.tsx):**
- Renders Vi strings for vi locale
- Shows "Retry attempt 2/5" when attemptCount=2
- Hides download button when status != completed

**Manual:**
- Buy test SKU on staging → orders page shows queued within 5s → rendering within 30s → ready within 8min

### Success Criteria
- [ ] Page loads <500ms TTFB
- [ ] SWR auto-refresh works for in-flight orders
- [ ] No `:any` types
- [ ] Vi + En strings both rendered, verified via locale switch

---

## Phase 01 Todo

- [x] **F1.1** Write migration `0040-videos-fulfillment-state.sql`
- [x] **F1.2** Apply migration locally via `wrangler d1 execute --local`
- [x] **F1.3** Create `src/lib/db/repositories/videos-repo.ts`
- [x] **F1.4** Rewrite `triggerOneTimeFulfillment` to queue-first
- [x] **F1.5** Tests: retry-backoff.test.ts + order-query.test.ts (2136→2152 tests)
- [x] **F2.1** Create `src/lib/fulfillment/retry-backoff.ts` + tests
- [x] **F2.2** Create `src/lib/fulfillment/compensation.ts`
- [x] **F2.3** Create `src/lib/billing/email/templates/bundle-render-failed.ts` (Vi+En)
- [x] **F2.4** Create `src/lib/billing/email/send-bundle-render-failed-email.ts` (idempotent)
- [x] **F2.5** Create `src/app/api/cron/fulfillment-retry/route.ts`
- [x] **F2.6** Create `.github/workflows/cron-fulfillment-retry.yml`
- [x] **F3.1** Create `src/lib/orders/order-query.ts` + `order-types.ts`
- [x] **F3.2** Create `src/app/api/orders/route.ts` GET handler
- [x] **F3.3** Create `src/app/[locale]/dashboard/orders/page.tsx` server component
- [x] **F3.4** Create `order-card.tsx` + `order-timeline.tsx` client components
- [x] **F3.5** Add `sidebar.orders` to messages/en.json + vi.json
- [x] **F3.6** Add nav link (ShoppingBag + sidebar.orders) in `dashboard/layout.tsx`
- [x] **PH1.99** `npm run build` → 0 errors · `npm test` → 2152/2152 pass

**Completed:** 2026-05-02

## Phase 01 Success Criteria

- [x] All 11 failure mode #1, #3 (HeyGen failure recoverable, paid-but-no-row prevented) — fully closed
- [x] Failure mode #2 (missing email) downgraded — purchase still queues, email skipped at delivery only
- [x] Failure mode #8 (no realtime dashboard) — closed by F3 SWR
- [x] No regression on existing `video-status-sync` cron path
- [x] Manual chaos: revoke HEYGEN_API_KEY → buy SKU → 5 retries over 1h → permanent fail → email + compensation credit

## Risk Assessment (Phase 01 specific)

1. **Migration ALTER TABLE on prod D1 with rows in flight** — D1 ALTER is fast for empty/small tables. Mitigation: run migration during low-traffic window; default values keep existing rows valid.
2. **Cron drift between 5-min poll (status-sync) and 2-min retry (fulfillment-retry)** — could double-update a row. Mitigation: status-sync only touches `status='processing'`, retry-cron only touches `status='queued'` — disjoint sets.
3. **F3 page exposes purchase data of other users** — Mitigation: API route filters by `getCurrentUser().id`; never accept userId from query params.

## Security Considerations

- F3 `/api/orders` route MUST use `getCurrentUser()` and filter by that user id only — NEVER trust client-provided userId.
- F2 cron MUST `verifyCronAuth()` first — anyone could spam compensation grants otherwise.
- Compensation credit grant MUST be idempotent — check audit log for prior `compensation_granted` event with same `purchase_id` before incrementing.

## Next Steps

After Phase 01 ships green:
- Move to Phase 02 (F4 webhook → instant status, F5 synthetic monitor, F6 generating email)
- Begin parallel discovery on D-ID API for F9 (Phase 03)
