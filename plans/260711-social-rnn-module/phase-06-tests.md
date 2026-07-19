---
phase: 6
title: "Tests"
status: pending
priority: P2
dependencies: [2, 3, 4, 5]
effort: "5h"
---

# Phase 6: Tests & Hardening

## Overview

Comprehensive test suite for Social RNN. Unit tests (channel adapters, queue, collector, billing). Integration tests (generate → publish → metrics → billing). No cross-tenant security audit (no sensitive data isolation like WhiteLabel).

## TDD Workflow

**RED**: Write all tests first
**GREEN**: Fix failing tests
**REFACTOR**: Optimize coverage gaps

## Test-First Checklist

**Unit Tests** (+80 target)
- [ ] Telegram adapter: publish, retry, error handling
- [ ] Facebook adapter: auth, post, rate limit
- [ ] TikTok adapter: sandbox publish
- [ ] YouTube adapter: OAuth flow simulation
- [ ] RNN scheduler: optimal time calculation
- [ ] Publishing queue: enqueue, status transitions, retry, dead-letter
- [ ] Engagement collector: metric fetch + normalize
- [ ] Social billing: activation, deactivation, payment matching

**Integration Tests** (+15 target)
- [ ] generate video → publish to Telegram → collect metrics → billing recorded
- [ ] Channel OAuth → disconnect → reconnect
- [ ] IPN payment → channel activation → publish succeeds
- [ ] Cancellation → deactivate → publish blocked

**Full Suite**
- [ ] i18n validation: `npm run i18n:validate`
- [ ] Build: `npm run build` → 0 errors
- [ ] All existing tests still pass (no regression)

## Implementation Steps

1. Unit tests: all adapters (mocked HTTP)
2. Unit tests: queue + retry logic
3. Unit tests: engagement collector + metrics normalization
4. Unit tests: billing activation/deactivation
5. Integration: full generate → publish → metrics → billing
6. i18n validation + build check

## Success Criteria

- [ ] 95+ tests pass
- [ ] 0 TypeScript errors
- [ ] i18n passes
- [ ] External APIs mocked (no real calls in CI)

## Risk Assessment

- External API mocking: ensure CI never hits real endpoints.
