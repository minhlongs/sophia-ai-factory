# Phase 07 — Dashboard Tier Widget — Tracked Checkout

## Context Links
- Existing widget: `src/components/dashboard/plan-upgrade-widget.tsx`
- Settings page (where widget renders): grep for `<PlanUpgradeWidget` to find usages
- Phase 02 deliverable: tracked POST /api/checkout returns `{ url, orderId }`

## Overview
- Priority: P2
- Status: pending
- Effort: 30m
- Description: Replace direct `https://nowpayments.io/payment/?iid=...` links with tracked POST → /api/checkout flow. Add expiry display + "View receipts" link.

## Key Insights
- Today's widget uses raw NOWPayments URL → no order_id → IPN can't resolve user via `parseUserIdFromOrderId()`. This means upgrades from settings page DON'T activate automatically (or rely on email match — fragile).
- Single tracked path: every checkout (pricing page OR dashboard widget OR Telegram bot) writes pending_orders + uses sophia_${userId}_${ts} order_id pattern.
- Yagni: Don't add "billing history" page yet — just a "View past orders" link if listOrdersByUser has rows.

## Requirements

### Functional
- Click upgrade tier → POST /api/checkout → redirect to returned URL
- Show current period_end (when subscription expires) — pulled from subscriptions table
- Show "View past orders" link if user has any completed orders (visible only when count > 0)
- MASTER tier shows "Lifetime — never expires" instead of period_end

### Non-Functional
- Same load latency as today (one extra DB query for period_end on server-rendered settings page)
- Loading state on button click (existing `loading` pattern)

## Architecture
```
Settings page (server component)
  ├─ getCurrentUser()
  ├─ getUserTier(userId) → currentTier
  ├─ getSubscriptionPeriodEnd(userId) → periodEnd | null
  ├─ countCompletedOrders(userId) → number
  └─ <PlanUpgradeWidget currentTier periodEnd showHistoryLink={count>0}/>

PlanUpgradeWidget (client component)
  ├─ For each upgrade tier, render button
  └─ onClick → fetch POST /api/checkout {tier} → redirect to data.url
```

## Related Code Files

### Modify
- `src/components/dashboard/plan-upgrade-widget.tsx` — convert anchors to buttons + fetch logic; add periodEnd + history link props
- Settings page (find via grep `PlanUpgradeWidget`) — pass new props

### Create
- `src/lib/billing/subscription-expiry.ts` — `getSubscriptionPeriodEnd(userId): Promise<string | null>`
- `src/lib/orders/order-counts.ts` — `countCompletedOrders(userId): Promise<number>`

## Implementation Steps

1. Create `subscription-expiry.ts`:
   ```ts
   export async function getSubscriptionPeriodEnd(userId: string): Promise<string | null> {
     const db = createServerClient()
     const { data: m } = await db.from('org_members').select('org_id').eq('user_id', userId).single()
     if (!m?.org_id) return null
     const { data: s } = await db.from('subscriptions').select('current_period_end,plan').eq('org_id', m.org_id).single()
     return s?.current_period_end ?? null
   }
   ```

2. Create `order-counts.ts`:
   ```ts
   export async function countCompletedOrders(userId: string): Promise<number> {
     const db = createServerClient()
     const { data } = await db.from('pending_orders').select('order_id').eq('user_id', userId).eq('status', 'completed')
     return Array.isArray(data) ? data.length : 0
   }
   ```

3. Modify `plan-upgrade-widget.tsx`:
   - Convert from anchors (`<a href={getCheckoutUrl(tier)}>`) to buttons with onClick handler
   - Add `'use client'` (already present)
   - Add `loading: Tier | null` state
   - onClick → fetch POST `/api/checkout` body `{ tier }` → on 200 follow `data.url`; on 401 redirect to login
   - Add `periodEnd` prop → display "Renews YYYY-MM-DD" or "Lifetime"
   - Add `showHistoryLink` prop → conditional "View past orders" link to `/dashboard/orders` (route does NOT exist yet — this is OK; link grays out via `tabIndex={-1}` until implemented)

4. Update settings page (server component) — pass new props

5. Visual smoke test in dev: tier card shows period end correctly

## Todo List
- [ ] Create subscription-expiry.ts
- [ ] Create order-counts.ts
- [ ] Refactor plan-upgrade-widget.tsx to fetch-based checkout
- [ ] Update settings page server component to pass new props
- [ ] Run existing tests (no widget tests today; consider adding 1 smoke)
- [ ] Build → 0 errors

## Success Criteria
- Dashboard upgrade button creates pending_orders row (verified by querying after click)
- Tier widget shows correct period_end for active subscription
- 401 path redirects to login with correct next URL

## Risk Assessment
- Risk: Settings page already uses widget in different shape → mitigation: grep usages, update prop interface in coordinated commit
- Risk: /dashboard/orders route doesn't exist → mitigation: link is gated behind `showHistoryLink` flag; defer route to future phase

## Security Considerations
- All upgrade calls now go through authenticated POST /api/checkout — no anonymous tier upgrade attempts
- order_id ties upgrade to user — IPN can resolve correctly

## Next Steps
- Phase 08: Tests cover widget click → checkout → IPN flow E2E
- Future: build /dashboard/orders for full history (defer)
