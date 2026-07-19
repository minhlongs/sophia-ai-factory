---
phase: 4
title: "Admin UI"
status: pending
priority: P2
dependencies: [3]
---

# Phase 4: Admin UI

## Overview

Agency-facing pages: onboarding wizard and agency dashboard with credit meter and sub-tenant management. Bilingual VN+EN. Responsive.

## Requirements

- Functional: Complete wizard (register → payment → API key), view branded dashboard, manage sub-tenants
- Non-functional: All agency-facing content bilingual VN+EN

## Architecture

Reuse existing dashboard layout. New theming layer:

Pages:
- `/[locale]/agency/onboarding` — wizard (info → payment → first sub-tenant)
- `/[locale]/agency/dashboard` — credit meter, sub-tenant list, usage chart

Components:
- `white-label-theme-provider.tsx` — CSS variable injection from agency branding config
- `credit-dashboard.tsx` — real-time credit consumption display

## Related Code Files

- Create: `src/app/[locale]/agency/onboarding/page.tsx`
- Create: `src/app/[locale]/agency/dashboard/page.tsx`
- Create: `src/components/white-label-theme-provider.tsx`
- Create: `src/components/credit-dashboard.tsx`

## Implementation Steps

1. Agency onboarding wizard: step-by-step (register info → payment → API key)
2. Agency dashboard: credit meter widget + sub-tenant table + usage history
3. CSS variable injection per agency theme (brand color, logo)
4. Wire next-intl keys (VN + EN) for all agency-facing text
5. Responsive mobile layout

## Success Criteria

- [ ] Agency completes onboarding end-to-end
- [ ] Sees branded dashboard with agency colors/logo
- [ ] All agency text bilingual VN+EN
- [ ] Responsive on mobile

## Risk Assessment

Low risk. Reuse existing dashboard and i18n infrastructure.
