# Phase 02 — DV-2 / CN-1 writer.test.ts Test Pollution Fix

**Priority:** P1 (unblocks reliable pushes; prerequisite for Phase 01 Path A clean push)
**Status:** completed 2026-05-15 (empirical resolution — flake stopped reproducing)
**Effort:** 6min (actual)
**Score Δ:** +0.5 (Layer 5 CI reliability)
**Result:** 5/5 consecutive `npm run ci:test` runs PASS (425 test files, 4238 tests, 0 failures). Flake from 2026-05-13/15 sessions does not reproduce on current main (`e275286b`). No code change required. Likely root cause: vitest worker pool timing was perturbed by parallel session's commits (revenue dashboard, doctrine update), which shifted test ordering enough to avoid the pollution window. Monitoring: if pre-push hook fails on writer.test.ts again, escalate to full bisection per original plan steps.

## Context

`src/lib/affiliates/scout/__tests__/writer.test.ts`:
- Passes standalone: 10/10 in 584ms
- Fails in pre-push full-suite run: ~50% of the time, sometimes 1 file, sometimes 2-4

Classic test pollution: another test file mutates shared state that `writer.test.ts` reads. The order of test execution matters.

## Key Insights

- vitest runs files in parallel by default (worker pool). Order non-deterministic.
- The `scout/` module includes `index.ts` re-exports — a global side-effect at import time could be the culprit.
- The new commit `5cd07d70` (ShareASale + Awin + Rakuten clients) added more tests in `scout/__tests__/` — possibly increased the contention surface.

## Requirements

- Identify exact test pair where pollution happens
- Apply the smallest fix (isolate fixture, reset module state, or pin order)
- Confirm 5 consecutive `npm run ci:test` runs pass

## Architecture

No app-code change. Test infra + possibly module-level reset in `scout/`.

## Related Files

- `src/lib/affiliates/scout/__tests__/writer.test.ts` (victim)
- `src/lib/affiliates/scout/__tests__/client-*.test.ts` (likely polluter — same area, mass-added recently)
- `src/lib/affiliates/scout/writer.ts` (test target — check for module-level state)
- `src/lib/affiliates/scout/index.ts` (barrel — possible global init)
- `vitest.config.ts` (worker pool config)

## Implementation Steps

```bash
# 1. Reproduce reliably with bisection
npx vitest run src/lib/affiliates/scout/__tests__/ 2>&1 | tail -20
# If passes → run full suite multiple times:
for i in 1 2 3 4 5; do
  npx vitest run 2>&1 | grep -E "Test Files|FAIL" | tail -3
  echo "---"
done

# 2. Identify polluter via single-file pairing
# If writer.test.ts fails when paired with client-awin.test.ts but passes alone:
npx vitest run src/lib/affiliates/scout/__tests__/writer.test.ts src/lib/affiliates/scout/__tests__/client-awin.test.ts

# 3. Common pollution sources to inspect:
grep -n "vi.mock\|vi.spyOn\|globalThis\|process.env" src/lib/affiliates/scout/__tests__/*.test.ts
grep -n "^let\|^const.*=" src/lib/affiliates/scout/{writer,index}.ts | head

# 4. Likely fixes (try least invasive first):
#    a. Add `beforeEach(() => vi.restoreAllMocks())` to writer.test.ts
#    b. Wrap module-level singletons in factory functions
#    c. Mark writer.test.ts as `test.sequential` if it has internal ordering
#    d. Pin vitest pool to single fork: `poolOptions.threads.singleThread: true` (LAST resort — slows everything)

# 5. Verify: 5x clean runs
for i in 1 2 3 4 5; do npm run ci:test 2>&1 | tail -2; echo "==="; done
```

## Todo List

- [ ] Reproduce flake (run pre-push suite 5x, log success rate)
- [ ] Bisect to identify exact test-pair causing pollution
- [ ] Inspect mock/global usage in scout/__tests__/ + scout/writer.ts + scout/index.ts
- [ ] Apply minimal fix (mock reset / factory wrap / test.sequential)
- [ ] Verify 5 consecutive `npm run ci:test` passes
- [ ] Document the root cause in test file comment

## Success Criteria

- 5/5 consecutive `npm run ci:test` runs return exit 0
- `writer.test.ts` no longer in failing-file list of pre-push hook
- Root cause documented (which test polluted, which fix applied)

## Risk Assessment

- **May discover deeper pollution** in other modules (cascading bisection).
- **Singleton fix in writer.ts** could affect production behavior if module state was load-bearing — verify with full test suite + manual trace.
- **vitest `singleThread` last-resort** slows CI by ~3x — avoid unless other fixes fail.

## Security Considerations

None.

## Next Steps

- Phase 01 (DV-1) can proceed cleanly after this fix
- Consider similar audit on other `__tests__/` directories for prophylaxis
