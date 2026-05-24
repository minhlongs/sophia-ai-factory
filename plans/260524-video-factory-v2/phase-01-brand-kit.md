# Phase 01: Brand Kit Enforcement

**Priority:** P1 | **Status:** TODO | **Est:** 3-4 days
**Depends on:** Nothing (foundation phase)

## Overview

Users upload brand assets (logo, intro/outro clips, colors, font) once. Every video auto-applies these during FFmpeg composition.

## Requirements

### Functional
- Brand Kit setup form in Creative Studio settings
- Upload logo (PNG/SVG), intro clip (MP4 ≤5s), outro clip (MP4 ≤5s), font (WOFF2)
- Set primary + secondary brand colors (hex picker)
- Logo watermark: 10% video width, 80% opacity, configurable corner position
- Intro/outro concatenation in FFmpeg pipeline
- Caption styling: brand colors applied via ASS format (not SRT)
- Brand kit preview before save

### Non-functional
- R2 storage: `brand-kits/{user_id}/` namespace
- D1 `brand_kits` table for metadata
- Max file sizes: logo 2MB, intro/outro 20MB each, font 5MB
- BYOK: no platform credentials needed

## Architecture

### D1 Schema
```sql
CREATE TABLE brand_kits (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  user_id TEXT NOT NULL,
  logo_r2_key TEXT,
  intro_r2_key TEXT,
  outro_r2_key TEXT,
  font_r2_key TEXT,
  primary_color TEXT DEFAULT '#000000',
  secondary_color TEXT DEFAULT '#FFFFFF',
  logo_position TEXT DEFAULT 'bottom-right',
  logo_opacity REAL DEFAULT 0.8,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### FFmpeg Integration
Inject into existing `composer-ffmpeg.ts`:
```
[intro] + [main_with_watermark] + [outro]
- Logo overlay: scale=iw*0.1:-1, colorchannelmixer=aa=0.8
- Caption: ASS with brand colors (hex→BGR conversion)
```

### R2 Layout
```
r2://sophia-brand-kits/{user_id}/
  ├── logo.png
  ├── intro.mp4
  ├── outro.mp4
  ├── fonts/brand-font.woff2
  └── config.json
```

## Files to Create/Modify

### Create
- `src/seed/db/migrations/NNNN_brand_kits.sql`
- `src/seed/db/repositories/brand-kits-repo.ts`
- `src/app/actions/brand-kit-action.ts` (server action: save/load brand kit)
- `src/app/[locale]/dashboard/creative-studio/components/brand-kit-form.tsx`
- `src/lib/video/brand-kit-composer.ts` (FFmpeg filter graph builder)

### Modify
- `src/lib/video/composer-ffmpeg.ts` — integrate brand kit into composition
- `src/forest/inngest/functions/video-compose.ts` — fetch brand kit before compose
- `src/app/[locale]/dashboard/creative-studio/components/brand-assets-tab.tsx` — add brand kit UI
- `src/lib/video/subtitle-generator.ts` — ASS color injection

## Implementation Steps

- [ ] 1. Create D1 migration for brand_kits table
- [ ] 2. Create brand-kits-repo.ts with CRUD ops
- [ ] 3. Create brand-kit-action.ts server action (upload to R2 + save metadata)
- [ ] 4. Build brand kit setup form (logo upload, color picker, intro/outro upload)
- [ ] 5. Implement brand-kit-composer.ts (FFmpeg filter graph with watermark + concat)
- [ ] 6. Integrate into composer-ffmpeg.ts (load brand kit → apply filters)
- [ ] 7. Update subtitle-generator.ts for ASS brand color injection
- [ ] 8. Update video-compose Inngest function to fetch brand kit
- [ ] 9. Add brand kit preview (render 5s sample with overlay)
- [ ] 10. Tests: brand kit CRUD, FFmpeg filter generation, ASS color conversion

## Success Criteria

- User can upload full brand kit (logo, intro, outro, colors, font)
- Generated videos automatically include watermark + intro/outro
- Captions use brand colors
- Existing videos without brand kit continue to work unchanged
