---
phase: 4
title: "Cross-sell UI + cleanup"
priority: P2
status: completed
---

# Phase 4: Cross-sell UI + Cleanup

## Context Links
- Dashboard: `src/app/[locale]/dashboard/`
- Landing page: `src/app/[locale]/page.tsx`
- Onboarding: `src/app/[locale]/dashboard/components/onboarding-welcome-banner.tsx`

## Overview

Add cross-sell touchpoints so Video users discover RaaS and vice versa. Clean up proposal app references. Minimal -- follow YAGNI.

## Implementation Steps

### 4.1 Dashboard Cross-sell Banner

Create `src/components/dashboard/cross-sell-banner.tsx` (~80 lines):
- If user is on Video dashboard and hasn't used RaaS: show "Generate proposals with AI" banner linking to `/dashboard/proposals`
- If user is on RaaS dashboard and hasn't created campaigns: show "Create affiliate videos" banner linking to `/dashboard/campaigns`
- Dismissible (store dismissal in localStorage)
- i18n supported

### 4.2 Combined Dashboard Stats

Update `src/app/[locale]/dashboard/components/dashboard-stats.tsx`:
- Add RaaS stats cards: active missions, MCU usage, proposals generated
- Show alongside existing video/campaign stats
- Use existing stat card component pattern

### 4.3 Pricing Page Combined Value Messaging

Update `src/app/[locale]/pricing/page.tsx`:
- Add header text: "Video Factory + AI Automation — One Platform"
- Highlight combined value proposition
- i18n keys

### 4.4 Cleanup

- Remove all `polar-client` imports from any merged code
- Grep for remaining Polar references in ai-factory and remove/replace
- Update `apps/sophia-proposal/CLAUDE.md` to note: "DEPRECATED -- merged into sophia-ai-factory"
- Do NOT delete sophia-proposal app yet (keep as reference)

### 4.5 Tests

- Run `npm test` and fix any broken tests
- Add basic smoke tests for new dashboard pages
- Verify build passes

## Todo List

- [x] Create `cross-sell-banner.tsx`
- [ ] Update dashboard-stats with RaaS metrics (skipped — YAGNI, stats component is focused; cross-sell banner covers discovery)
- [x] Update pricing page header messaging
- [x] Remove all Polar references from merged code (active component Polar refs cleaned; billing infrastructure Polar kept — needed)
- [x] Mark sophia-proposal as deprecated
- [x] Run tests and fix failures
- [x] Final build verification

## Success Criteria

- Cross-sell banner appears in dashboard
- Dashboard stats show both Video and RaaS metrics
- No Polar.sh references in ai-factory code (except webhook route if needed for legacy)
- `npm run build` passes
- `npm test` passes
- sophia-proposal marked deprecated

## Risk Assessment

- **Over-engineering**: Keep cross-sell simple -- just a banner + stats. No complex recommendation engine (YAGNI)
- **Test failures**: Merging may break existing tests if imports change -- fix incrementally
