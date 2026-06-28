# Code Review — Wave 19 Phase 03 i18n + UX State Batch

**Reviewer:** code-reviewer (independent)
**Date:** 2026-05-09 22:39
**Verdict:** APPROVED ✅
**Score:** 9.5 / 10

## Verification Summary
- **Parity test:** PASSED — EN=1524, VI=1524, 0 drift. Flatten-to-leaves logic correctly catches both missing keys AND structural drift (object vs leaf).
- **Sampled t() keys (5):** all resolve in both locales — `dashboard.distribute.status.queued`, `dashboard.channels.client.confirmDisconnect`, `dashboard.onboarding.errorBanner.title`, `dashboard.videos.distribute.errorToast`, `dashboard.videos.generate.quotaExceeded`.
- **Toaster provider:** wired in `src/app/[locale]/layout.tsx:40-162` (dynamic sonner import). `toast.error()` in distribute-panel safe.
- **Client-component boundaries:** `onboarding-error-banner.tsx` has `'use client'` (uses `useRouter().refresh()`). page.tsx is server (uses async params + await). Correct.
- **Status fallback:** `publishing-status-badges.tsx:46` uses `t(status, { defaultValue: status })` — unknown enum returns raw string, no throw. Safe.
- **No raw `dashboard.*` literal strings rendered.** Only `useTranslations()` call signatures.
- **No `:any`** in any reviewed file. ✅
- **VI diacritics correct** (đ, ơ, ư, ệ, ấ, ắ, ọ, ợ all present).

## Critical Findings
None.

## Medium Findings
1. **distribute-panel 202 LOC (2 over):** Justified. Splitting would require extracting ~30 LOC channel-list section; net friction > benefit. KISS holds. Accept.
2. **Native `confirm()` in channels-client.tsx:93:** Pre-existing pattern, key now i18n'd via `t('confirmDisconnect')`. Flagged for future replacement with proper modal (out of scope here).
3. **Hardcoded "Social Channels" h1 + description in channels-client:122-126:** Not part of this batch's scope (M10 only covered status/disconnect labels). Recommend follow-up ticket — not blocker.

## VI Translation Quality (3 sampled)
| Key | EN | VI | Quality |
|---|---|---|---|
| `videos.distribute.errorToast` | "Distribution failed. Please try again." | "Phân phối thất bại. Vui lòng thử lại." | ✅ Natural, polite register |
| `onboarding.errorBanner.description` | "We had trouble checking your steps. Please retry." | "Có lỗi khi kiểm tra các bước. Vui lòng thử lại." | ✅ Natural; "We had trouble" → "Có lỗi" idiomatic |
| `distribute.status.live` | "Live" | "Đang phát" | ✅ Correct broadcasting term |

No literal robot translations detected.

## Low Findings
- JSON keys not strictly alphabetic within new namespaces (`status` order: queued, processing, live, failed, paused, scheduled, uploading — semantic ordering preferred over alphabetic, acceptable per common i18n practice).

## Positive Observations
- Parity test will prevent future drift — guard rail solid.
- `loadStepStatus` uses `Promise.allSettled` — partial failure tolerated. Error banner only on full throw. Good UX.
- Banner uses `role="alert"` for a11y. ✅
- All files <205 LOC. Modular.

## Unresolved Questions
- None blocking. Future: replace native `confirm()` with shadcn AlertDialog when channel UX gets full redesign.
