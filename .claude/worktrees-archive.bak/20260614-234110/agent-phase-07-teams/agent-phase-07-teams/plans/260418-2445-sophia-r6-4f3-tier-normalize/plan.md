# Sophia R6 Phase 4F.3: Tier-Case Normalize

**Status:** shipped
**Commit:** d5556a4
**Shipped at:** 2026-04-18
**Mode:** R6 item 1/4
**Goal:** Normalize tier & case handling in LLM cache lookup. Closes off-by-one risk from mixed case sensitivity.

## Changes
- Normalized tier enum + case matching across cache key builder
- Updated cache hit detection to handle case-insensitive tier codes
- Aligned `tier_*` column checks with canonical enum values
- Added coverage for edge cases (NULL tier, mixed casing)

## Tests
- 3 new tests added (1285 → 1288 total)

## Verification (Rule #0)
- Build: ✅ exit code 0
- Tests: ✅ 1288/1288 passed
- Git Push: ✅ d5556a4 → main
- CI/CD: ✅ GitHub Actions passed
- Deploy: ✅ CF Pages deployed
- Production: ✅ HTTP 200 + shortSha match
- Code Review: ✅ 9.5/10 SHIP (0 critical, 0 high)
