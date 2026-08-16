# Phase 2 Stryker Baseline — Evidence

Generated: 2026-08-16

## Evidence

- `scripts/stryker-baseline.mjs` syntax verified: `node --check` passed.
- `package.json` mutation scripts present: `test:mutation`, `test:mutation:baseline`.
- Target files present and correct:
  - `src/land/billing/overage-topup.ts`
  - `src/land/billing/nowpayments-ipn-handlers.ts`
  - `src/land/billing/usage-aggregator.ts`

## Artifacts

- Baseline script patched twice:
  - Fixed spawn invocation to call local Stryker 10.0.0 binary directly.
  - Added `--ignorePatterns .claude` to avoid symlink-tree copy failures.
- No `stryker.config.mjs` exists in the package directory. Stryker ran with CLI args only.
- Run result: instrumentation built 418 mutants across the 3 targets; runner failed during sandbox teardown trying to copy `.claude/rules/binh-phap-cicd.md` (symlink to an absolute path outside the project tree).

## Verdict

**Partially complete in evidence-only mode.** Baseline wire-up validated; no numeric mutation score generated because run aborted before report write.

## Blockers

1. Missing `stryker.config.mjs` entrypoint with test runner and thresholds configured.
2. `.claude/` symlink resolution causes sandbox copy failure; ignore pattern mitigates, but config-first mode is the durable fix.