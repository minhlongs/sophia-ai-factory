---
phase: 1
title: "Design System Setup"
status: ready
effort: "4-6h"
dependsOn: "Phase 0 (Design System Consolidation) — completed"
---

# Phase 1: Design System Setup

## Overview

Translate the consolidated design tokens and MASTER.md into a formal Stitch Design System. This creates the reusable palette, typography, component library, and layout primitives used by all subsequent phases.

## Prerequisites

- Phase 0 is complete: `.stitch-tokens.json` uses amber primary, canonical MASTER.md exists at `design-system/sophia-ai-factory/MASTER.md`

## Implementation Steps

1. Create Stitch Design System from `.stitch-tokens.json` + MASTER.md
   - Define color palette (amber primary, indigo accent, neutral/background, amber/warm signals)
   - Define typography scale (Inter for UI, JetBrains Mono for code)
   - Define spacing scale (4px base, consistent with existing Tailwind)
2. Create component library in Stitch
   - Buttons (primary/secondary/ghost with amber)
   - Cards, inputs, selects, modals, navigation
   - Match existing Sophia component patterns
3. Export design tokens for downstream use
   - Ensure Phase 2 (Stitch screen generation) can reference the design system
4. Validate with one reference page before proceeding to Phase 2

## Success Criteria

- [ ] Stitch Design System created and linked to `.stitch-tokens.json`
- [ ] Component library covers all variant states (hover, active, disabled, error)
- [ ] Design tokens exportable for Stitch screen generation
- [ ] One reference page validated end-to-end

## Key Files

| File | Purpose |
|------|---------|
| `.stitch-tokens.json` | Source of truth for tokens (amber primary) |
| `design-system/sophia-ai-factory/MASTER.md` | Canonical brand + design rules |

## Dependencies

- Blocked by: _none_ (Phase 0 complete)
- Blocks: Phase 2 (Stitch Screen Generation)
