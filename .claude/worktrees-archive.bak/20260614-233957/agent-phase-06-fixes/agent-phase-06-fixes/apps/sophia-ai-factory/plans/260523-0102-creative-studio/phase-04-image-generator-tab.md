---
phase: 4
title: "Image Generator Tab"
status: completed
priority: high
---

# Phase 04 — Image Generator Tab

## Context

- Backend: `src/tree/clients/muapi-media-client.ts` — `submitMediaJob()`, `getJobStatus()`, `SUPPORTED_MODELS.image`
- Supported image models: `midjourney-v7`, `flux-schnell`, `flux-dev`, `hidream`, `flux-kontext`
- Server action from Phase 1: `image-generate-action.ts`
- API routes from Phase 1: `GET/POST /api/v1/creative-studio/images/*`

## Files to Create

1. `src/app/[locale]/dashboard/creative-studio/components/image-generator-tab.tsx` — Main tab
2. `src/app/[locale]/dashboard/creative-studio/components/image-prompt-form.tsx` — Prompt + model + ratio
3. `src/app/[locale]/dashboard/creative-studio/components/image-model-selector.tsx` — Model picker with tier gating
4. `src/app/[locale]/dashboard/creative-studio/components/image-gallery.tsx` — Generated images grid
5. `src/app/[locale]/dashboard/creative-studio/hooks/use-image-generation.ts` — Client-side polling hook

## Data Flow

```
User submits prompt + model + aspect ratio
  -> imageGenerateAction() [Phase 1 server action]
    -> MuAPI submitMediaJob({ type: 'image', ... })
      -> Returns jobId
        -> Client polls GET /api/v1/creative-studio/images/[jobId]/status
          -> On 'completed': show image in gallery
          -> On 'failed': show error message
```

## Implementation Steps

### 1. `image-generator-tab.tsx` (Client Component)

```
'use client'
Props: { tier: Tier }
- Left panel: ImagePromptForm (prompt + model + ratio + generate button)
- Right panel: ImageGallery (previously generated images)
- Responsive: stacks vertically on mobile
```

### 2. `image-prompt-form.tsx`

```
'use client'
Props: { tier, onSubmit, isGenerating }
- Textarea for prompt (min 3, max 1000 chars)
- Negative prompt (optional, collapsible "Advanced" section)
- ModelSelector component
- Aspect ratio picker: 1:1 | 16:9 | 9:16 | 4:3 (button group)
- Generate button (disabled while generating, shows spinner)
```

### 3. `image-model-selector.tsx`

```
'use client'
Props: { tier, selected, onSelect }
- Radio group or select dropdown
- Tier gating:
  - BASIC: flux-schnell only
  - PREMIUM: flux-schnell, flux-dev, hidream
  - ENTERPRISE: + flux-kontext
  - MASTER: all (+ midjourney-v7)
- Locked models show lock icon + "Upgrade to unlock"
- Model descriptions (speed vs quality trade-off)
```

### 4. `image-gallery.tsx`

```
'use client'
Props: { userId }
- Fetches GET /api/v1/creative-studio/images on mount
- Grid layout: 2 cols mobile, 3 cols tablet, 4 cols desktop
- Each card: thumbnail, model badge, status badge, timestamp
- Click to expand (lightbox or modal)
- Download button (direct R2 URL)
- "Use in Campaign" button (copies URL to clipboard)
- Empty state: illustration + "Generate your first image"
```

### 5. `use-image-generation.ts` (Hook)

```
- Manages generation state: idle | generating | polling | completed | error
- On submit: call imageGenerateAction() -> get jobId
- Poll: setInterval(3000) -> GET /api/v1/creative-studio/images/[jobId]/status
- Stop polling on 'completed' | 'failed' | after 5 min timeout
- Returns: { generate, status, result, error, isGenerating }
```

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| MuAPI key not configured | Medium | Check BYOK store, show "Configure MuAPI key" card |
| Long image generation time (Midjourney ~60s) | Low | Clear progress indicator + polling with backoff |
| R2 URL expiry | Low | MuAPI returns permanent URLs; store in D1 for cache |

## Todo

- [x] Create `image-generator-tab.tsx` with split-panel layout
- [x] Create `image-prompt-form.tsx` with prompt + negative prompt + ratio
- [x] Create `image-model-selector.tsx` with tier gating
- [x] Create `image-gallery.tsx` with grid + lightbox
- [x] Create `use-image-generation.ts` polling hook
- [x] Verify each file < 200 lines

## Success Criteria

- [ ] User can enter prompt, select model (gated by tier), choose ratio
- [ ] Generate button submits and shows polling status
- [ ] Completed images appear in gallery
- [ ] Gallery loads previous images on mount
- [ ] Download and "Use in Campaign" actions work
- [ ] Locked models show upgrade prompt
