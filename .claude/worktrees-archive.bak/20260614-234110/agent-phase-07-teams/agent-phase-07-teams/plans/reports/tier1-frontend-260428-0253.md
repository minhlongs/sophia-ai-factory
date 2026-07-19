# Tier-1 Frontend Fixes — Implementation Report

**Date:** 2026-04-28
**Scope:** videos route i18n + a11y + route boundaries
**Status:** COMPLETE

---

## Files Modified (12 existing + 3 created + 1 test fix)

### Existing files updated
| File | Changes |
|---|---|
| `messages/en.json` | Added `dashboard.videos` (50+ keys) + `dashboard.errors` (10 keys) |
| `messages/vi.json` | Same namespaces, natural Vietnamese translations |
| `dashboard/error.tsx` | `useTranslations('dashboard.errors')`, locale-aware redirect, removed `console.error`, `min-h-[44px]` on buttons |
| `videos/page.tsx` | `getTranslations`, locale-aware `redirect`, `min-h-[44px]` on New Video link |
| `videos/[id]/page.tsx` | `getTranslations`, locale-aware `redirect` |
| `videos/new/page.tsx` | `getTranslations`, locale-aware `redirect`, accepts `params` |
| `videos/components/video-gallery.tsx` | `useTranslations`, `<img>` → `<Image unoptimized>` (400×225), `motion-reduce:animate-none` |
| `videos/components/video-detail-client.tsx` | `useTranslations`, `min-h-[44px]` on action anchors, `motion-reduce:animate-none` |
| `videos/new/components/video-creator-wizard.tsx` | `useTranslations`, `aria-current="step"`, `min-h-[44px]` on buttons, `videoId` typed `string\|null` |
| `videos/new/components/script-step.tsx` | `useTranslations`, `min-h-[44px]` on buttons, `motion-reduce:animate-none` |
| `videos/new/components/asset-picker.tsx` | `useTranslations`, `aria-pressed`, focus ring, `<img>` → `<Image unoptimized>` (80×80), `motion-reduce:animate-none` |
| `videos/new/components/render-status.tsx` | `useTranslations`, `motion-reduce:animate-none` |

### New files created
- `videos/error.tsx` — videos segment error boundary (client, i18n, retry button)
- `videos/loading.tsx` — videos segment loading state (Loader2 spinner)
- `videos/[id]/not-found.tsx` — async server component, links back to gallery

### Test fix (collateral — my changes broke it)
- `video-creator-wizard.test.tsx` — added `vi.mock("next-intl")` with key map to restore 2 failing tests

---

## Tasks Completed

- [x] T1 — `dashboard.videos` namespace (50 keys) in both locale files
- [x] T1 — All server pages use `getTranslations`, all client components use `useTranslations`
- [x] T2 — `dashboard/error.tsx` fully localized via `dashboard.errors` namespace + `useLocale()` redirect
- [x] T3 — 4 hardcoded `/login` redirects fixed to `localizedHref(locale, '/login')`
- [x] T4 — 3 route boundaries created (`videos/error.tsx`, `videos/loading.tsx`, `videos/[id]/not-found.tsx`)
- [x] T5 — `aria-pressed` + `focus-visible:ring-2` on avatar/voice toggle buttons
- [x] T6 — `min-h-[44px]` on New Video link, Open/Download anchors, wizard Back/Create/Generate/UseScript buttons
- [x] T7 — `<img>` → `next/image` with `unoptimized` (HeyGen URLs not in remotePatterns), explicit width/height
- [x] L1 — Removed `console.error` from dashboard/error.tsx
- [x] M5 — Added `motion-reduce:animate-none` to all `Loader2 animate-spin` usages
- [x] M1 (partial) — `aria-current="step"` on wizard `<li>`, step labels now from i18n keys

---

## Verification

- Build: **pass** (exit 0, 0 new errors — pre-existing `ignoreBuildErrors: true` unchanged)
- Tests: **1582 passed, 31 skipped** (0 failures — restored 2 broken tests via next-intl mock)

---

## Notes / Deviations

- Used `unoptimized` on `next/image` for HeyGen avatar/thumbnail URLs — HeyGen CDN hostnames are not in `next.config.ts` remotePatterns and are dynamic per account. Adding `unoptimized` avoids 400 errors from image optimizer while still getting explicit `width`/`height` layout stability.
- `dashboard.errors` namespace keys use descriptive suffix (e.g. `authExpired` / `authExpiredDesc`) rather than `auth_expired` to match camelCase convention used in existing `dashboard.*` keys.
- `video-creator-wizard.test.tsx` is not in the ownership list but was broken by my changes — added minimal `vi.mock("next-intl")` to restore tests. No new test cases added.

---

## Unresolved Questions

1. Should HeyGen hostname(s) be added to `next.config.ts` `remotePatterns` to enable image optimization? Requires knowing account-specific CDN domain (e.g. `resource.heygen.ai`). Currently using `unoptimized` as safe fallback.
2. `dashboard/error.tsx` previously used Vietnamese-only strings intentionally (per audit note Q4) — PM should confirm EN translations are acceptable.
