---
title: "Creative Studio — Full Media Suite Dashboard"
description: "Unified media creation hub at /dashboard/creative-studio with video, image, audio, templates, and brand assets tabs"
status: done
priority: P1
effort: 12h
branch: master
tags: [dashboard, media, creative-studio, ui]
created: 2026-05-23
---

# Creative Studio — Full Media Suite

## Summary

Add `/dashboard/creative-studio` page: a tabbed media creation hub unifying video (HeyGen + ElevenLabs + existing pipeline), image (MuAPI), audio (ElevenLabs TTS), templates, and brand assets. All backend infrastructure exists — this is primarily a UI + server action + API route effort.

## Architecture Decision

- Route: `src/app/[locale]/dashboard/creative-studio/`
- Tab navigation: client component with URL search params (`?tab=video|image|audio|templates|brand`)
- Server actions: new `generateImage` action in `src/app/actions/`
- API routes: new under `src/app/api/v1/creative-studio/`
- Reuse: existing `video-generate-action.ts`, `muapi-media-client.ts`, `elevenlabs-api-client.ts`, `org-branding-repo.ts`, `seed/templates/presets.ts`

## Data Flow

```
User Input (prompt/script/text)
  -> Client Component (form validation, tier check)
    -> Server Action / API Route
      -> Existing Backend Client (MuAPI / ElevenLabs / HeyGen / Inngest)
        -> R2 Storage (result)
          -> Poll status API / Inngest callback
            -> Display result in gallery/player
```

## Phases

| # | Phase | Status | Effort | Deps |
|---|-------|--------|--------|------|
| 1 | [Server actions + API routes](phase-01-server-actions-api-routes.md) | pending | 2h | none |
| 2 | [Page layout + tab navigation](phase-02-page-layout-tabs.md) | pending | 1.5h | none |
| 3 | [Video Creator tab](phase-03-video-creator-tab.md) | pending | 2h | P1, P2 |
| 4 | [Image Generator tab](phase-04-image-generator-tab.md) | pending | 2h | P1, P2 |
| 5 | [Audio Studio tab](phase-05-audio-studio-tab.md) | pending | 1.5h | P1, P2 |
| 6 | [Template Library + Brand Assets](phase-06-templates-brand-assets.md) | pending | 1.5h | P2 |
| 7 | [i18n keys + tests](phase-07-i18n-tests.md) | pending | 1.5h | P1-P6 |

## Key Constraints

- BYOK doctrine: all AI calls use customer's own keys (resolved via existing BYOK store)
- Tier gating: BASIC users see fewer models; ENTERPRISE/MASTER unlock all
- Reuse existing backend clients — NO new AI client code
- Files under 200 lines each
- Bilingual: all user-facing strings via `next-intl` (en.json + vi.json)
- Zero `:any` types

## Rollback

Each phase is additive (new files only). Rollback = delete `creative-studio/` directory + revert sidebar link + remove i18n keys. No DB migrations required.

## Success Criteria

- [ ] `/dashboard/creative-studio` renders with 5 tabs
- [ ] Video tab dispatches to existing Inngest pipeline
- [ ] Image tab generates via MuAPI with polling
- [ ] Audio tab generates TTS via ElevenLabs
- [ ] Templates tab shows campaign + video templates
- [ ] Brand tab shows org branding assets
- [ ] All features gated by tier
- [ ] en.json + vi.json keys added and passing parity test
- [ ] `npm run build` passes, `npm test` passes
