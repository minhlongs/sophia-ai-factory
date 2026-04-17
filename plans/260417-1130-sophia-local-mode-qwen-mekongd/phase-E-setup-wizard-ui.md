# Phase E — Setup Wizard "Local Mode" UI Tab

**Status:** deferred (next iteration) | **Priority:** P2 | **Effort:** 1-2d | **Depends:** Phase D

> **DEFERRED — DO NOT IMPLEMENT THIS ITERATION.**

## Goal
Add "Local Mode" tab to the existing setup wizard. Auto-detect darwin/arm64, show install one-liner if eligible, render health-check status badge, toggle ON/OFF.

## Architecture Sketch
```
SetupWizard (existing) → new <LocalModeStep />
  ├── Eligibility check: navigator.userAgent matches /Macintosh.*Apple/ + RAM hint
  ├── If eligible + not provisioned:
  │     - Show one-liner copy box: `curl -fsSL https://sophia.agencyos.network/install/local-mode | bash`
  │     - Status: "Waiting for installer..." (poll /api/setup/local-mode/status every 5s)
  ├── If provisioned:
  │     - Health badge: green (last successful health-check <5min) / yellow (>5min) / red (failed)
  │     - Toggle: enable/disable routing (writes to D1 via Phase D's API or new disable endpoint)
  └── Bilingual copy (VN+EN per sophia-handover-rules.md)
```

## Related Code Files

### Create
- `apps/sophia-ai-factory/src/components/setup-wizard/local-mode-step.tsx` (≤180 LOC; split if larger)
- `apps/sophia-ai-factory/src/components/setup-wizard/local-mode-step.test.tsx` (≥4 tests)
- `apps/sophia-ai-factory/src/app/api/setup/local-mode/status/route.ts` — GET endpoint for polling

### Modify
- `apps/sophia-ai-factory/src/components/setup-wizard/index.tsx` (or wherever steps are wired) — register new step

## Effort Estimate
- UI component + bilingual copy: 1d
- Status polling endpoint + tests: 0.5d
- Visual QA on actual M1 Max: 0.5d

## Open Questions
- Where in wizard sequence does Local Mode appear? (Lean: AFTER API keys step, BEFORE first campaign — opt-in only.)
- Render Q4_K_M model size disclaimer (~21GB download)? (Yes — set expectation.)
