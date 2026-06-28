# Phase 07: A/B Thumbnails + Template Marketplace

**Priority:** P2 | **Status:** TODO | **Est:** 3-4 days
**Depends on:** Phase 05 (analytics needed for A/B winner selection)

## Overview

Auto-generate 3-5 thumbnail variants per video, A/B test via CTR analytics, auto-select winner. Template marketplace for shareable/sellable video templates.

## A/B Thumbnails

### Requirements
- Auto-generate 3-5 thumbnail variants using existing thumbnail-client.ts
- Variant strategies: different frame selection, text overlay, color scheme
- Rotate thumbnails on YouTube (via API: update video snippet)
- After 48h analytics, select highest-CTR variant as permanent thumbnail
- Dashboard: show variant CTR comparison

### Architecture
- Extend thumbnail-client.ts with variant generation
- D1 `thumbnail_variants` table: variant_id, video_id, ctr, impressions, selected
- Inngest cron: after 48h, query analytics → select winner → update YouTube thumbnail

## Template Marketplace

### Requirements
- Users can save video configs as templates (script structure, visual style, voice, music)
- Templates browsable in Template Library tab (already exists)
- Share templates: public URL, embed code
- PREMIUM+ feature: sell templates (connect to NOWPayments)
- Template ratings and usage count

### Architecture
- Extend existing template-library-tab.tsx
- D1 `marketplace_templates` table: creator_id, price_cents, downloads, rating
- Template preview: 5s sample video render

## Files to Create

- `src/lib/video/thumbnail-variant-generator.ts`
- `src/seed/db/migrations/NNNN_thumbnail_variants.sql`
- `src/seed/db/migrations/NNNN_marketplace_templates.sql`
- `src/forest/inngest/functions/thumbnail-ab-selector.ts`
- `src/app/[locale]/dashboard/videos/components/thumbnail-ab-comparison.tsx`
- `src/seed/db/repositories/marketplace-templates-repo.ts`

## Implementation Steps

- [ ] 1. thumbnail-variant-generator.ts: generate 3-5 variants per video
- [ ] 2. D1 migration: thumbnail_variants table
- [ ] 3. Inngest function: rotate thumbnails, collect CTR, select winner at 48h
- [ ] 4. Thumbnail A/B comparison UI in video detail
- [ ] 5. D1 migration: marketplace_templates table
- [ ] 6. Template save/share/browse functionality
- [ ] 7. Template pricing + purchase flow (NOWPayments)
- [ ] 8. Tests

## Success Criteria

- 3-5 thumbnail variants auto-generated per video
- Winner auto-selected after 48h based on CTR
- Templates shareable and purchasable in marketplace
