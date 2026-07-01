---
title: "Phase 03 — SSG Landing Page Route & SEO Metadata"
status: pending
priority: P1
effort: 5h
blockedBy: [02]
---

# Phase 03 — SSG Landing Page Route & SEO Metadata

## Context Links
- Plan overview: `./plan.md`
- Phase 02 (types, config, LLM fallback): `./phase-02-types-config-and-llm-fallback-generator.md`
- Homepage pattern: `src/app/[locale]/page.tsx` (sections, metadata, JSON-LD)
- Blog page SSG pattern: `src/app/[locale]/blog/page.tsx` (`force-static` + `revalidate`)
- i18n pattern: `next-intl` with `getTranslations()`, locale from `params`
- Metadata API: Next.js 16 `generateMetadata` with `params: Promise<{...}>`

## Overview
Create the dynamic SSG route `/[locale]/ai-video/[niche]/page.tsx` with `generateStaticParams` that builds all published + seeded niche pages at build time. Pages render the 6-section layout (Hero -> Features -> How It Works -> Pricing -> FAQ -> CTA) using bilingual content from D1 (primary) or LLM fallback. SEO metadata per page with `generateMetadata`, og:image via OpenGraph, and schema.org Article structured data.

## Key Insights
- **`generateStaticParams` is a novel pattern for this codebase** — no existing usage. This is the first SSG dynamic route.
- Existing SSG pages use `force-static` + `revalidate` (ISR hybrid), not `generateStaticParams`. The `generateStaticParams` approach is correct for this use case because we need to pre-build all known niche pages.
- Primary content source: D1 via `getBySlug()` (repo from Phase 01). This runs at build time.
- Fallback: LLM generation (Phase 02) for niches NOT in D1. This runs at request time for unknown slugs, then cached in KV.
- Page uses `dynamicParams: true` to allow non-prebuilt niches to be generated on first request (ISR-like behavior with KV caching).
- Reusable section components already exist for the homepage — do NOT duplicate. Extract or reference existing patterns.
- Metadata API: `generateMetadata` can call `getBySlug()` or `generateLandingPageContent()` server-side.
- og:image can be auto-generated via `api/og` route pattern (if exists), or use a static placeholder with niche name overlay.
- JSON-LD Schema.org `Article` type for SEO rich results.

## Requirements
### Functional
- Dynamic route at `/[locale]/ai-video/[niche]/page.tsx`
- `generateStaticParams` returns all slugs from `getAllSlugs()` (D1) + `NICHE_SLUGS` (config)
- Page renders 6 sections: Hero, Features, How It Works, Pricing, FAQ, CTA
- Primary content from D1 `getBySlug()` (build-time for prebuilt, request-time for `dynamicParams`)
- Unknown niches trigger LLM fallback (Phase 02)
- `generateMetadata` produces unique title, description per niche per locale
- OpenGraph image with niche name
- Schema.org Article JSON-LD per page
- Bilingual: VI content when `locale === 'vi'`, EN otherwise

### Non-Functional
- Build must complete without errors for all 15 seeded niches
- Page must not client-fetch primary content (SSG)
- LLM fallback call must not block page render (streaming or skeleton fallback)
- Zero `:any` types
- Cache headers appropriate for CDN (public, s-maxage=3600)

## Architecture

### Route Design
```
app/[locale]/ai-video/[niche]/
  page.tsx              # SSG page component + generateStaticParams + generateMetadata
  loading.tsx           # Skeleton loading state (for dynamicParams paths)
  not-found.tsx         # 404 for truly unknown niches (LLM fails)
```

### Data Flow (Request Time)
```
Request: GET /en/ai-video/real-estate
  -> params: { locale: 'en', niche: 'real-estate' }
  -> generateStaticParams pre-built this → served from CDN (SSG)
  -> If not pre-built (dynamicParams):
    -> getBySlug('real-estate') → D1 hit → render
    -> D1 miss → generateLandingPageContent('real-estate') → LLM → KV cache → render
    -> LLM fail → 404
```

### Page Section Components
| Section | Content Source | Notes |
|---------|---------------|-------|
| Hero | `hero_title_{locale}`, `hero_sub_{locale}` | Full-width banner with CTA button |
| Features | `features_json` parsed | 3-6 feature cards with icons |
| How It Works | Static, from i18n | Same 3-step process for all niches |
| Pricing | Reuse existing pricing component | `@/forest/components/pricing/` or hardcoded tier summary |
| FAQ | `faq_json` parsed | Accordion-style FAQ |
| CTA | Static, from i18n | "Start Creating AI Videos for [Niche]" button |

### SEO Metadata
```typescript
export async function generateMetadata({ params }): Promise<Metadata> {
  const { locale, niche } = await params;
  const page = await getBySlug(niche) ?? await generateLandingPageContent(niche);

  const title = locale === 'vi' ? page.meta_title_vi : page.meta_title_en;
  const description = locale === 'vi' ? page.meta_desc_vi : page.meta_desc_en;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: `/api/og/ai-video/${niche}?locale=${locale}`, width: 1200, height: 630 }],
    },
    alternates: {
      languages: { en: `/en/ai-video/${niche}`, vi: `/vi/ai-video/${niche}` },
      canonical: `/${locale}/ai-video/${niche}`,
    },
  };
}
```

## Related Code Files

| Action | File | Purpose |
|--------|------|---------|
| CREATE | `src/app/[locale]/ai-video/[niche]/page.tsx` | SSG page with generateStaticParams + generateMetadata |
| CREATE | `src/app/[locale]/ai-video/[niche]/loading.tsx` | Skeleton loading state |
| CREATE | `src/app/[locale]/ai-video/[niche]/not-found.tsx` | 404 for failed generation |
| MAYBE | `src/app/api/og/ai-video/[niche]/route.tsx` | OG image generation (optional, depends on existing OG pattern) |

## Implementation Steps

### Step 1: Create route directory and page.tsx
1. Create `src/app/[locale]/ai-video/[niche]/page.tsx`
2. Import types from `@/seed/types/landing-page-types`
3. Import `getBySlug`, `getAllSlugs` from `@/seed/db/repositories/landing-pages-repo`
4. Import `NICHE_SLUGS` from `@/seed/config/niche-list`
5. Import `generateLandingPageContent` from `@/tree/landing/llm-fallback-generator`
6. Import `logger` from `@/seed/utils/logger-utility`

### Step 2: Implement generateStaticParams
```typescript
export async function generateStaticParams() {
  const dbSlugs = await getAllSlugs();
  const allSlugs = [...new Set([...NICHE_SLUGS, ...dbSlugs])]; // deduplicate

  return allSlugs.flatMap((slug) => [
    { locale: 'en', niche: slug },
    { locale: 'vi', niche: slug },
  ]);
}

export const dynamicParams = true; // Allow non-prebuilt niches at request time
```

### Step 3: Implement generateMetadata
1. Extract `niche` and `locale` from params
2. Try `getBySlug(niche)` first
3. Fall back to `generateLandingPageContent(niche)` on miss
4. Return `Metadata` with title, description, og:image, alternates, canonical
5. Error handling: return generic metadata on failure

### Step 4: Implement page component
1. Server component: `export default async function NicheLandingPage({ params })`
2. Extract `niche` and `locale` from `await params`
3. Try `getBySlug(niche)` → use D1 content
4. On null, try `generateLandingPageContent(niche)` → use generated content
5. On error, call `notFound()`
6. Render 6 sections:
   a. **HeroSection**: `hero_title`, `hero_sub` with locale-aware text, CTA button linking to `/signup`
   b. **FeaturesSection**: Grid of feature cards from `features_json` (icon, title, description)
   c. **HowItWorksSection**: Static 3-step process (Record -> AI generates -> Publish), from i18n keys
   d. **PricingSection**: Import existing pricing component or render tier summary grid
   e. **FaqSection**: Accordion from `faq_json` items
   f. **CtaSection**: Final CTA banner with niche name in heading
7. Inject JSON-LD structured data:
```typescript
const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: page.hero_title_en,
  description: page.meta_desc_en,
  inLanguage: locale,
  about: { '@type': 'Thing', name: page.niche_label },
};
```

### Step 5: Create loading.tsx
1. Skeleton component matching page layout structure
2. Use `animate-pulse` Tailwind classes for skeleton rectangles
3. Match the 6-section layout shape

### Step 6: Create not-found.tsx
1. Simple 404 message: "Niche page not found / Không tìm thấy trang"
2. Link back to homepage
3. Bilingual content

### Step 7: Verify build
1. Run `npm run build` — must complete with 0 errors
2. Check that all 30 pages (15 niches x 2 locales) are in build output
3. Verify `generateStaticParams` runs successfully
4. Verify `npm run type-check` passes

## Todo List
- [ ] Create route directory `src/app/[locale]/ai-video/[niche]/`
- [ ] Implement `generateStaticParams` with D1 + NICHE_SLUGS
- [ ] Implement `generateMetadata` with locale-aware title/description
- [ ] Implement page component with 6 sections
- [ ] Add JSON-LD Schema.org Article structured data
- [ ] Create `loading.tsx` skeleton
- [ ] Create `not-found.tsx` 404 page
- [ ] Test build with all 15 seeded niches
- [ ] Verify zero TypeScript errors

## Success Criteria
- 30 SSG pages generated at build (15 niches x 2 locales)
- Each page renders unique bilingual content from D1
- Unknown niche slugs trigger LLM fallback (KV cached after first request)
- SEO metadata unique per page (title, description, og:image, canonical)
- Schema.org Article JSON-LD present in page source
- 404 page shown when LLM fallback fails
- Build completes with zero errors

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `generateStaticParams` DB call fails at build | Low | High | Wrap in try/catch; return NICHE_SLUGS only as fallback |
| LLM fallback slow on first request | Medium | Medium | `loading.tsx` skeleton shown; KV cache prevents repeat |
| OG image route doesn't exist | High | Low | Use static placeholder image; add OG route later (out of scope) |
| 30 pages increase build time significantly | Low | Medium | Each page is ~same cost as blog page; D1 call at build time is fast |
| `dynamicParams: true` pages not cached by CDN | Medium | Medium | Set `Cache-Control` headers in page response for CDN edge caching |

## Security Considerations
- All content is public — no auth required for viewing landing pages
- `generateStaticParams` runs at build time with server-side D1 access
- LLM fallback prompt uses niche slug only — no user input injection risk

## Next Steps
- Phase 04 (Admin CRUD) can run in parallel now (depends on Phase 01+02 only)
- After all phases: integration test, `npm run build` verification, SEO audit
