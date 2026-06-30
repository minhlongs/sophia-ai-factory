# Phase 03 — Track C: Affiliate Pipeline Contract Tests

**Priority:** P1 | **Status:** pending | **Effort:** 3h | **Depends On:** —

## Overview

Write contract tests for the affiliate pipeline. Currently `src/land/affiliates/` has 17 source files handling real commission money but only 2 test files (`credentials.test.ts`, `video-description-injector.test.ts`). The core financial functions — commission calculator, ClickBank postback parser, signature verifier, conversion attributor — have zero direct tests.

**TDD approach:** Write contract tests proving correctness of financial operations, idempotency of postback handling, and validation of external inputs.

## Key Insights

- `commission-calculator.ts` (70 LOC) — pure function, easy to test. Tests tier multipliers.
- `clickbank-postback-parser.ts` (77 LOC) — Zod validation, needs edge case tests (malformed input, missing fields, invalid types)
- `clickbank-signature-verifier.ts` — cryptographic signature verification, critical for security
- `conversion-attributor.ts` (152 LOC) — 2 attribution paths (ClickBank legacy + multi-network), SQL injection surface
- `commission-ledger.ts` + `commission-ledger-mutations.ts` — financial ledger, needs idempotency tests
- **Pattern:** Same atomic lock pattern as Payment Pipeline Hardening for ledger writes

## Contract Tests to Write

### File: `src/land/affiliates/__tests__/commission-calculator-contract.test.ts`

1. **positive gross amount splits 70/30 correctly** — $100 → user $70, sophia $30
2. **negative gross amount (refund) splits proportionally** — -$50 → user -$35, sophia -$15
3. **zero amount returns zeros** — $0 → both $0
4. **rounding to 4 decimal places** — $0.123456 → correct rounding
5. **tier multiplier BASIC=0.7x** — Commission reduced for BASIC tier
6. **tier multiplier ENTERPRISE=1.3x** — Commission boosted for ENTERPRISE tier
7. **unknown tier defaults to 1.0x** — No crash on unexpected tier

### File: `src/land/affiliates/__tests__/clickbank-postback-parser-contract.test.ts`

1. **valid SALE postback parses correctly** — All fields extracted
2. **RFND alias maps to REFUND** — ClickBank uses RFND not REFUND
3. **CGBK alias maps to CHARGEBACK** — ClickBank uses CGBK
4. **missing cvendthru is undefined (not error)** — Optional field
5. **malformed body returns null** — Not valid URLSearchParams
6. **unknown transactionType returns null** — Invalid type rejected by Zod
7. **empty string returns null** — Guard clause works

### File: `src/land/affiliates/__tests__/conversion-attributor-contract.test.ts`

1. **valid 24-char hex tid returns attribution** — Happy path
2. **invalid tid format returns null** — Non-hex, wrong length
3. **SQL injection in tid returns null** — tid validation rejects non-hex
4. **empty tid returns null** — Guard clause
5. **network attribution with valid subId returns result** — Multi-network happy path
6. **network attribution with empty subId returns null** — Guard clause

### File: `src/land/affiliates/__tests__/clickbank-signature-verifier-contract.test.ts`

1. **valid signature passes verification** — Known good secret + payload
2. **tampered payload fails verification** — Different payload, same signature
3. **wrong secret fails verification** — Different secret key
4. **missing signature header returns false** — No X-ClickBank-Signature header

## Related Code Files

| File | Action | Description |
|------|--------|-------------|
| `src/land/affiliates/__tests__/commission-calculator-contract.test.ts` | CREATE | Commission split tests |
| `src/land/affiliates/__tests__/clickbank-postback-parser-contract.test.ts` | CREATE | Postback parsing tests |
| `src/land/affiliates/__tests__/conversion-attributor-contract.test.ts` | CREATE | Attribution tests |
| `src/land/affiliates/__tests__/clickbank-signature-verifier-contract.test.ts` | CREATE | Signature verification tests |

## Success Criteria

- [] 20+ contract tests written across 4 test files
- [] Tests prove commission calculation correctness (including tier multipliers)
- [] Tests prove ClickBank postback parsing security (Zod validation rejects invalid input)
- [] Tests prove SQL injection resistance in attribution queries
- [] No impact on existing test suite

## Risk Assessment

- **Risk:** `clickbank-signature-verifier.ts` may use crypto primitives not available in Vitest
- **Mitigation:** Mock crypto if needed; test validation logic separately from crypto
- **Risk:** SQL injection test may need D1 mock
- **Mitigation:** Test the tid validation regex directly (pure JS, no DB needed)

## Next Steps

- Phase 04: Affiliate hardening implementation (depends on these tests)
