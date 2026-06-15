# Sophia R6 Phase 4G: Workflow-Stepper BYOK Wire

**Status:** shipped
**Commit:** 6f82e7c
**Shipped at:** 2026-04-18
**Mode:** R6 item 4/4
**Goal:** Wire BYOK LLM provider selection into workflow-stepper engine. Closes provider abstraction gap for customer-supplied keys.

## Changes
- Connected workflow-stepper to BYOK provider resolver
- Updated step executor to respect customer LLM key selection
- Added fallback chain: BYOK → org default → global fallback
- Integrated tier enforcement into provider selection logic

## Tests
- 5 new tests added (1292 → 1297 total)

## Verification (Rule #0)
- Build: ✅ exit code 0
- Tests: ✅ 1297/1297 passed
- Git Push: ✅ 6f82e7c → main
- CI/CD: ✅ GitHub Actions passed
- Deploy: ✅ CF Pages deployed
- Production: ✅ HTTP 200 + shortSha match
- Code Review: ✅ 9.7/10 SHIP (0 critical, 0 high)
