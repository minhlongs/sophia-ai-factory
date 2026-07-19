---
phase: 2
title: "Agent-Browser E2E Flow"
status: complete
effort: "41 E2E tests across Playwright + Vitest + integration suites"
---

# Phase 2: Agent-Browser E2E Flow

## Overview

Ensures the full user journey works end-to-end: public pages render, auth flows complete, navigation links resolve, and no 404 pages appear across the known route set.

## Implementation

### Artifact 1: Playwright E2E Suite (`tests/e2e/`)

| File | Coverage |
|------|----------|
| `tests/e2e/smoke/smoke.spec.ts` | Homepage, /vi, /en, /pricing, /guide, /blog — navigation + language switcher |
| `tests/e2e/authenticated-smoke.spec.ts` | Auth flow (signup, login, password reset) |
| `tests/e2e/flow/` | Full user journey: onboarding → dashboard → settings |
| `tests/e2e/theming/` | Dark/light mode toggle, CSS variable rendering |
| `tests/e2e/forms/` | Form validation, submission, error states |
| `tests/e2e/protected-routes/` | Auth guard redirects for unauthenticated users |
| `tests/e2e/accessibility/` | WCAG basic checks (heading hierarchy, alt text) |

### Artifact 2: Playwright 404 Sweep (`scripts/playwright-404-sweep.cjs`)

Uses Playwright Chromium to check 35+ known routes against production (`sophia.agencyos.network`):
- Maps expected status codes: 200 (OK), 307 (locale redirect / → /vi), 308 (permanent locale redirect)
- Reports passed/failed/404 counts
- Runs on-demand: `node scripts/playwright-404-sweep.cjs`

### Artifact 3: Post-Deploy Smoke (`scripts/post-deploy-smoke.mjs`)

Runs automatically after `npm run deploy:full` deploys (Step 6 in deploy-with-sha.sh):
- Checks `/api/health` returns 200
- Verifies `/api/version` `shortSha` matches local commit
- Generates JSON report
- Bypass: `SKIP_SMOKE_TEST=1`

## Test Execution Patterns

```bash
# Full E2E suite (mock mode, no real AI)
NEXT_PUBLIC_MOCK_D1=true NEXT_PUBLIC_MOCK_AI_SERVICES=true npx playwright test

# UI mode for debugging
NEXT_PUBLIC_MOCK_D1=true NEXT_PUBLIC_MOCK_AI_SERVICES=true npx playwright test --ui

# 404 route sweep
node scripts/playwright-404-sweep.cjs
```

## Success Criteria

- [x] Playwright smoke suite covers all critical public pages
- [x] Authenticated smoke covers signup → login → password reset flow
- [x] 404 sweep covers 35+ known routes with expected status codes
- [x] Post-deploy smoke runs automatically after every `npm run deploy:full`
- [x] All E2E tests run with `NEXT_PUBLIC_MOCK_AI_SERVICES=true` (no real API calls)
- [x] Individual test files: single-folder execution (`npx playwright test tests/e2e/smoke/`)
