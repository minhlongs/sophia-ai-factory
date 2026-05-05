# SEO Crawlability Fix Report

**Date:** 2026-05-04
**Audit ref:** plans/reports/seo-260504-0052-gap-audit.md

## Files Modified

| File | Change |
|---|---|
| `src/app/robots.ts` | Added 6 missing Disallow paths: `/auth/`, `/onboarding/`, `/welcome/`, `/redeem/`, `/payment-success/`, `/checkout/` |
| `src/app/sitemap.ts` | Expanded from 10 → 15 path entries (×2 locales = 30 URLs); removed `/setup-wizard`; added guide hub, guide/screens, guide/commands, blog, privacy, terms, status, affiliate-discovery with correct priorities |
| `src/app/[locale]/layout.tsx` | Added `'x-default': 'https://sophia.agencyos.network/en'` to `alternates.languages` |
| `src/app/[locale]/dashboard/layout.tsx` | Added `export const metadata: Metadata = { robots: { index: false, follow: false } }` |

## Files Created

| File | Purpose |
|---|---|
| `src/app/[locale]/auth/layout.tsx` | noindex for login/MFA pages |
| `src/app/[locale]/onboarding/layout.tsx` | noindex for onboarding flow |
| `src/app/[locale]/welcome/layout.tsx` | noindex for token welcome pages |
| `src/app/[locale]/settings/layout.tsx` | noindex for user settings |
| `src/app/[locale]/redeem/layout.tsx` | noindex for promo redemption |
| `src/app/[locale]/payment-success/layout.tsx` | noindex for post-payment confirmation |
| `src/app/[locale]/checkout/layout.tsx` | noindex for checkout flow |
| `public/llms.txt` | Static AI/LLM crawler description per emerging 2026 SEO standard |

## robots.txt Source

`src/app/robots.ts` — Next.js MetadataRoute pattern. Generates `/robots.txt` at build/runtime. No `public/robots.txt` static file exists; the TS source is authoritative.

## Sitemap URL Count

- Before: 20 URLs (10 paths × 2 locales)
- After: 30 URLs (15 paths × 2 locales)

## noindex Applied

- `[locale]/dashboard/**` — via dashboard/layout.tsx metadata export
- `[locale]/auth/**` — new auth/layout.tsx
- `[locale]/onboarding/**` — new onboarding/layout.tsx
- `[locale]/welcome/**` — new welcome/layout.tsx
- `[locale]/settings/**` — new settings/layout.tsx
- `[locale]/redeem/**` — new redeem/layout.tsx
- `[locale]/payment-success/**` — new payment-success/layout.tsx
- `[locale]/checkout/**` — new checkout/layout.tsx
- `setup-wizard/**` — handled by robots.ts Disallow only (sits outside [locale] segment, own layout already handles auth redirect)

## TypeScript Check

Zero errors in modified/created files. One pre-existing error in `src/lib/seo/schema-org.ts` (unrelated — missing `@/config/tiers` module, exists before this PR).

## Skipped / Not In Scope

- Blog dynamic posts from D1: no blog post table accessible at build time; TODO comment left inline in sitemap
- Cache-Control headers: requires `next.config` or middleware changes — out of scope per task constraints
- Organization + FAQPage schema: audit P1 item, separate task
- GSC/Bing Webmaster Tools setup: external action, no code change
