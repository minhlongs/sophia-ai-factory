# Wave 13 Group I1 — Cleanup Report
Date: 260509
Status: COMPLETE

## Deps Removed
- `@vercel/og`: not present in package.json — no action needed
- `html2canvas`: KEPT — active usage in `src/lib/analytics/chart-export.ts` (3 references, dynamic import)

## Functions Deleted (2)
1. `releaseRefreshLock` — `src/lib/publishing/oauth-token-refresher.ts` lines 147–153 (0 callers confirmed)
2. `verifyResetToken` — `src/seed/auth/reset-password-token.ts` lines 143–171 (only test file caller, migrated first)

## Tests Migrated (3)
`describe('verifyResetToken (deprecated — no DB)')` → `describe('consumeResetToken — additional coverage (migrated from verifyResetToken)')`
- "returns payload for valid token" → "valid token returns userId (consume succeeds)"
- "returns null for tampered payload" → equivalent consumeResetToken call
- "returns null for expired token" → equivalent consumeResetToken call
Import updated: removed `verifyResetToken` from import line.

## Files Split (onboarding-tour-modal: 244 LOC → 4 files)
| File | LOC | Role |
|---|---|---|
| onboarding-tour-modal.tsx | 51 | Thin orchestrator |
| onboarding-tour/tour-steps.ts | 24 | STEPS data + StepConfig + constants |
| onboarding-tour/use-tour.ts | 95 | State + effects + handlers |
| onboarding-tour/tour-overlay.tsx | 156 | Pure UI dialog |

All files <200 LOC. Props, i18n keys, exports, behavior preserved exactly.

## Acceptance
- tsc --noEmit: 0 errors
- npm test: 2894 passed, 31 skipped (293 test files, 0 failures)
