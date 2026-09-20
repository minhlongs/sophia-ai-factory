# Phase 06: Final Verification & Quality Gates

## Context Links
- Plan: [plan.md](./plan.md)
- Deploy rules: `apps/sophia-ai-factory/.claude/rules/sophia-deploy-verify.md`
- Layer architecture: `apps/sophia-ai-factory/.claude/rules/sophia-layer-architecture.md`
- Handover rules: `apps/sophia-ai-factory/.claude/rules/sophia-handover-rules.md`
- ESLint suppressions: `apps/sophia-ai-factory/eslint-suppressions.json`

## Overview
- Priority: P1
- Status: pending
- Effort: 1.5h
- Description: Run full technical verification suite across TypeScript compiler, unit & integration tests, ESLint suppression freeze, 4-layer architecture boundaries, and Next.js production build to guarantee zero regressions.

## Key Insights
- Full test suite contains 9,000+ tests across `seed`, `tree`, `forest`, `land`, and `app`.
- No new `eslint-disable` comments are permitted (baseline frozen in `eslint-suppressions.json`).
- Zero `:any` types in production code.
- Zero `console.log` in production code (use `@/seed/utils/logger-utility`).
- No land -> forest imports (enforced by architecture rules).

## Requirements
### Functional
- Verify all routes render without runtime exceptions.
- Verify all 15+ dashboard subroute loading skeletons and error boundaries function as expected.
- Verify bilingual toggle between `vi` and `en` across updated components.

### Non-Functional
- `npm run type-check` -> 0 errors.
- `npx vitest run` -> 100% tests pass.
- `npm run build` -> Next.js production build exits 0.
- Check architecture boundary rules with grep (no illegal cross-layer imports).

## Architecture & Quality Gates Matrix
```
Quality Gate Pipeline:
  1. Architecture Audit   → grep seed/tree/forest/land import violations
  2. ESLint Freeze Audit   → ensure no new eslint-disable comments
  3. Type Safety Gate      → npm run type-check (0 TS errors)
  4. Test Suite Gate       → npx vitest run (100% passing)
  5. Build Gate            → npm run build (exit 0)
```

## File Ownership
This phase strictly owns and modifies/creates the following files:

### Files to Modify
- None (verification phase).

### Artifacts to Produce
- `plans/reports/20260920-1600-ui-ux-upgrade-verify-report.md` (or final response report).

## Implementation Steps
1. **Layer Boundary Check:**
   ```bash
   grep -rn "from ['\"]@/forest" apps/sophia-ai-factory/src/land/
   grep -rn "from ['\"]@/land\|from ['\"]@/forest" apps/sophia-ai-factory/src/tree/
   ```
   Must return 0 results.
2. **ESLint Suppression Check:**
   Verify no new `eslint-disable` comments were added compared to `eslint-suppressions.json`.
3. **Type Check:**
   ```bash
   cd apps/sophia-ai-factory && npm run type-check
   ```
   Must exit 0 with 0 errors.
4. **Test Suite:**
   ```bash
   cd apps/sophia-ai-factory && npx vitest run
   ```
   All test files must pass.
5. **Production Build:**
   ```bash
   cd apps/sophia-ai-factory && npm run build
   ```
   Must complete successfully without bundle or SSR errors.
6. **Protected Flows Smoke Check:**
   Verify files in protected flows were untouched or strictly presentational:
   - Setup Wizard (`src/app/[locale]/setup-wizard/`)
   - Telegram Bot webhook (`src/app/api/v1/telegram/`)
   - Payment Webhook (`src/app/api/webhooks/nowpayments/`)

## Todo List
- [ ] Run layer boundary check (0 violations)
- [ ] Run ESLint suppression count check
- [ ] Run `npm run type-check` (0 errors)
- [ ] Run `npx vitest run` (all tests passing)
- [ ] Run `npm run build` (exit 0)
- [ ] Verify protected flows integrity
- [ ] Compile final verification report

## Success Criteria
- [ ] `npm run type-check` = 0 errors
- [ ] `npx vitest run` = all tests pass
- [ ] `npm run build` = exit 0
- [ ] 0 architecture boundary violations
- [ ] 0 new eslint-suppressions
- [ ] Zero unhandled errors in production build

## Risk Assessment & Mitigations
- **Risk:** Build failures on Cloudflare OpenNext bundling due to dynamic imports or client/server boundary mismatches.
  - **Mitigation:** Ensure all interactive components have `'use client'` at the top and server components do not import client-only hooks.

## Security Considerations
- Pre-deploy checks ensure no secrets or debug statements remain in bundle.

## Next Steps
- Deliver summary report and await execution approval.
