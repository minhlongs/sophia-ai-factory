---
phase: 6
title: "Tests"
status: pending
priority: P2
dependencies: [2, 3, 4, 5]
---

# Phase 6: Tests & Hardening

## Overview

Comprehensive test suite for WhiteLabel. Unit tests for agency CRUD, credit meter, BYOK inheritance. Integration tests for end-to-end flow. Security audit for cross-agency isolation.

## Requirements

- Unit tests: agency CRUD, credit metering, BYOK inheritance — +150
- Integration tests: end-to-end agency flow — +20
- i18n validation: passed
- Build check: 0 TypeScript errors
- Security audit: zero cross-agency data leakage

## Architecture

TDD per phase. Security audit: enumerate all agency-scoped queries, verify agency_id filter enforced.

## Related Code Files

- Create: `tests/unit/agency-crud.test.ts`
- Create: `tests/unit/credit-meter.test.ts`
- Create: `tests/unit/byok-inheritance.test.ts`
- Create: `tests/integration/agency-end-to-end.test.ts`

## Implementation Steps

1. Unit tests: agency CRUD (create, read, update, delete with agency_id filter)
2. Unit tests: credit meter (reserve, commit, refund, limit enforcement)
3. Unit tests: BYOK inheritance (agency creds scoped to sub-tenant, no leakage)
4. Integration tests: register → payment → fulfill → onboard → generate → credit Delta
5. i18n validation: `npm run i18n:validate`
6. Full suite: `npm test` + `npm run build`
7. Security audit: query all agency write paths, verify isolation

## Success Criteria

- [ ] 170+ new tests pass
- [ ] 0 TypeScript errors
- [ ] i18n passes
- [ ] Zero cross-agency data leaks

## Risk Assessment

- 170 test target aggressive — prioritize critical paths (credit, auth, BYOK isolation)
