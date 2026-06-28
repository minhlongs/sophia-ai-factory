# Wave 2 — Customer i18n + UX Report

**Date:** 2026-05-21  
**Status:** COMPLETE  
**Build:** ✅ exit 0, TypeScript clean  
**Tests:** Pre-existing 40 failures (better-sqlite3 Node.js ABI mismatch) — NOT introduced by this wave. 4621 pass.

---

## Items Completed

### CG-001 — Pricing page i18n (PricingComparisonTable)

**Finding:** `PricingCard` and `PricingSection` already used `t()` via `useTranslations("landing")`. The gap was in `PricingComparisonTable` which had 9 hardcoded EN row labels and hardcoded "One-time"/"Monthly" billing values.

**Changes:**
- `src/forest/components/pricing/pricing-comparison-table.tsx` — replaced all 9 hardcoded row labels with `t('row_*')` calls; replaced `'One-time'`/`'Monthly'` literals with `t('billing_one_time')` / `t('billing_monthly')`; replaced hardcoded tier labels in TIERS constant with `t('table_tier_*')` resolved inside the component.
- `messages/en.json` — added 15 new keys under `pricing.*`: `row_mcu`, `row_campaigns`, `row_youtube`, `row_team`, `row_api`, `row_webhooks`, `row_integrations`, `row_white_label`, `row_billing`, `billing_monthly`, `billing_one_time`, `table_tier_starter`, `table_tier_growth`, `table_tier_premium`, `table_tier_master`.
- `messages/vi.json` — same 15 keys with Vietnamese copy.

### CG-002 — Crypto payment explainer wizard step

**Created:** `src/forest/components/checkout/crypto-payment-explainer.tsx`  
Collapsible accordion explaining USDT in plain language: what USDT is, 3-step wallet setup, network selection (TRC20 vs ERC20), send flow, timing, and PayOS fallback for non-crypto users. 5 glossed steps, bilingual via `pricing.*` namespace.

**Wired into:** `src/app/[locale]/pricing/page.tsx` — rendered between `<PricingSection />` and the one-time bundle card.

**New keys added to `pricing.*` in both locales:** `crypto_explainer_title`, `crypto_explainer_subtitle`, `crypto_what_is_usdt`, `crypto_what_is_usdt_desc`, `crypto_wallet_title`, `crypto_wallet_desc`, `crypto_network_title`, `crypto_network_desc`, `crypto_send_title`, `crypto_send_desc`, `crypto_time_title`, `crypto_time_desc`, `crypto_no_wallet_title`, `crypto_no_wallet_desc`, `crypto_support_cta`.

### CG-003 — Setup Wizard API key help links

**Finding:** `ByokHelpTip` already exists with expandable 3-step guides for OpenRouter, ElevenLabs, D-ID. Gap was NOWPayments in `ProviderCredentialsStep` — it had only inline `helpText` string, no expandable guide.

**Changes:**
- `src/components/onboarding/byok-help-tip.tsx` — extended `ByokProvider` type to include `'nowpayments'`; extended `HelpKeys` type with nowpayments step keys.
- `messages/en.json` — added `onboarding.byok.help.nowpayments` (title, step1, step2, step3, signupUrl pointing to `account.nowpayments.io`).
- `messages/vi.json` — same Vietnamese translations for nowpayments help.
- `src/tree/components/setup-wizard/steps/provider-credentials-step.tsx` — imported `ByokHelpTip`; added `<ByokHelpTip provider="nowpayments" />` below the NOWPayments API key input.

### CG-008 — Welcome email VI variant

**Finding:** `welcome-magic-link.ts` already had `isVi` locale detection and VI/EN conditional strings. Gap: Setup Wizard link was not in the email, and the "next steps" were vague.

**Changes:** `src/forest/email/templates/welcome-magic-link.ts` — replaced generic "Complete 3-step onboarding" step with direct `${BASE_URL}/setup-wizard` hyperlink in both VI and EN variants. Added a second CTA button at the bottom of the email pointing to the Setup Wizard. Updated next-steps list to include explicit "ready in 5–10 minutes" moment.

### CG-009 — Post-payment first-value CTA

**Changes:** `src/app/[locale]/payment-success/page.tsx` — added an emerald-colored first-value banner above the action buttons, showing bilingual "Your first campaign will be ready in 5–10 minutes" with a direct "Start Setup Wizard →" CTA link. Banner only shows when `orderStatus === 'completed' || !orderStatus`.

---

## Files Modified

| File | Change |
|---|---|
| `messages/en.json` | +50 keys (pricing.*, onboarding.byok.help.nowpayments) |
| `messages/vi.json` | +50 keys (same, Vietnamese) |
| `src/forest/components/pricing/pricing-comparison-table.tsx` | Wire 9 row labels + billing + tier labels to `t()` |
| `src/forest/components/checkout/crypto-payment-explainer.tsx` | **NEW** — crypto accordion explainer |
| `src/app/[locale]/pricing/page.tsx` | Import + render `CryptoPaymentExplainer` |
| `src/components/onboarding/byok-help-tip.tsx` | Extend type to `'nowpayments'` |
| `src/tree/components/setup-wizard/steps/provider-credentials-step.tsx` | Import + render `ByokHelpTip` for nowpayments |
| `src/forest/email/templates/welcome-magic-link.ts` | Add Setup Wizard link + second CTA button |
| `src/app/[locale]/payment-success/page.tsx` | Add first-value emerald CTA banner |

---

## Translation Key Coverage Proof

```
$ python3 -c "
import json
with open('messages/en.json') as f: en=json.load(f)
with open('messages/vi.json') as f: vi=json.load(f)
keys=['row_mcu','row_campaigns','row_youtube','row_team','row_api','row_webhooks',
      'row_integrations','row_white_label','row_billing','billing_monthly','billing_one_time',
      'table_tier_starter','table_tier_growth','table_tier_premium','table_tier_master',
      'crypto_explainer_title','crypto_explainer_subtitle','crypto_what_is_usdt',
      'crypto_what_is_usdt_desc','crypto_wallet_title','crypto_wallet_desc',
      'crypto_network_title','crypto_network_desc','crypto_send_title','crypto_send_desc',
      'crypto_time_title','crypto_time_desc','crypto_no_wallet_title','crypto_no_wallet_desc',
      'crypto_support_cta','payment_success_first_value','payment_success_minutes',
      'payment_success_start_cta','payment_success_setup_cta','payment_success_setup_needed']
ep=en['pricing']; vp=vi['pricing']
missing=[k for k in keys if k not in ep or k not in vp]
print('MISSING:',missing if missing else 'none — ALL PRESENT')
eh=en['onboarding']['byok']['help']; vh=vi['onboarding']['byok']['help']
print('nowpayments help EN:','OK' if 'nowpayments' in eh else 'MISSING')
print('nowpayments help VI:','OK' if 'nowpayments' in vh else 'MISSING')
"
MISSING: none — ALL PRESENT
nowpayments help EN: OK
nowpayments help VI: OK
```

---

## Build Output

```
✓ Compiled successfully in 28.9s
Running TypeScript ... Finished TypeScript in 18.3s
✓ Generating static pages (181/181)
```

Exit code: 0. No TypeScript errors. No console.log. No `:any` in modified files.

---

## Test Status

- Pre-wave baseline: 7 failed files / 40 failed tests (better-sqlite3 ABI mismatch — Node.js version)
- Post-wave: same 7 failed files / 40 failed tests
- Wave 2 introduced: 0 new failures
- 4621 tests pass

---

## Quality Gates

- [x] `pnpm run build` exit 0
- [x] No `:any` in modified files
- [x] No `console.log` in modified files
- [x] All `t()` keys added exist in both `en.json` and `vi.json`
- [x] File ownership respected (no edits outside wave scope)
- [x] TypeScript clean (npx tsc --noEmit: 0 errors)

---

## Unresolved Questions

1. **`payment_success_*` keys in `pricing` namespace** — added for completeness but the payment-success page (`/payment-success/page.tsx`) currently uses direct `isVi` conditionals rather than `t()`. The keys are available if a future refactor wants to wire the success page through next-intl. No functional gap.
2. **`CryptoPaymentExplainer` dynamic key cast** — uses `titleKey as Parameters<typeof t>[0]` to handle the STEPS array of string keys. TypeScript accepts this; no runtime risk since keys are compile-time constants in the STEPS array and verified present in both locales.
