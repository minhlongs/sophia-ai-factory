# Post-Bootstrap Refinement Plan

## Context
Based on the code review [code-review-260205-bootstrap.md](../reports/code-review-260205-bootstrap.md), we identified several areas for improvement to ensure production readiness.

## Goals
1. Secure the environment variable writing mechanism for production/serverless environments.
2. Improve maintainability of the Setup Wizard by modularizing components.
3. Establish a broader testing baseline.

## Phases

### Phase 1: Production Hardening
- [x] Add production environment check to `api/setup/save/route.ts`
- [x] Ensure graceful degradation (UI shows download instruction if write fails)

### Phase 2: Refactoring
- [x] Split `src/app/setup-wizard/page.tsx` into:
    - `SetupStepSystem`
    - `SetupStepKeys`
    - `SetupStepDatabase`
    - `SetupStepFinish`

### Phase 3: Testing Expansion
- [x] Add unit tests for `validation/services.ts`
- [x] Add integration test for `api/webhooks/polar` (mocked)

## Next Steps
- All phases completed. Ready for feature development.
