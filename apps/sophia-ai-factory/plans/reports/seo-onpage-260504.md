# SEO On-Page Fixes Report

**Date:** 2026-05-04
**Status:** All 5 parts complete — 0 new TS errors

---

## Part A: Language Mismatch (CRITICAL) — FIXED

**Root cause:** `src/app/components/sections/hero.tsx` was `"use client"` with 100% hardcoded Vietnamese strings — no `useTranslations()` call. The `<html lang={locale}>` in layout was already dynamic, so the signal mismatch was purely the hero content.

**Fix:** `src/app/components/sections/hero.tsx` — added `import { useTranslations } from "next-intl"` and replaced all 9 hardcoded strings with `t("landing.hero.*")` calls (title_1, title_2, badge, cmd_prefix, cmd_suffix, subtitle, cta_start, cta_demo, trust_*).

**New keys added** to `messages/en.json` + `messages/vi.json` → `landing.hero`:
- `badge`, `cmd_prefix`, `cmd_suffix`, `trust_uptime`, `trust_response`, `trust_security`, `trust_edge`

EN result: H1 = "Video Factory + AI Automation / One Platform — Infinite Scale"
VI result: H1 = "Video Factory + AI Automation / Một Nền Tảng — Vô Hạn Quy Mô"

**Note on `/en` redirect:** `next.config.ts` has `source: '/en', destination: '/', permanent: true` — Google sees `<html lang="en">` at `/` and English H1. Correct.

---

## Part B: Meta Description Trim — FIXED

**File:** `src/app/[locale]/layout.tsx` line 61

Before: 201 chars — "Turn content into empire. The ultimate AI video creation workflow with automated affiliate discovery..."
After: 144 chars — "Sophia: AI video factory + USDT payouts for global creators. 9 affiliate networks, 6 channels (YT/TikTok/IG/Pinterest/LinkedIn/Zalo). From $199."

VI description (for future locale-specific metadata): 139 chars.

---

## Part C: Keywords Meta Removed — FIXED

**File:** `src/app/[locale]/layout.tsx` lines 62-71 (deleted)

Removed 8-item `keywords` array entirely from `Metadata` export. Google ignores this field; removal eliminates stuffing perception risk.

---

## Part D: Cache-Control for Marketing Pages — FIXED

**File:** `next.config.ts` — added new `headers()` entry before the blanket `/:path*` rule.

```
source: '/(|en|vi)(|/pricing|/guide|/guide/:path*|/blog|/blog/:path*|/privacy|/terms|/status|/affiliate-discovery)'
Cache-Control: public, s-maxage=60, stale-while-revalidate=600
```

Auth-gated routes (`/dashboard/*`, `/auth/*`, `/onboarding/*`, `/welcome/*`) do NOT match this pattern — they keep Cloudflare Workers default `no-store`.

Root `/` (marketing landing) covered by empty-suffix match in the pattern.

---

## Part E: Material Symbols Font Swap — FIXED

**File:** `src/app/[locale]/layout.tsx` line 123

Before: `...GRAD@24,400,0,0"`
After: `...GRAD@24,400,0,0&display=swap"`

Adds `font-display: swap` to the Google Fonts stylesheet response, eliminating render-blocking FOIT.

---

## TypeScript

`npx tsc --noEmit` → 0 errors introduced. One pre-existing error in `src/lib/seo/schema-org.ts` (unrelated import) unchanged.
