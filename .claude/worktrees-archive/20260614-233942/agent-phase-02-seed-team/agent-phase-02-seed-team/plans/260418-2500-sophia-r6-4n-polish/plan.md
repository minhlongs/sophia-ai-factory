# Sophia R6 Phase 4N: SSE Reader Polish

**Status:** shipped
**Commit:** 2ffc3a2
**Shipped at:** 2026-04-18
**Mode:** R6 item 2/4
**Goal:** Add SSE reader + parse_error handler for streaming LLM responses. Closes connection leak on malformed chunks.

## Changes
- Implemented SSE chunk reader with line-by-line buffering
- Added parse_error handler for incomplete/malformed frames
- Graceful degradation: skip bad chunks, continue reading valid ones
- Updated type guards for stream event detection

## Tests
- 1 net test change (1288 → 1289 total)

## Verification (Rule #0)
- Build: ✅ exit code 0
- Tests: ✅ 1289/1289 passed
- Git Push: ✅ 2ffc3a2 → main
- CI/CD: ✅ GitHub Actions passed
- Deploy: ✅ CF Pages deployed
- Production: ✅ HTTP 200 + shortSha match
- Code Review: ✅ 9.6/10 SHIP (0 critical, 0 high)
