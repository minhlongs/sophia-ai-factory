# MCU Integration Tests for Proposals API

**Date:** 2026-05-12 | **Test File:** `src/app/api/proposals/route.test.ts`

## Summary

Added 3 focused unit tests for POST `/api/proposals` MCU integration flow. All tests pass with no regression.

## Tests Added

### 1. **Authentication Check (401)**
- Mocks `getCurrentUser` to return `null`
- Expects 401 Unauthorized
- Validates early exit before balance/deduction logic

### 2. **Insufficient Balance Check (402)**
- Mocks `getCurrentUser` returns user
- Mocks `getBalance` returns 2 credits (below cost of 5)
- Expects 402 with `code: INSUFFICIENT_BALANCE`
- Validates `required=5`, `available=2`, `upgrade_url` present
- Confirms `generateProposal` and `deductCredits` NOT called (short-circuit)

### 3. **Successful Generation (200)**
- Mocks all dependencies for happy path: auth ✓, balance ✓ (10 credits), generation ✓, deduction ✓
- Expects 200 with `success=true`
- Validates `mcuUsed=5` and `remainingBalance=5`
- Confirms `deductCredits` called with correct userId, cost, proposalRef, operation

## Test Results

```
Test Files:  1 passed (1)
Tests:       3 passed (3)
Duration:    523ms
```

## Full Suite Regression

```
Test Files:  407 passed | 1 skipped (408)
Tests:       4081 passed | 32 skipped (4113)
Baseline:    4078 tests
New tests:   +3 tests
Status:      ✅ NO REGRESSION
```

## Key Implementation Details

- Mocks follow existing project pattern (e.g., `cost-guardrail.test.ts`)
- Heavy mocking: `generateProposal`, `checkProposalQuality`, `getBalance`, `deductCredits` all stubbed
- No external API calls (OpenRouter, D1, etc.)
- Tests validate MCU cost check (5 credits per GENERATE operation)
- Covers auth → balance check → generation → deduction flow

## Notes

- Post-generation deduct failure logged but not tested (rare race condition, warn-only)
- Tests preserve existing 4078 pass count + add 3 new = 4081 total
- No flaky behavior observed

## Unresolved Questions

None — all tests pass consistently.
