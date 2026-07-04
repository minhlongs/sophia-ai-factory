---
phase: 4
title: "B2-Landing Page Expansion"
status: completed
effort: "Small (hours)"
priority: P1
dependencies: []
track: B
---

# Phase 4: B2-Landing Page Expansion

## Overview

Expand programmatic landing pages from 25 to 50+ niches. System already auto-generates bilingual SEO content via LLM. Adding a niche is minutes of work.

## Context

- 25 niches in `seed/config/niche-list.ts`
- Route: `/[locale]/ai-video/[niche]` — SSG-generated
- Content cascade: D1 → KV cache (7-day TTL) → LLM fallback (OpenRouter gpt-4o-mini)
- Bilingual EN+VI auto-generated
- Admin CRUD at `/dashboard/admin/landing-pages`

## Implementation Steps

1. Identify 25+ high-value niches using sitemap/affiliate data (zero-gap-runner + affiliate-niche-enhancer)
2. Add slugs to `NICHE_SLUGS` + `NICHE_LABELS` in `seed/config/niche-list.ts`
3. Run build — `generateStaticParams` picks up new pages automatically
4. Verify new pages render in both locales

## Success Criteria

- [ ] 50+ niche landing pages live and bilingual
- [ ] Each page has unique SEO metadata
- [ ] LLM auto-generates content for all new niches
- [ ] Build succeeds with no errors
