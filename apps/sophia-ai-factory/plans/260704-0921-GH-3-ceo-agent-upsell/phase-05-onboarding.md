---
phase: 5
title: "Onboarding"
status: completed
effort: "2026-07-06"
---

# Phase 5: Onboarding

## Overview
Adds a first-use experience for the CEO Agent dashboard (`/dashboard/ceo-agent`). When a
PREMIUM+ user visits the dashboard for the first time, a welcome card plus a 4-step tour
overlay introduces Briefing, Campaigns, Revenue, and Chat. Dismissal is persisted in
`localStorage` and the tour only appears for eligible tiers.

## Context Links
- Dashboard page: `src/app/[locale]/dashboard/ceo-agent/page.tsx` (Phase 1)
- CEO Agent shell: `src/app/[locale]/dashboard/ceo-agent/ceo-agent-shell.tsx` (Phase 1)
- Dashboard tiles: `src/app/[locale]/dashboard/ceo-agent/ceo-agent-dashboard.tsx` (Phase 1)
- Parallel in-flight work: P3 owns `campaigns-client.tsx` inside `campaigns/` (DO NOT TOUCH)

## Requirements
- [x] Welcome card + 4-step tour for first-time visitors to `/dashboard/ceo-agent`
- [x] LocalStorage persists dismissal (`sophia_ceo_dashboard_tour_dismissed`)
- [x] Tour is gated: BASIC users never see it (tier check happens in shell — no duplicate gate)
- [x] Dismiss + restart via shell re-render
- [x] Bilingual i18n keys for Vietnamese + English under `dashboard.ceoAgent.onboarding_tour`
- [x] Tests cover happy render, localStorage dismissal, step progression, tier gating

## Architecture
```
src/
  forest/components/agents/
    ceo-agent-dashboard-tour-config.ts          -- step config + storage constant
    ceo-agent-dashboard-onboarding-wrapper.tsx   -- root entry: welcome card + overlay
    ceo-agent-dashboard-tour-overlay.tsx         -- 4-step modal (reuses pattern)
  app/[locale]/dashboard/ceo-agent/
    page.tsx                                     -- lazy-loads wrapper, PREMIUM+ only
    __tests__/
      ceo-agent-onboarding.test.tsx              -- Phase 5 tests (new)
```

Wire: server `page.tsx` lazy-loads the client wrapper via `next/dynamic` and mounts it
inside the `hasAccess` branch alongside `CeoAgentShell`. No new API routes; no D1 writes.

## Files
- **CREATE** `src/forest/components/agents/ceo-agent-dashboard-tour-config.ts`
- **CREATE** `src/forest/components/agents/ceo-agent-dashboard-tour-overlay.tsx`
- **CREATE** `src/forest/components/agents/ceo-agent-dashboard-onboarding-wrapper.tsx`
- **MODIFY** `src/app/[locale]/dashboard/ceo-agent/page.tsx`
- **MODIFY** `messages/en.json`
- **MODIFY** `messages/vi.json`
- **CREATE** `src/app/[locale]/dashboard/ceo-agent/__tests__/ceo-agent-onboarding.test.tsx`

## Implementation Steps
1. Add tour config with 4 steps and a distinct `localStorage` key (`sophia_ceo_dashboard_tour_dismissed`).
2. Build tour overlay (modal mirroring `agents` pattern but keyed to `dashboard.ceoAgent.onboarding_tour`).
3. Build wrapper that renders welcome card + tour overlay, dismissible, SSR-safe via `mounted` gate.
4. Wire wrapper into `page.tsx` via `next/dynamic` import inside the `hasAccess` branch.
5. Add `dashboard.ceoAgent.onboarding_tour` + `dashboard.ceoAgent.onboarding` i18n keys to `en.json` and `vi.json`.
6. Write unit tests (render mounted, skip/finish, step propagation, dismissal, BASIC denied).
7. Run `npm run type-check && npx vitest run src/app/[locale]/dashboard/ceo-agent/__tests__/ceo-agent-onboarding.test.tsx`.
8. Update `plan.md` Phase 5 status to `completed`.

## Tests
- Test: `ceo-agent-dashboard-onboarding-wrapper` renders nothing until `mounted`
- Test: dismissed state hides card + overlay
- Test: first visit auto-shows overlay
- Test: start tour from welcome card opens overlay at step 1
- Test: next/back advance through tour steps (4 total)
- Test: finish sets localStorage
- Test: skip sets localStorage
- Test: i18n keys exist in both `en.json` and `vi.json`
- Existing `ceo-agent-tier-gate.test.tsx` must still pass

## Risks & Rollback
- Risk: Tour blocks specialist P2/P3/P4 routes when testing. Mitigation: wrapper is opt-in only dispatched from the root page.
- Rollback: Delete forest wrapper files, revert `page.tsx` edit, remove added i18n keys.

## Next Steps
- Phase 5 does not block later phases; it is additive.
- After Phase 5, CEO Agent onboarding is feature complete.
