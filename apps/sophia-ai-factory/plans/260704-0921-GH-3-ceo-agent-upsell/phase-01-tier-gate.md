---
phase: 1
title: "Tier Gate"
status: completed
effort: "2026-07-05"
---

# Phase 1: Tier Gate

## Context
Implements the `/dashboard/ceo-agent` entry point with role gate + client shell.

## Files changed
- `src/app/[locale]/dashboard/ceo-agent/page.tsx` — server entry, delegates to `CeoAgentShell`
- `src/app/[locale]/dashboard/ceo-agent/ceo-agent-shell.tsx` — clientside tier hydration + shell
- `src/land/ceo-agent/load-ceo-agent-page.ts` — shared loader (auth + tier)
- `src/app/[locale]/dashboard/ceo-agent/__tests__/ceo-agent-tier-gate.test.tsx` — Phase 1 tests

## Implementation
Server page calls `loadCeoAgentPage`, computes `hasAccess = tier !== BASIC`,
renders a lean `CeoAgentShell` that lazy-loads the TierGateCard only for BASIC users.
`CeoAgentShell` hydrates the tier by fetching `/api/ceo-agent/tier`.

## QA
- Type-check: `tsc --noEmit` clean after two fixes:
  - tests import from `@/land/ceo-agent/load-ceo-agent-page` + `../ceo-agent-shell`
  - `fetch().then(r => r.json() as Promise<{ ok?: boolean; tier?: string }>)` with type guard `isTier`
- Tests: `npx vitest run src/app/[locale]/dashboard/ceo-agent/__tests__/ceo-agent-tier-gate.test.tsx` passing

## Success Criteria
- [x] Server page calls `loadCeoAgentPage` (single auth/tier source of truth)
- [x] BASIC users see TierGateCard
- [x] PREMIUM/ENTERPRISE/MASTER see dashboard summary
- [x] Type-check passes with zero `ceo-agent` errors
- [x] Phase test coverage present
