---
title: "Full UI Redesign — All Pages"
description: "Full UI redesign of all 45+ Sophia AI Factory pages using Stitch design pipeline: design system → screen generation → Next.js component conversion → integration"
status: active
priority: P1
branch: "main"
tags: []
blockedBy: []
blocks: []
created: "2026-07-02T18:51:53.014Z"
updated: "2026-07-03T11:12:00.000Z"
createdBy: "ck:plan"
source: skill
---

# Full UI Redesign — All Pages

## Overview

Complete UI redesign of all 45+ Sophia AI Factory pages. Pipeline: consolidate design tokens and MASTER.md (Phase 0) → design system setup (Phase 1) → Stitch screen generation (Phase 2) → component conversion (Phase 3) → integration and test (Phase 4).

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 0 | [Design System Consolidation](./phase-00-design-system-consolidation.md) | **Completed** |
| 1 | [Design System Setup](./phase-01-design-system-setup.md) | Ready to Start |
| 2 | [Stitch Screen Generation](./phase-02-stitch-screen-generation.md) | Pending |
| 3 | [Next.js Component Conversion](./phase-03-next-js-component-conversion.md) | Pending |
| 4 | [Page Integration & Test](./phase-04-page-integration-test.md) | Pending |

## Dependencies

- Phase 0 must complete before Phase 1 can begin. **Phase 0 is done.**
- Phases 1, 2, 3, 4 are sequential — each depends on the previous.
- All design tokens originate from `.stitch-tokens.json` (amber primary, dark mode).
