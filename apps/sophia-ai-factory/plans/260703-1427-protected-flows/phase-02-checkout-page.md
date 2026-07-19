# Phase 02 — Checkout Page Amber Theme + i18n

**Priority:** P0 Critical | **Effort:** 1-2h | **Status:** pending

## Context

Sophia has TWO checkout components in different locations, representing two code generations:

1. **Stitch-generated** (`src/components/stitch/screens/checkout/checkout-page.tsx`, 193 lines) — Generated from Stitch design tool. Uses Tailwind semantic tokens (`text-primary`, `bg-background`). Hardcoded English text. Fake credit card UI (NOT the real NOWPayments flow). **Low priority — this is mainly a visual/stub component.**

2. **Real checkout section** (`src/app/components/sections/checkout-page.tsx`, 268 lines) — The actual NOWPayments checkout. Uses `useTranslations('checkout')` for i18n. Has 8 hardcoded `indigo` class references (`text-indigo-400`, `bg-indigo-500`, `border-indigo-500`, `ring-indigo-500`, `bg-indigo-600`, `hover:bg-indigo-500`). Supports: USDT TRC-20, USDC Solana, BTC, NOWPayments Invoice. QR code placeholder. Wallet address copy. **This is the one that matters.**

## What Changes

### File 1: `src/app/components/sections/checkout-page.tsx` (PRIMARY)

**Indigo → Amber conversion (8 occurrences):**

| Line | Current | Replace with |
|------|---------|-------------|
| 50 | `ring-indigo-500` | `ring-amber-600` |
| 52 | `border-indigo-500 bg-indigo-500/5` | `border-amber-600 bg-amber-600/5` |
| 60 | `border-indigo-500 bg-indigo-500` | `border-amber-600 bg-amber-600` |
| 72 | `border-indigo-500/30 bg-indigo-500/10 text-indigo-400` | `border-amber-600/30 bg-amber-600/10 text-amber-600` |
| 158 | `bg-indigo-600 hover:bg-indigo-500` | `bg-amber-600 hover:bg-amber-500` |
| 168 | `bg-indigo-600 hover:bg-indigo-500` | `bg-amber-600 hover:bg-amber-500` |
| 219 | `text-indigo-400` | `text-amber-500` |
| 222 | `text-indigo-400` | `text-amber-500` |

**i18n key check:** The component already uses `useTranslations('checkout')`. The checkout namespace exists in `messages/en.json` with 30 keys (line 2872). Verify all keys used in the component resolve. Keys used:
- `payment_method`, `recommended`, `guidance_text`, `wallet_address`, `copied`, `copy`, `qr_code`, `confirm_payment`, `nowpayments_redirect`, `proceed_to_invoice`, `order_summary`, `plan_selected`, `subscription`, `subscription_price`, `ai_credits`, `ai_credits_price`, `grand_total`, `grand_total_price`, `breadcrumb_billing`, `breadcrumb_checkout`, `page_title`

**Vietnamese translations check:** Verify `messages/vi.json` has matching `checkout` namespace with all required keys.

### File 2: `src/components/stitch/screens/checkout/checkout-page.tsx` (SECONDARY)

No hardcoded indigo found — uses `text-primary` semantic tokens. Action:
- Keep as-is for semantic tokens (they auto-switch with CSS vars)
- Optionally add `useTranslations` i18n wrapper if this component becomes the primary checkout
- **Skip** if this is a visual-only demo stub (credit card form, not NOWPayments)

## NOWPayments Preservation Checklist

- [ ] Wallet address display panel (shows after crypto method selected)
- [ ] QR code placeholder (200x200px area)
- [ ] Copy-to-clipboard for wallet address with "Copied" feedback
- [ ] USDT TRC-20 payment method (recommended)
- [ ] USDC Solana payment method
- [ ] BTC payment method
- [ ] NOWPayments Invoice fallback option
- [ ] Confirm Payment button behavior
- [ ] API route `POST /api/checkout` — creates payment session (status polling, IPN webhook)
- [ ] API route `GET /api/checkout/status` — payment status check
- [ ] API route `/api/payments/one-time-checkout` — alternative payment flow
- [ ] `/checkout/failure` page — renders error state
- [ ] `payment-status-poller.tsx` — polling component

## Files to Modify

| File | Action | Risk |
|------|--------|------|
| `src/app/components/sections/checkout-page.tsx` | 8 indigo→amber class replacements | Low — pure CSS swap |
| `messages/en.json` | Verify all `checkout.*` keys exist | Low — already has 30 keys |
| `messages/vi.json` | Verify all `checkout.*` keys exist in Vietnamese | Medium — may need translation |
| `src/components/stitch/screens/checkout/checkout-page.tsx` | Optional: add i18n, skip if demo stub | Low |

## Implementation Sequence

1. Read `messages/en.json` at `checkout` namespace (line 2872) — verify all keys
2. Read `messages/vi.json` — verify matching `checkout` namespace, add missing keys
3. Open `src/app/components/sections/checkout-page.tsx` — do the 8 indigo→amber replacements
4. Check all `t('...')` calls against message keys — log any missing
5. If Vietnamese keys missing, add translations (use deepL or manual)
6. Run `npm run build` — verify 0 errors, 0 i18n warnings
7. Run `npm test -- src/app/api/checkout/` — verify checkout API tests pass
8. Start dev server, navigate to `/en/checkout`:
   - Verify amber theme renders
   - Select USDT TRC-20 → wallet address panel appears
   - Select NOWPayments Invoice → redirect text appears
   - QR code placeholder visible
   - Copy button works
9. Switch to `/vi/checkout` — verify Vietnamese text
10. Run `npm run test:e2e -- tests/e2e/checkout-flow.spec.ts` — verify E2E passes

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Vi messages missing checkout keys | Medium | Medium | `en.json` already has 30 keys. Check vi.json, add any missing. Fallback: `next-intl` falls back to English. |
| Button contrast broken after color change | Low | Medium | Amber on dark background has good contrast. Test with dev server. |
| Checkout flow E2E breaks from class name changes | Low | Low | E2E tests check API responses (status codes, redirects), not visual classes. |
| Stitch checkout diverges from real checkout | Low | Low | The stitch checkout is a credit-card demo (not NOWPayments). Document as low-priority debt. |
| `text-amber-500` doesn't exist in Tailwind config | Low | Medium | Amber is a built-in Tailwind color. Verify: `text-amber-*` classes render correctly. |

## Rollback

```bash
git revert <commit-hash>
# Pure CSS class + i18n key changes. No API or data changes.
```

## Success Criteria

- [ ] `npm run build` exits 0 with no i18n warnings
- [ ] `/en/checkout` renders with amber theme (no indigo anywhere)
- [ ] `/vi/checkout` renders with Vietnamese text
- [ ] All payment method options visible: USDT, USDC, BTC, NOWPayments
- [ ] Wallet address + QR code panel shows after crypto selection
- [ ] Copy-to-clipboard works
- [ ] `npm test -- src/app/api/checkout/` passes
- [ ] `npm run test:e2e -- tests/e2e/checkout-flow.spec.ts` passes
