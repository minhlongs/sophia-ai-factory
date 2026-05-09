# Cook Report — Wave 1D (P0 redeem CTA + SEO metadata)

**Date:** 2026-05-08 03:13 PT
**Trigger:** `/cook next` → re-scout fresh round 3 → 3-fix subset (P0 + SEO).

## Why this wave

Re-scout round 3 sau Wave 1C+B+D (commit `8185b401`) phát hiện:
- **P0 user-journey gap:** `/redeem` page **unreachable** từ landing — user có FREE100 code không tìm được path. Bắt buộc scroll xuống pricing modal, ngược trực giác.
- **P1 SEO:** Homepage + login đều thiếu `metadata` export → fallback từ parent layout, no OG, no Twitter card, no canonical.
- **P0 ops (out of code scope):** Sentry compiled nhưng `NEXT_PUBLIC_SENTRY_DSN` empty → errors KHÔNG capture trong prod.

User chose: F-1 + F-2 + F-3 subset (P0 + SEO). Defer F-4 wallet i18n + F-5 trial display.

## Changes (3 files modified + 1 new)

### F-1: Hero "I have a code" CTA → /redeem
- `src/app/components/sections/hero.tsx`: thêm `<Link href="/redeem">` wrapping outline Button giữa cta_start (→/dashboard) và cta_demo (scroll). Surgical 5-line diff.
- `messages/en.json` + `messages/vi.json`: i18n key `landing.hero.cta_have_code` ("I have a code" / "Tôi có mã quà tặng").

User journey trước: landing → scroll xuống pricing → click Coupon Input modal → submit code. 3 steps, ngược trực giác.
Sau: landing → click "I have a code" → /redeem → submit. 1 step, direct.

### F-2: Homepage metadata
- `src/app/[locale]/page.tsx`: thêm `generateMetadata` async với `getTranslations({locale, namespace:'seo.home'})`. Returns title, description, openGraph (vi_VN/en_US locale, /og-image.png 1200×630), twitter card, canonical + alternates languages (en/vi/x-default).

### F-3: Login metadata
- `src/app/[locale]/login/layout.tsx` (mới): pass-through layout với `generateMetadata`. Bilingual title/description từ `seo.login.*`. `robots: { index: false, follow: false }` (auth pages không crawl).

Login page.tsx vẫn `'use client'`; layout.tsx server component là cách KISS để inject metadata cho client page.

### i18n keys mới
- `landing.hero.cta_have_code` (en + vi)
- `seo.home.{title, description}` (en + vi)
- `seo.login.{title, description}` (en + vi)

Total: 5 keys × 2 locales = 10 entries.

## Verification

| Check | Result |
|---|---|
| `npx tsc --noEmit` | ✅ exit 0 |
| `npx vitest run` | ✅ 2796/2827 baseline preserved |
| i18n keys verified | ✅ 10/10 entries (5 keys × 2 locales) |
| Hero `/redeem` href correct | ✅ |
| `generateMetadata` async + `Metadata` type | ✅ |
| Login `robots: noindex` | ✅ (auth pages excluded from crawl) |
| code-reviewer | ✅ 9.7/10, 0 critical, APPROVE |

Polish applied post-review: thêm `x-default` alternate language theo SEO best practice (Google recommendation cho international targeting).

## Bundle expanded post-approval (user said "Hold — add F-4 + F-5 too")

### F-4 wallet i18n sweep
- `messages/{en,vi}.json`: thêm 16 keys `dashboard.wallet.*` (title, subtitle, balancePending/Available/PaidOut + hints, transactionsTitle, emptyTitle/Hint/Cta, thDate/Type/Gross/YourCut/Status).
- `dashboard/wallet/page.tsx`: 16 hardcoded English strings → `t()` calls. Cả tier-gate fallback subtitle dùng `t('subtitle')`.

### F-5 MASTER trial expiry display
- `dashboard/page.tsx`: merge `trial_ends_at` fetch vào existing `Promise.all` (tránh extra round-trip), thêm `ORDER BY updated_at DESC` (deterministic if multiple rows).
- `dashboard/components/master-welcome-banner.tsx`: prop `trialEndsAt?: number | null`; render locale-aware date qua `Intl.DateTimeFormat` (vi-VN/en-US); guard `> Math.floor(Date.now()/1000)` để không hiện expired.
- i18n key `dashboard.masterWelcome.expiresAt` với `{date}` interpolation (en + vi).

## Critical blocker discovered & fixed mid-review

Code-reviewer round 1 phát hiện CRITICAL: pretest `scripts/validate-i18n-keys.mjs` không recognize object-form `getTranslations({namespace: 'X'})` → false-flag `seo.home.title/description` → `npm test` abort → push blocked.

**Two-step fix:**
1. Patched validator regex: thêm fallback object-form `(?:useTranslations|getTranslations)\(\s*\{[^}]*namespace:\s*['"\`]([\w.]+)['"\`]/`.
2. Refactor: extracted `buildHomeMetadata()` ra file riêng `src/app/[locale]/home-metadata.ts` để file `page.tsx` không mix nhiều namespace (validator chỉ extract first match per file).

Login layout không bị issue tương tự vì chỉ dùng full-path keys + no namespace ở `getTranslations({locale})`.

## Skip / Defer

| Item | Reason |
|---|---|
| Sentry DSN secrets | Ops task, không phải code (cần `wrangler secret put NEXT_PUBLIC_SENTRY_DSN ...`) |
| DRY 5 error.tsx | Reviewer flagged Wave 1C+B+D non-blocking; threshold ≤7 duplicates |
| BYOK bilingual title fix (cosmetic) | Low priority |
| Welcome token race condition (P1) | Architecture-level, separate spike |
| 26 console.log audit, R2 wildcard, magic numbers | Tech debt non-user-facing |
| STATUS_LABELS i18n trong wallet/page.tsx | Reviewer I-6: pre-existing, out of Wave 1D scope |
| `toLocaleDateString()` no locale param trong wallet | Reviewer I-7: defer Wave 1E |
| Hardcoded SITE_URL → process.env.NEXT_PUBLIC_SITE_URL | Reviewer I-1: requires env wiring decision |

## Unresolved questions

- "I have a code" CTA có nên có distinct styling (subtle glow) để draw attention cho FREE100 recipients? Hiện outline parity với cta_demo.
- OG metadata cho các trang public khác (pricing, redeem, blog, guide)? Có nên ship từng cái 1 hay batch trong Wave 1F?
- Switch sang relative URLs (leverage `metadataBase` từ parent layout) thay vì hardcoded production URLs trong page-level metadata?
- Sentry secrets — user có sẵn DSN từ Sentry project chưa? Nếu chưa, tạo project trên Sentry trước rồi mới set CF secrets.
