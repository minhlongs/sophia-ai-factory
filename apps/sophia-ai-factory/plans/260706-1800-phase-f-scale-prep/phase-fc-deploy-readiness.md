---
title: "F-C: Deploy Readiness"
status: completed
priority: P1
effort: 0.5d
track: F-C
---

# Phase F-C: Deploy Readiness

## Priority: P1 | Est: 0.5d

## Context

Final validation before `npm run deploy:full`.

## Key Insights

- Build succeeds (0 TS errors, 2 non-blocking warnings)
- `scripts/audit/verify-hash-chain.mjs` exists — Turbopack warning is false positive
- `deploy-with-sha.sh` already rejects dirty working tree
- All 6880 tests pass

## Requirements

1. Document Turbopack warning rationale (non-blocking)
2. Verify D1 migration path is clean
3. Confirm deploy verification sequence (SHA match)
4. Produce final green report template

## Implementation Steps

1. Add `turbopackIgnore` comment to `next.config.ts` fs operations (optional polish)
2. Verify no pending D1 migrations need applying
3. Document deploy verification runbook in `.claude/rules/sophia-deploy-verify.md` (already exists)
4. Run `npm run build` + `npm test` final gate

## Success Criteria

- `npm run build` exit 0, 0 TS errors
- All tests pass
- Deploy verification sequence documented and testable
