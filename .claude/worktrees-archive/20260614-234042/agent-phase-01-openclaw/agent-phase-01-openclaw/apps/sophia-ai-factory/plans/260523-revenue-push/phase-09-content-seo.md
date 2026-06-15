# Phase 09: Content & SEO Enhancement

**Priority:** LOW | **Impact:** Organic traffic + search visibility
**Status:** TODO

## Problem
- Schema.org builders exist but JSON-LD not injected on key pages
- Blog is 3 hardcoded posts redirecting to guide pages — no real CMS
- No FAQ structured data on /guide/faq
- No Product structured data on /pricing
- No breadcrumb markup on guide subpages
- Missing meta descriptions on several pages

## Tasks

- [ ] 9.1 Inject JSON-LD structured data on key pages
      - Homepage: Organization schema
      - Pricing: Product schema for each tier (use buildProductSchema from lib/seo)
      - FAQ/Guide: FAQPage schema (use buildFAQSchema)
      - Guide subpages: BreadcrumbList schema
      - File: respective page.tsx files + layout

- [ ] 9.2 Enhance blog with more posts
      - Add 3-5 more blog posts relevant to target audience:
        - "How Non-Tech CEOs Use AI to Create Video Content"
        - "5 Ways to Earn Passive Income with Sophia Affiliate Program"
        - "USDT Payments Explained: A Simple Guide for Business Owners"
        - "From Zero to Revenue: Your First Week with Sophia"
      - Keep as static content (no CMS needed for MVP)
      - Add proper metadata per post
      - File: `src/app/[locale]/blog/page.tsx` — add to POSTS array

- [ ] 9.3 Add RSS feed
      - Create `/blog/feed.xml` route
      - Include all blog posts with title, description, pubDate
      - File: `src/app/blog/feed.xml/route.ts`

- [ ] 9.4 Enhance meta descriptions
      - Audit key pages for missing/weak meta descriptions
      - Landing, pricing, guide, affiliate pages
      - Bilingual descriptions

- [ ] 9.5 Add sitemap entries for new pages
      - Ensure blog posts, affiliate pages included in sitemap.ts
      - Check dynamic route coverage

## Files to Modify
- `src/app/[locale]/page.tsx` — Organization JSON-LD
- `src/app/[locale]/pricing/page.tsx` — Product JSON-LD
- `src/app/[locale]/guide/faq/page.tsx` — FAQPage JSON-LD
- `src/app/[locale]/blog/page.tsx` — more posts + metadata
- `src/app/blog/feed.xml/route.ts` — new RSS route
- `src/app/sitemap.ts` — add entries
- `messages/en.json` + `messages/vi.json` — meta descriptions

## Constraints
- Use existing schema-org.ts builders (don't reinvent)
- Blog stays static (no DB/CMS) — just add more entries to POSTS array
- Bilingual meta descriptions
- JSON-LD must be valid (test with Google Rich Results Test)

## Success Criteria
- JSON-LD on homepage, pricing, FAQ pages
- 6+ blog posts total
- RSS feed at /blog/feed.xml
- Build passes
