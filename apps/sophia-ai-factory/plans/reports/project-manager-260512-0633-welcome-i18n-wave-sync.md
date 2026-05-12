# Project Manager Sync — Welcome i18n Wave (2026-05-12 06:33 PT)

**Report ID:** project-manager-260512-0633-welcome-i18n-wave-sync
**Duration:** Polish (06:01) + Founder-Prep (06:07) + Hardening (06:25) + Welcome i18n (06:33) waves
**External plan updated:** `/Users/macbook/plans/260510-0603-sophia-gap-plan/plan.md` (4th wave addendum appended)

---

## Wave Summary

**Welcome Page Bilingual Refactor:** Replaced 24+ hardcoded `isVi` ternaries with next-intl `useTranslations('welcome')` across the FREE100 magic-link setup flow.

**Scope:** 5 files, 4 wave-delivered, ~60 i18n keys extended + cleanup.

| File | Type | Delta | Purpose |
|---|---|---|---|
| `messages/vi.json` + `messages/en.json` | i18n | +60L | Extended `welcome.*` namespace (~30 new keys). Removed 4 pre-existing orphan keys. |
| `page.tsx` (welcome/[token]/) | Server | +7/-8 | Metadata via `getTranslations()`. Dropped `isVi` prop. |
| `welcome-page-client.tsx` | Client | +70/-45 | Single `useTranslations()` call. Replaced 24+ ternaries. Added `aria-live="polite"` on Telegram success. |
| `welcome-onboarding-steps.tsx` | Component | +32/-18 | `StepKey` union type. Dynamic key resolution via template literals. |

---

## Validation

- **Tests:** 1931/1931 pass (no fresh failures in tree/seed/app)
- **Build:** `npm run build` → exit 0, no TS errors
- **i18n:** 0 missing keys (1039 unique, +25 from baseline 1014)
- **isVi residue:** 0 matches in `src/app/[locale]/welcome/`
- **Code review:** 9.2/10 APPROVE-WITH-FIXES
  - **M2 (orphan keys):** ✅ APPLIED
  - **M3 (aria-live):** ✅ APPLIED
  - **M1 (validator gap):** deferred (latent coverage issue, all current keys verified)

---

## Tech Debt Resolved

- **Pre-existing `isVi` ternaries:** 24+ instances eliminated
- **Bilingual hardcoding:** Welcome page now uses next-intl convention (parity with rest of app)
- **Translator maintenance:** Single `useTranslations('welcome')` call vs scattered `isVi ?` checks
- **A11y:** Success state now announced to screen readers

---

## FREE100 Golden Path Impact

- **Protected flow:** magic-link email → `/welcome/[token]` → setup-wizard → dashboard
- **Status:** ✅ UNBROKEN (all flows remain functional)
- **Founder action items:** unchanged (still ~5 remaining, ~1h total)

---

## Engineering Scope

All engineering deliverables from Polish + Founder-Prep + Hardening + Welcome-i18n waves are **COMPLETE**. Remaining founder tasks are operational (DNS verify, Sentry signup, Crisp.im setup, screenshot capture, smoke video record).

---

## External Plan Update

Appended 4th sub-section to `/Users/macbook/plans/260510-0603-sophia-gap-plan/plan.md`:
- **2026-05-12 Welcome i18n Wave (06:33 PT)**
- 4-row file table (file, LOC delta, purpose)
- Code review: 9.2/10 score + fixes applied/deferred
- Resolved: pre-existing isVi ternary tech debt
- Note: FREE100 engineering scope now COMPLETE

---

## Unresolved Questions

1. Should validator future version guard template-literal keys via static registry or regex loosening? (M1 deferred)
2. Should `WelcomeData.tier` be narrowed to `Tier` enum vs `string` for stronger type safety? (code-reviewer note, out of scope)

