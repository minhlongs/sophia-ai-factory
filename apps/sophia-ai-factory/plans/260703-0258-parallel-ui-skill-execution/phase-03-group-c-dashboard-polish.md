---
phase: 3
title: "Group C: Dashboard Polish"
status: completed
priority: P2
dependencies: []
---

# Phase 3: Group C — Dashboard Component Polish

## Overview

Quality pass on 7 newly created dashboard components: verify `'use client'` correctness, Tailwind token alignment, responsive layout, i18n completeness. Runs in parallel with Phases 1 and 2.

## Architecture

All components in `src/app/components/`. Each is independent — no shared state changes.

## Related Code Files

- **Modify:** `src/app/components/layout/dashboard-sidebar.tsx`
- **Modify:** `src/app/components/layout/dashboard-header.tsx`
- **Modify:** `src/app/components/sections/dashboard-overview.tsx`
- **Modify:** `src/app/components/sections/admin-dashboard.tsx`
- **Modify:** `src/app/components/sections/affiliate-dashboard.tsx`
- **Modify:** `src/app/components/sections/campaign-management.tsx`
- **Modify:** `src/app/components/sections/settings-page.tsx`

## Implementation Steps

### Step 1: frontend-design polish
- **Sidebar:** Verify active state (indigo left border), icon sizing (20px), user avatar section
- **Header:** Search input UX (240px width, icon), notification badge red dot, locale toggle
- **Dashboard Overview:** KPI card alignment, chart placeholder, Recent Campaigns table UX
- **Admin Dashboard:** Compact KPIs (6 stats), health check panel, signups table, deploy widget
- **Affiliate Dashboard:** Offer card grid (2 columns), conversion table RWD, wallet input
- **Campaign Management:** Card grid (3 columns), filter bar, pagination, empty state
- **Settings Page:** Sub-nav, form fields, danger zone, locale radio cards

### Step 2: ui-styling pass
- Replace any hardcoded colors with Tailwind indigo/zinc classes
- Ensure consistent: `rounded-lg`, `text-sm`/`text-base`, `gap-4` spacing
- Check dark mode consistency (no light-mode artifacts)

### Step 3: ui-ux-pro-max review
- `search.py --domain ux` for anti-patterns per component
- `search.py --domain product --stack nextjs` for dashboard UX best practices
- Verify: keyboard nav, focus states, contrast ratios

## Success Criteria

- [ ] All 7 components use indigo dark theme consistently
- [ ] All interactive elements have proper `'use client'` directive
- [ ] Dashboard responsive: 3-column grid collapses on mobile
- [ ] i18n keys exist for all visible text
- [ ] No `console.log` or `:any` types
- [ ] ui-ux-pro-max passes (zero anti-patterns)
