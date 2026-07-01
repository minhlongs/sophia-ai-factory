# Phase 7 — Verification + Finalize

**Status:** pending | **Priority:** P0 | **Effort:** 1h

## Context
- Parent: [plan.md](plan.md)
- Depends on: All phases 1-6 completed

## Verification Gates

### 1. Full Test Suite
```bash
npm test
```
- All 6694+ tests must pass
- New security tests added in Phases 2-5 must pass

### 2. TypeScript
```bash
npm run type-check
```
- 0 errors

### 3. Lint
```bash
npm run lint
```
- Clean

### 4. Build
```bash
npm run build
```
- Compiled successfully, all pages generated

### 5. Security Re-Audit
- Re-run quick scans:
  - `npm audit` — verify 0 HIGH, 0 CRITICAL
  - Verify no new `console.*` violations
  - Verify no new `:any` types

### 6. Code Review (delegate to code-reviewer agent)
- Every finding fix implemented correctly
- No side effects or regressions
- Payment code changes verified against contracts
- Auth changes verified against protected flows

## Success Criteria
- [ ] `npm test` — all pass
- [ ] `npm run type-check` — 0 errors
- [ ] `npm run lint` — clean
- [ ] `npm run build` — success
- [ ] `npm audit` — 0 HIGH/CRITICAL
- [ ] Code review approved
- [ ] Protected flows verified (Setup Wizard, Telegram Bot, Payment Flow)
