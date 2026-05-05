# SEO Schema.org JSON-LD — Implementation Report

**Date:** 2026-05-04

## Files Created

| File | LOC |
|---|---|
| `src/lib/seo/schema-org.ts` | 185 |
| `src/lib/seo/__tests__/schema-org.test.ts` | 167 |

## Files Modified

| File | Change |
|---|---|
| `src/app/[locale]/layout.tsx` | +Organization schema script tag in `<head>` |
| `src/app/[locale]/page.tsx` | Converted to async; added FAQPage schema (8 EN items) |
| `src/app/[locale]/pricing/page.tsx` | Added 4x Product schemas + BreadcrumbList |
| `src/app/[locale]/guide/faq/page.tsx` | Added FAQPage (16 VI items) + BreadcrumbList |

## Schemas Added

- **Organization** — root layout `<head>`, alongside existing SoftwareApplication. Logo: `/icons/icon-512x512.png` (largest verified public asset; no logo.png exists). sameAs: GitHub repo + Telegram bot.
- **FAQPage (landing, EN)** — 8 questions from `landing.faq.items.*` translation keys, injected server-side in `[locale]/page.tsx`.
- **FAQPage (guide/faq, VI)** — 16 questions from static arrays in `guide/faq/page.tsx` (Vietnamese content). Separate schema, not merged with EN.
- **Product x4** — BASIC ($199/mo), PREMIUM ($399/mo), ENTERPRISE ($799/mo), MASTER ($4999 lifetime). All injected in `/pricing` server component.
- **BreadcrumbList x2** — `/pricing` (2 items: Home→Pricing) and `/guide/faq` (3 items: Home→Guide→FAQ).

## Tests

- 20/20 pass — `npx vitest run src/lib/seo/__tests__/schema-org.test.ts`
- Covers: JSON roundtrip, required fields, FAQ mapping, Product price formatting, BreadcrumbList ordering, all 4 tier prices in ascending order.

## TypeScript

- `npx tsc --noEmit` — 0 errors. Zero `:any` types.

## Skipped / Notes

- **`@/config/tiers` alias** does not exist in tsconfig; actual path is `@/seed/config/tiers` (verified against 5+ existing usages).
- **Logo**: No `logo.png` in `public/`; using `icon-512x512.png` instead. Document in future: add `/logo.png`.
- **Article schema**: Skipped — blog has no content yet (per audit).
- **HowTo schema**: Skipped — `/guide` pages are static text; no structured steps.
- **AggregateRating**: Skipped — no testimonial data source.
- **Pricing FAQPage schema** (`PricingFaq` component): Component is `"use client"` — schema injected at page level via `pricing/page.tsx` server component instead.

## Summary

6 schemas added across 4 pages (Organization, FAQPage×2, Product×4, BreadcrumbList×2). Zero new deps, zero TypeScript errors, 20 tests pass.
