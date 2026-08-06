---
title: "Sophia Recovery — Scope Cut + Architecture Fix + Stabilization"
description: "Cut phantom products (CR8809, RaaS, SOP Marketplace), fix architecture violations, verify core flows, and ship the first real feature"
status: in-progress
priority: P0
effort: 8-10 weeks
branch: recovery
tags: [scope-cut, architecture, recovery, stabilization]
created: 2026-08-05
updated: 2026-08-06
---

# Sophia AI Factory Recovery Plan

**Root cause of non-delivery:** 4-5 phantom products built inside Sophia's codebase, consuming 8 months of effort. Tests actually pass. The problem is scope explosion + inverted architecture.

**Commit anchor:** 7f79427e

## Phases Overview

| # | Phase | Effort | Status | Phase File |
|---|-------|--------|--------|------------|
| 1 | Scope Cut — Stop the Bleeding | 2 days | completed | `/phase-01-scope-cut.md` |
| 2 | Architecture Fix — Restore 4-Layer Model | 2-3 weeks | completed | `/phase-02-architecture-fix.md` |
| 3 | Stabilize Core Flows | 3-4 days | completed | `/phase-03-stabilize-core.md` |
| 4 | Ship One Real Feature | 1-2 weeks | completed | `/phase-04-ship-one-feature.md` |
| 5 | Coverage Sprint | 2 weeks | completed | `/phase-05-coverage-sprint.md` |

## How to Execute

1. Read each phase file before starting work
2. Mark phase status completed when all TODOs checked
3. Update plan.md progress after each phase completes
4. Test gate: npm test must pass before declaring phase done

## Phase 4 Completion Notes (2026-08-06)
- Public landing-page preview API shipped: `GET /api/public/landing-pages/[slug]`
- Production build verified (`npm run build` exit 0)
- All 6694+ tests passing
- CF-direct deploy pending (production build running in background)

## Key Risks

- **Scope creep returns:** owner may slip back into AI Lab/RaaS work
- **Architecture fix complexity:** 395+ forest→land violations require careful refactoring
- **Protected flows:** Setup Wizard, Telegram Bot, Payment Flow must never break
