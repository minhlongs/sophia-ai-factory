---
phase: 4
title: "Channel UI"
status: pending
priority: P2
dependencies: [3]
effort: "6h"
---

# Phase 4: Channel UI

## Overview

User-facing social hub: channel connection settings, content calendar, publish history, engagement charts. Bilingual VN+EN.

## TDD Workflow

**RED**: Component render + interaction tests
**GREEN**: Build UI with real data
**REFACTOR**: Extract shared components

## Test-First Checklist

**Channel Connection**
- [ ] Test: Connect card renders for each platform
- [ ] Test: YouTube OAuth flow initiates correctly
- [ ] Test: Disconnect removes channel_connected status

**Calendar View**
- [ ] Test: Scheduled publish_jobs render in calendar grid
- [ ] Test: Drag-to-reschedule updates scheduled_at
- [ ] Test: Past dates show delivered/failed status

**History Table**
- [ ] Test: All publishes listed with platform URL
- [ ] Test: Retry button triggers re-enqueue
- [ ] Test: Status badge colors (sent=green, failed=red)

**Metrics Charts**
- [ ] Test: Views/likes/comments/shares render per post
- [ ] Test: Timeline chart shows 7-day range
- [ ] Test: Empty state when no metrics yet

**Responsive**
- [ ] Test: Mobile layout (< 768px) collapses sidebar
- [ ] Test: Calendar grid becomes list on mobile

## Implementation Steps

1. Channel connection page: OAuth per platform
2. Calendar page: publish_jobs grid
3. History page: table with URL links + retry action
4. Metrics page: chart per post
5. Wire next-intl keys (VN + EN)
6. Responsive mobile layout

## Success Criteria

- [ ] User connects account via OAuth
- [ ] Calendar shows scheduled publishes
- [ ] History table shows real platform URLs
- [ ] Metrics charts render correctly
- [ ] All text bilingual VN+EN + responsive

## Risk Assessment

Low risk. Reuse existing dashboard layout.
