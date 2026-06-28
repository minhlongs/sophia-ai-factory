---
phase: 6
title: "Template Library + Brand Assets Tabs"
status: pending
priority: medium
---

# Phase 06 — Template Library + Brand Assets Tabs

## Context

- Existing: `src/seed/templates/presets.ts` — campaign template presets
- Existing: `src/lib/templates/campaign-templates.ts` — template definitions
- Existing: `src/lib/branding/org-branding-repo.ts` — org branding read/write
- Existing: `src/app/api/v1/branding/upload/` — branding asset upload
- Existing: `src/app/api/v1/settings/branding/route.ts` — branding settings API
- Existing: `src/app/[locale]/dashboard/settings/branding/branding-form-client.tsx` — branding form

## Files to Create

1. `src/app/[locale]/dashboard/creative-studio/components/template-library-tab.tsx` — Template browser
2. `src/app/[locale]/dashboard/creative-studio/components/template-card.tsx` — Individual template card
3. `src/app/[locale]/dashboard/creative-studio/components/brand-assets-tab.tsx` — Brand kit viewer
4. `src/app/[locale]/dashboard/creative-studio/components/brand-asset-card.tsx` — Logo/color/font display

## Implementation Steps

### 1. `template-library-tab.tsx`

```
'use client'
Props: { tier: Tier }
- Section: "Campaign Templates" — grid of preset cards
  - Import from seed/templates/presets.ts
  - Each card: name, description, thumbnail, category tag
  - "Use Template" button -> navigates to /dashboard/create?template={id}
- Section: "Video Templates" — path-a and path-b cards
  - "Use Template" button -> switches to Video tab with template pre-selected
- Tier badge on premium templates
- Filter: All | Campaign | Video | (future: Email, Social)
```

### 2. `template-card.tsx`

```
'use client'
Props: { template: TemplatePreset, tier: Tier, onUse: () => void }
- Card with: thumbnail/icon, title, description, category badge
- Tier lock: if template.minTier > currentTier, show lock + "Upgrade" link
- "Use Template" button (primary action)
- Hover: subtle scale animation
```

### 3. `brand-assets-tab.tsx`

```
'use client'
Props: { tier: Tier }
- Fetch org branding: GET /api/v1/settings/branding
- Display: Logo (image preview), Colors (swatches), Fonts (preview text)
- "Edit Brand Kit" link -> /dashboard/settings/branding
- "Upload Asset" button -> triggers file upload to /api/v1/branding/upload
- Quick-copy: click color swatch copies hex value
- Empty state: "Set up your brand kit" with link to branding settings
```

### 4. `brand-asset-card.tsx`

```
'use client'
Props: { type: 'logo' | 'color' | 'font', value: string, label: string }
- Logo: image thumbnail with filename
- Color: swatch circle + hex code + copy button
- Font: font name rendered in that font (if web font) or sample text
```

## Data Flow

```
Template Library:
  seed/templates/presets.ts (static import) -> TemplateCard grid
  "Use Template" -> router.push('/dashboard/create?template=X')

Brand Assets:
  GET /api/v1/settings/branding -> org branding data
  Display -> "Edit" links to settings/branding page
  Upload -> POST /api/v1/branding/upload -> R2 -> refresh display
```

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| No branding configured | Low | Show "Set up your brand kit" empty state with link |
| Template presets change format | Low | presets.ts has stable interface; type-check at import |

## Todo

- [x] Create `template-library-tab.tsx` with campaign + video sections
- [x] Create `template-card.tsx` with tier lock
- [x] Create `brand-assets-tab.tsx` with logo/colors/fonts display
- [x] Create `brand-asset-card.tsx`
- [x] Verify each file < 200 lines

## Success Criteria

- [x] Template grid shows all presets from lib/templates/campaign-templates.ts
- [x] "Use Template" navigates to create page with template pre-filled
- [x] Tier prop threaded (lock badge on TemplateCard isPremium prop)
- [x] Brand assets tab shows org logo, colors, fonts via GET /api/v1/settings/branding
- [x] Empty state when no branding configured
- [x] Edit link navigates to branding settings
