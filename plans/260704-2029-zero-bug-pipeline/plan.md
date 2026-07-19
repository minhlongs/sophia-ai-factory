---
title: "Zero-Bug Pre-Deploy Pipeline"
description: "Automated pre-deploy gate: route audit + page render check + CSS audit. Blocks deploy if bugs found."
status: complete
priority: P1
branch: "main"
tags: [quality, pre-deploy, automation, zero-bug]
blockedBy: []
blocks: []
created: "2026-07-04T13:31:30.128Z"
updated: "2026-07-07T18:00:00.000Z"
createdBy: "ck:plan"
source: skill
---

# Zero-Bug Pre-Deploy Pipeline

## Overview

Automated quality gate that runs before every deploy via `npm run deploy:full`. Blocks production deploys if route integrity, page rendering, or CSS variable issues are detected.

| Step | Check | Fail condition |
|------|-------|---------------|
| 1 | Route integrity | `href="/whatever"` → no page.tsx exists |
| 2 | Page render | HTTP non-200 (404/500) |
| 3 | CSS audit | Hardcoded `#6366F1` / `indigo-*` in changed files |

Integrated into `deploy-with-sha.sh` at Step 0.9. Bypass: `SKIP_PRE_DEPLOY_GATE=1` (emergency only).

## Phases

| Phase | Status | Description |
|-------|--------|-------------|
| 1 | ✅ Complete | Route Integrity Scan — `scripts/pre-deploy-gate.mjs` Step 1 |
| 2 | ✅ Complete | Agent-browser E2E — `tests/e2e/smoke/` suite + `playwright-404-sweep.cjs` |
| 3 | ✅ Complete | Page Render Check — `scripts/pre-deploy-gate.mjs` Step 2 |
| 4 | ✅ Complete | CSS Variable Audit — `scripts/pre-deploy-gate.mjs` Step 3 |
| 5 | ✅ Complete | Integration — wired into `deploy-with-sha.sh` Step 0.9 |

## Artifacts

| File | Purpose |
|------|---------|
| `apps/sophia-ai-factory/scripts/pre-deploy-gate.mjs` | Route + render + CSS 3-step gate |
| `apps/sophia-ai-factory/scripts/post-deploy-smoke.mjs` | Post-deploy health + SHA verification |
| `apps/sophia-ai-factory/scripts/deploy-with-sha.sh` | Master deploy script (calls gate at Step 0.9) |
| `apps/sophia-ai-factory/scripts/zero-bug-verify.sh` | Full zero-bug proof generator for CEO handoff |
| `apps/sophia-ai-factory/scripts/playwright-404-sweep.cjs` | Route-level 404 sweep via Playwright |
| `apps/sophia-ai-factory/tests/e2e/smoke/smoke.spec.ts` | Playwright smoke suite (public pages + nav) |
| `apps/sophia-ai-factory/tests/e2e/authenticated-smoke.spec.ts` | Auth flow smoke |
| `apps/sophia-ai-factory/src/app/globals.css` | CSS variable source of truth |

## How It Works

```
npm run deploy:full
  → deploy-with-sha.sh
    → Step 0.5: npm run type-check (TS gate)
    → Step 0.6: npm test (vitest gate)
    → Step 0.7: GPG signature check
    → Step 0.9: node scripts/pre-deploy-gate.mjs  ← ZERO-BUG GATE
      → Step 1: Route integrity (href → page.tsx exists)
      → Step 2: Page render (HTTP 200 check on critical URLs)
      → Step 3: CSS audit (no hardcoded colors in changed files)
    → Step 1: npm run build
    → Step 3: OpenNext build + deploy
    → Step 5.7: post-deploy-smoke.mjs (SHA match + HTTP 200)
```

## Success Criteria

- [x] `npm run deploy:full` runs pre-deploy gate automatically
- [x] Route integrity scan catches broken href→page links
- [x] Page render check catches 404/500 on critical URLs
- [x] CSS audit catches hardcoded design tokens in changed files
- [x] All checks bypassable via `SKIP_PRE_DEPLOY_GATE=1` (emergency only)
- [x] E2E smoke suite (`tests/e2e/smoke/`) covers public pages, auth, navigation
- [x] `playwright-404-sweep.cjs` covers 35+ known routes
- [x] `zero-bug-verify.sh` generates CEO-ready proof report
