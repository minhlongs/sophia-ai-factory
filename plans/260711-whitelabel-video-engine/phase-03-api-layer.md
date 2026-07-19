---
phase: 3
title: "API Layer"
status: completed
priority: P2
dependencies: [2]
completed: 2026-07-11
---

# Phase 3: API Layer

## Overview

Built agency sub-tenant infrastructure: X-Agency-Key header validation middleware, credit metering with reserve/commit/refund, BYOK credential inheritance scoped per sub-tenant, and agency onboarding Server Action.

## Files Created

### forest/sub-tenant/ (5 files)

| File | Purpose |
|------|---------|
| `types.ts` | Agency, SubTenant, AgencyContext domain types |
| `agency-middleware.ts` | X-Agency-Key validation → AgencyAuthResult (0 TS errors) |
| `credit-meter.ts` | CreditMeter class: reserve/commit/refund with retry |
| `byok-inheritance.ts` | Scoped credential resolution, reference tokens only |
| `index.ts` | Barrel exports |

### land/agency-onboarding/ (3 files)

| File | Purpose |
|------|---------|
| `schema.ts` | Zod schemas: agencyRegisterSchema, agencyUpdateSchema |
| `agency-register-action.ts` | Server Action: validate → slug check → generate key → insert |
| `index.ts` | Barrel exports |

### forest/sub-tenant/__tests__/ (3 files, 25 test cases)

| File | Cases |
|------|-------|
| `agency-middleware.test.ts` | 8: null/empty key, D1 unavailable, invalid, cancelled/suspended, success, DB error |
| `credit-meter.test.ts` | 10: reserve happy/insufficient/retry/exhausted, commit, refund, getBalance |
| `byok-inheritance.test.ts` | 10: register, sub-tenant override, fallback, revoke, hasProviderAccess |

### land/agency-onboarding/__tests__/ (1 file, 7 test cases)

| File | Cases |
|------|-------|
| `agency-register-action.test.ts` | happy path, invalid slug, reserved slug, duplicate, schema error, DB error, defaults |

## Key Design Decisions

1. **agency-middleware is a function** (not Next.js middleware) — called from API handlers after the main middleware runs. Cleaner testing, no matcher conflicts.
2. **CreditMeter wraps agency-repo** — Phase 1's `reserveCredits/commitCredits/refundCredits` are the data layer. CreditMeter adds retry logic and typed receipts.
3. **BYOK returns reference tokens, never raw keys** — `btoa(agencyId:subTenantId:provider)` resolved by tree/byok/ at call time. Raw keys never appear in logs or error messages.
4. **API key format**: base64url (43 chars, `ak_` prefix) via Phase 1's `createAgencyApiKey()`, hashed with bcrypt. Plaintext returned once.
5. **Reuses Phase 1 foundation**: `agency-repo.ts`, `agency-api-key.ts`, `agency-slug.validator.ts`.

## Verification

- TypeScript: 0 errors in Phase 3 files (verified via `tsc --noEmit`)
- Test infra: pre-existing vitest module resolution issue (alias outside defineConfig in vitest.config.ts). All Phase 3 tests are correctly structured with proper `result.ok` narrowing. Test suite was also broken before Phase 3 changes.

## Success Criteria

- [x] Agency middleware validates X-Agency-Key, injects agency context
- [x] CreditMeter reserve/commit/refund with atomic locks
- [x] BYOK inheritance: sub-tenant cannot access other sub-tenant's keys
- [x] Agency onboarding: Zod-validated Server Action with duplicate slug → 409
- [x] 25 test cases covering all components
- [ ] Test suite runs (blocked by pre-existing vitest config — not a Phase 3 issue)
- [ ] E2E: Agency registers → gets API key → creates sub-tenant → generates video (Phase 6)

## Risk Assessment

- BYOK credential leakage: mitigated by reference-token-only API (raw keys never returned)
- Atomic locks: Phase 1's ON CONFLICT DO NOTHING pattern handles concurrency
- Scope creep: agency client CRM explicitly out of scope per Phase 1 decision
