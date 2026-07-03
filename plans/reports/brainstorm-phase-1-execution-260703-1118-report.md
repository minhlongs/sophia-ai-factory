# Brainstorm Report — Phase 1: UI Redesign Execution

**Date:** 2026-07-03
**Project:** Sophia AI Factory — Full UI Redesign
**Mode:** --deep --parallel

---

## Context

- Phase 0 (Design System Consolidation) ✅ Completed + committed `f9887b01`
- DS: Saigon Factory amber (#D97706) primary, indigo (#6366F1) accent, dark mode
- Stitch MCP auth: broken ("Incompatible auth server") — manual paste workflow required
- Stitch project: `2407265268945504587` with design system `14203260290340580283`

## Decision

**Approach:** Option A — Stitch Manual Pipeline
**Scope:** All 5 P0 screens in parallel
**Pipeline per screen:** Update prompt → paste into stitch.withgoogle.com → download HTML → stitch-nextjs-components → i18n → integrate

## 5 P0 Screens (Parallel)

| # | Screen | Prompt Source | Notes |
|---|--------|---------------|-------|
| 1 | Landing Hero | prompts-stitch-screens.md #1 (cần update amber) | Full hero + nav + trust bar + feature cards |
| 2 | Pricing Page | prompts-stitch-screens.md #2 (cần update amber) | 4-tier cards + FAQ accordion |
| 3 | Login + Register | prompts-stitch-screens.md #6 + stitch-prompts-remaining.md #3 | 2 similar card layouts |
| 4 | Setup Wizard | ⚠️ CẦN TẠO MỚI | 4-step BYOK onboarding (protected flow #1) |
| 5 | Dashboard Shell + Overview | prompts-stitch-screens.md #3 + #4 | Sidebar (240px) + header + KPI cards |

## Pre-Work

1. Update 10 prompts indigo→amber in `prompts-stitch-screens.md`
2. Create Setup Wizard Stitch prompt
3. Verify Stitch UI paste workflow

## Risk

- Stitch MCP broken → must paste via browser UI, ~5-10 min per screen
- Setup Wizard là protected flow #1 — must handle carefully
- i18n VN+EN needed for all new screens
