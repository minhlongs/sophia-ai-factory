# 260722-02 Layer Enforcement CI Gate

## Objective
Turn the existing `check-layer-boundaries.sh` into a required CI gate for the Sophia 4-layer architecture. Start in warning mode, then promote to hard failure once violations are fixed.

## Current assets
- `apps/sophia-ai-factory/scripts/check-layer-boundaries.sh` already detects boundary violations.
- No CI workflow currently invokes it on PRs.

## Plan
1. Add CI job `layer-boundary-check` (warning-only).
2. Emit JSON report for dashboard.
3. After 1 sprint clean, promote to blocking check.
