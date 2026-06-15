---
phase: 2
title: "Features redesign + Creative Studio showcase section"
status: done
priority: P1
effort: 2h
blocked_by: [phase-01]
---

# Phase 02: Features Redesign + Creative Studio Showcase

## Context

- [Features section](../../src/app/components/sections/features.tsx) — after Phase 1 has i18n wiring
- Creative Studio dashboard has 5 tabs: video creator, image generator, audio studio, brand assets, template library
- Located at: `src/app/[locale]/dashboard/creative-studio/components/`
- No landing page presence for this flagship feature
- `messages/en.json` has NO `landing.creative_studio` key yet

## Requirements

### Functional
- Update Features bento grid content to reflect actual product capabilities (Creative Studio, not stale SDK references)
- Add new "Creative Studio Showcase" section between Features and RaasDemoTerminal
- Both en + vi translations for new section

### Non-Functional
- New section file under 200 lines
- Pure CSS animations only (no framer-motion)
- Mobile-first responsive
- Maintain page.tsx dynamic import pattern with ScrollReveal

## Architecture

### Features Content Update

Replace the 4-card bento grid items with current product capabilities:

| Card | Key | Icon | Span | Content Focus |
|------|-----|------|------|--------------|
| 1 | `creative_studio` | `palette` | `md:col-span-2` | Creative Studio — 5-in-1 media suite (video, image, audio, brand, templates) |
| 2 | `video_factory` | `videocam` | `` | AI Video — HeyGen + ElevenLabs BYOK, auto-subtitle |
| 3 | `smart_campaigns` | `campaign` | `` | Campaign automation — multi-channel distribution |
| 4 | `affiliate_engine` | `handshake` | `md:col-span-2` | Affiliate marketing — auto-discovery, commission tracking |

### Creative Studio Showcase Section

New file: `src/app/components/sections/creative-studio-showcase.tsx`

**Layout:** Horizontal tab-style showcase with 5 media type cards in a scrollable row (mobile) / grid (desktop).

**Data flow:**
```
messages/{locale}.json → landing.creative_studio.tabs.{video,image,audio,brand,templates}
  → each tab: { title, description, icon, features: string[] }
```

**Visual design:**
- Section badge: "Creative Studio" with neon-pink accent
- 5 cards in a `grid-cols-2 md:grid-cols-5` layout
- Each card: icon + title + 3 bullet features + gradient hover glow
- Background: gradient mesh orb (purple/pink) — consistent with space theme
- Use existing `.gradient-border` and `.stagger-reveal` CSS classes

### Page Integration

**File:** `src/app/[locale]/page.tsx` — add dynamic import + ScrollReveal wrapper

Insert between Features and RaasDemoTerminal (current order):
```
Features → CreativeStudioShowcase → RaasDemoTerminal
```

## Related Code Files

### Modify
- `src/app/components/sections/features.tsx` — update card keys to match new i18n content
- `src/app/[locale]/page.tsx` — add dynamic import for CreativeStudioShowcase
- `messages/en.json` — add `landing.creative_studio` and update `landing.features.items`
- `messages/vi.json` — mirror keys

### Create
- `src/app/components/sections/creative-studio-showcase.tsx` (~150 lines)

## Implementation Steps

### 1. Add translation keys

**`messages/en.json` under `landing`:**

```json
"creative_studio": {
  "badge": "Creative Studio",
  "title": "Your Complete Media Suite",
  "subtitle": "Create professional video, images, and audio — all from one dashboard",
  "tabs": {
    "video": {
      "title": "AI Video Creator",
      "description": "Generate talking-head videos with AI avatars",
      "features": ["HeyGen integration", "Auto-subtitles", "Script-to-video pipeline"]
    },
    "image": {
      "title": "Image Generator",
      "description": "Create stunning visuals with multiple AI models",
      "features": ["Multi-model support", "Brand-consistent output", "Batch generation"]
    },
    "audio": {
      "title": "Audio Studio",
      "description": "Clone voices and generate professional narration",
      "features": ["ElevenLabs TTS", "Voice cloning", "Multi-language support"]
    },
    "brand": {
      "title": "Brand Assets",
      "description": "Manage logos, colors, and brand guidelines",
      "features": ["Asset library", "Brand consistency", "Quick access"]
    },
    "templates": {
      "title": "Template Library",
      "description": "Pre-built templates for common content types",
      "features": ["Industry templates", "Custom templates", "One-click start"]
    }
  }
}
```

**`messages/vi.json`** — mirror with Vietnamese translations.

### 2. Update Features card keys

Update the `FEATURE_CARDS` config array (from Phase 1) to use the new card keys:

```ts
const FEATURE_CARDS = [
  { key: "creative_studio", icon: "palette", span: "md:col-span-2", gradient: "from-pink-500/20 to-purple-500/10" },
  { key: "video_factory", icon: "videocam", span: "", gradient: "from-purple-500/20 to-violet-500/10" },
  { key: "smart_campaigns", icon: "campaign", span: "", gradient: "from-cyan-500/20 to-blue-500/10" },
  { key: "affiliate_engine", icon: "handshake", span: "md:col-span-2", gradient: "from-green-500/20 to-emerald-500/10" },
];
```

Add corresponding `landing.features.items.{creative_studio,video_factory,smart_campaigns,affiliate_engine}` to both message files.

### 3. Create `creative-studio-showcase.tsx`

```
"use client" component
- useTranslations('landing.creative_studio')
- 5-card grid with tab data from i18n
- ScrollReveal + stagger-reveal for entrance animation
- gradient-border cards with hover glow
- Responsive: 2-col mobile → 5-col desktop (or 3-col tablet, 5-col desktop)
- Background orb with neon-pink
- CTA button: "Try Creative Studio" → /dashboard/creative-studio
```

Target: ~150 lines.

### 4. Wire into page.tsx

Add dynamic import after Features:

```tsx
const CreativeStudioShowcase = dynamic(
  () => import("@/app/components/sections/creative-studio-showcase").then(m => ({ default: m.CreativeStudioShowcase })),
  { loading: () => <SectionSkeleton /> }
);
```

Insert in JSX after Features ScrollReveal, before RaasDemoTerminal.

## Todo List

- [ ] Add `landing.creative_studio` keys to `messages/en.json`
- [ ] Add `landing.creative_studio` keys to `messages/vi.json`
- [ ] Update `landing.features.items` keys in both message files (new card content)
- [ ] Update `FEATURE_CARDS` in `features.tsx` with new keys
- [ ] Create `creative-studio-showcase.tsx` (~150 lines)
- [ ] Add dynamic import + ScrollReveal in `page.tsx`
- [ ] Run `npm run build` — 0 errors
- [ ] Test locale switching (en/vi) for new section
- [ ] Verify responsive at 375px, 768px, 1280px

## Success Criteria

- Creative Studio showcase visible on landing page between Features and Demo Terminal
- 5 media type cards render with correct i18n text
- Clicking CTA navigates to `/dashboard/creative-studio`
- All text translates correctly between en/vi
- File under 200 lines

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Section adds too much vertical height on mobile | Medium | Low | Use compact card layout; 2-col grid on mobile |
| Translation key typo → raw keys shown | Medium | High | Grep check before build |
| Page.tsx import order breaks ScrollReveal stagger | Low | Low | Test scroll behavior after integration |

## Failure Modes

1. **Dynamic import fails** → section skeleton shown permanently. Mitigation: verify named export matches import `.then()` destructure.
2. **i18n key array features not supported** → use comma-separated string and split, or numbered keys `feature_1`, `feature_2`, `feature_3`.
3. **Material Symbols icon not available** → fallback to Lucide or emoji. Verify `palette`, `campaign`, `handshake` exist in Material Symbols Outlined.
