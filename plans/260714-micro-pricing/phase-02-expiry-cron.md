# Phase 2: Credit Expiry Cron

**Effort:** S (1 new file + 1 migration)
**Depends on:** Phase 1 (invoice IDs registered in ONE_TIME_SKUS)

---

## Context

`user_purchases` has `expires_at` column. When credits expire, they should be
marked as consumed (not deleted — audit trail intact). The `cost-guardrail.ts`
checks `expires_at IS NULL OR expires_at > now` before allowing video generation.

No monthly rollover cron needed for Phase 1 — credit packs carry their own expiry.
Subscription-tier quota resets happen at subscription activation (existing code).

---

## New Files

### `src/app/api/cron/credit-expiry/route.ts`

```typescript
/**
 * GET/POST /api/cron/credit-expiry
 *
 * Marks expired user_purchases rows as 'expired'.
 * Called by CF Cron Trigger daily at 03:00 UTC (same window as token-refresh).
 *
 * Auth: CRON_SECRET header required.
 *
 * Idempotent: re-running marks 0 rows (already expired = status='expired').
 */

import { NextRequest, NextResponse } from 'next/server';
import { getD1 } from '@/seed/db/client';

export const dynamic = 'force-dynamic';

const CRON_SECRET = process.env.CRON_SECRET!;

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-cron-secret');
  if (secret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = Math.floor(Date.now() / 1000);

  try {
    const db = getD1();
    // Atomic: mark all expired active purchases as 'expired'
    const result = await db
      .prepare(
        `UPDATE user_purchases
         SET status = 'expired', updated_at = ?1
         WHERE status = 'paid'
           AND expires_at IS NOT NULL
           AND expires_at <= ?1`
      )
      .bind(now)
      .run();

    return NextResponse.json({
      ok: true,
      markedExpired: result.meta?.changes ?? 0,
      timestamp: new Date(now * 1000).toISOString(),
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
```

### CF Cron Trigger Registration

Add to `wrangler.toml`:

```toml
[[trigger]]
  type = 'scheduled'
  name = 'credit-expiry'
  schedule = '0 3 * * *'  # Daily 03:00 UTC
  # route = '/api/cron/credit-expiry'  # implicit from route path
```

---

## Modified Files

**None** — pure additive. Uses existing `user_purchases.expires_at` column.

---

## Verification

1. `npm run build` passes
2. `npm test -- app/api/cron` passes (or add smoke test)
3. Manual: hit `/api/cron/credit-expiry` with `x-cron-secret: $CRON_SECRET` → verify expired rows marked
4. Verify `cost-guardrail.ts` already excludes expired credits (line: `expires_at IS NULL OR expires_at > ?2`)

---

## Owner

Forest (Infrastructure) — cron route is infrastructure layer.
Land provides the data model (already exists).
