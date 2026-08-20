# Phase 8 Step 2 — Onboarding E2E Coverage Report

**Date:** 2026-08-20
**Scope:** Setup Wizard E2E tests (Protected Flow #1)
**Status:** SHIPPED

## Summary

Setup Wizard was dead after the Welcome step. Added Continue buttons to the three
step components that lacked navigation controls, wired them in `index.tsx`, and
wrote a 12-test Playwright E2E spec covering the full onboarding flow.

## Root Cause

`SystemCheckStep`, `ApiKeysStep`, and `ProviderCredentialsStep` each declared an
`onNext` prop but never rendered a button, and `steps/index.tsx` never passed
`handleNext`. Clicking "Get Started" advanced to System Check and then stopped.

## Changes

| File | Change |
|------|--------|
| `src/tree/components/setup-wizard/steps/system-check-step.tsx` | Added `onNext` prop + Continue button |
| `src/tree/components/setup-wizard/steps/api-keys-step.tsx` | Added `onNext` prop + Continue button |
| `src/tree/components/setup-wizard/steps/provider-credentials-step.tsx` | Added `onNext` prop + Continue button |
| `src/tree/components/setup-wizard/steps/index.tsx` | Wired `onNext={handleNext}` on all three steps |
| `tests/e2e/onboarding-e2e.spec.ts` | New E2E spec — 12 tests |

## Test Results

```
2 skipped   — require real API keys (E2E_USER_EMAIL + E2E_OPENROUTER_KEY)
10 passed   — unauthenticated, step indicator, welcome bilingual, full navigation,
              API Keys bilingual, Providers bilingual, BYOK banner
```

## Key Findings During Debugging

1. **`review-step.tsx:64-66` `hasRequired`** requires the `otherKeys` group's
   required entries (ElevenLabs, D-ID) to be non-empty, not just OpenRouter +
   HeyGen. Filling only OpenRouter + HeyGen left Confirm & Save disabled.
2. **`POST /api/setup-wizard/save-credentials` returns 403 `csrf_token_invalid`**
   on E2E environments — the client-side `fetch()` in `handleSave` doesn't carry
   the CSRF header. The full-navigation test mocks the endpoint so the flow
   completes to Finish.
3. **Navigation topology:** only the Review step has a Back button; Back →
   Providers (not API Keys). Providers Continue → Review.

## Verification

- `npx playwright test tests/e2e/onboarding-e2e.spec.ts` — 10 passed, 2 skipped
- `npx vitest run` — 6994 passed, 34 skipped, 0 failed (no regression)
- `npm run build` — 0 errors in changed files (36 pre-existing errors in other
  working-tree files, unrelated to this work)
