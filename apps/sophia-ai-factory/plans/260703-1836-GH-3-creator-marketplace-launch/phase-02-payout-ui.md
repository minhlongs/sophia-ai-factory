---
phase: 2
title: "Payout UI"
status: pending
effort: "Medium+ (6-10h)"
priority: P1
dependencies: [1]
---

# Phase 2: Payout UI

## Overview

Add a creator-facing payout dashboard for SOP creators. Key constraint from red-team: **payouts are cron-only** (weekly Inngest batcher) — there is no "request payout" API. Show "Next scheduled payout" date instead. Reuse existing payout infrastructure from `/dashboard/affiliate/payouts/`.

**Red-team fix notes:**
- No "Request payout" button — payouts run automatically on Sunday 12:00 UTC
- Existing `/dashboard/affiliate/payouts/` has full payout UI — reuse or link to it
- Creator dashboard needs tab layout restructure — effort increased
- Wallet tier gate separately needs updating (see step 2.6)

## Context

Existing payout infrastructure:
- `/api/affiliate/payout-method` — GET/PUT wallet address
- `/api/affiliate/payouts` — GET payout history (read-only)
- `/api/webhooks/nowpayments-payout` — NOWPayments IPN auto-payout
- `commission-split.ts` — `getCreatorEarnings()` returns total/pending/payable/paid
- Creator dashboard already shows earnings summary cards
- Payouts flow: cron → `payoutBatcher` Inngest (weekly Sunday) → NOWPayments mass-payout
- Existing payout UI at `[locale]/dashboard/affiliate/payouts/` with wallet management + history

## Architecture

```
Creator Dashboard
  ├── SOPs section (existing, flat page — needs tab conversion)
  ├── Earnings section (existing cards)
  └── Payouts link → /dashboard/affiliate/payouts/ (reuse existing page)
       OR dedicated SOP creator payouts page that shares components
```

## Related Code Files

- **Modify:** `src/app/[locale]/dashboard/sop-creator/page.tsx` (convert to tabs, add Payouts link)
- **Create:** `src/forest/components/sop/creator-payouts-section.tsx` (Stitch-themed shared component)
- **Create:** `src/app/[locale]/dashboard/sop-creator/payouts/page.tsx` (optional — if dedicated page needed)
- **Read:** `src/app/[locale]/dashboard/affiliate/payouts/page.tsx` (existing payout UI to reuse)
- **Read:** `src/app/[locale]/dashboard/wallet/page.tsx` (tier gate to update)
- **Read:** `src/forest/jobs/payout-batcher.ts` (cron schedule for "next payout" display)

## Implementation Steps

### 2.1 Convert creator dashboard to tabbed layout

Current dashboard is a flat page with earnings cards + SOPs table. Restructure into tabbed layout:
- "My SOPs" tab (existing content)
- "Earnings" tab (existing cards, but in tab pane)
- "Payouts" tab (new — shows method + history + next payout date)

### 2.2 Create shared payout method component

Build (or extract from existing affiliate payout UI) a component that:
- Shows current payout method (wallet address) via GET `/api/affiliate/payout-method`
- Allows editing wallet address via POST `/api/affiliate/payout-method`
- Validates USDT TRC20/ERC20 address format
- Uses Stitch amber theme

### 2.3 Create payout history component

Build a table showing:
- Date, amount (USD), status (pending/payable/paid)
- Paginated if > 20 entries
- Data from GET `/api/affiliate/payouts`
- Show "Next payout: Sunday" (from Inngest cron schedule)

### 2.4 Create link to existing payout UI

Add a "Manage Payouts" link in creator dashboard that routes to either:
- A new dedicated SOP-creator payout page (if needed)
- OR the existing `/dashboard/affiliate/payouts/` page

Prefer reusing the existing page to minimize duplication.

### 2.5 Update wallet tier gate

The wallet page (`/dashboard/wallet/`) gates at MASTER. Add step to update this gate to also check `hasCreatorAccess()` so beta-approved creators can see their payout data.

### 2.6 Add i18n keys

Add to `messages/en.json` and `messages/vi.json`:
- sop.creator.payouts.title
- sop.creator.payouts.walletAddress
- sop.creator.payouts.save
- sop.creator.payouts.payoutHistory
- sop.creator.payouts.nextPayout
- sop.creator.payouts.date, amount, status

## Success Criteria

- [ ] Creator dashboard converted to tabbed layout (backward compatible)
- [ ] Creator can view/edit NOWPayments wallet address
- [ ] Creator can see payout history with statuses
- [ ] Creator sees "Next scheduled payout" date (not a request button)
- [ ] Wallet tier gate updated to check creator access
- [ ] All UI is bilingual (VI + EN)
- [ ] All existing tests pass

## Risk Assessment

- **Low:** Payout API already tested. UI-only work except wallet gate.
- **Medium:** Tab layout restructure is more work than a simple link addition. Effort updated.
- **Medium:** Wallet gate change may affect non-creator users — verify backward compat.
- **Edge case:** Empty state for creators with no payouts yet.
