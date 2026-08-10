# Validation Commands for OmniRoute Routing Review Gaps

## Quick Validation (run after each phase)

```bash
# Type check (must pass with 0 errors)
npm run type-check

# Run routing strategy tests (Phase 01)
npx vitest run src/forest/quota/__tests__/routing-strategy.test.ts

# Run video-generate tests (Phase 02)
npx vitest run src/forest/inngest/functions/video-generate.test.ts

# Run provider-pool related tests (Phase 03)
npx vitest run src/forest/quota/__tests__/

# Full test suite (must pass all 6,570+ tests)
npm test
```

## Phase-Specific Validation

### Phase 01: Direct Strategy Tests
```bash
# 1. Create test file, then run:
npx vitest run src/forest/quota/__tests__/routing-strategy.test.ts

# Expected: 12+ tests passing covering:
# - PriorityStrategy (default, tie-break, taskType filter)
# - CostOptimizedStrategy (lowest cost, tie-break)
# - LeastUsedStrategy (lowest usage, tie-break)
# - Empty pool → NoProvidersAvailableError
# - All taskTypes: scripting, tts, visual, compose, publish

# 2. Verify coverage
npx vitest run --coverage src/forest/quota/__tests__/routing-strategy.test.ts

# 3. Full regression
npm test
```

### Phase 02: Bilingual Progress Emission
```bash
# 1. Modify video-generate.ts, then run:
npx vitest run src/forest/inngest/functions/video-generate.test.ts

# Expected: 5 tests passing
# Check mock step.sendEvent calls include new error progress events

# 2. Verify bilingual messages in test output
# Look for: "Không có nhà cung cấp TTS / No TTS providers available"
# Look for: "Không có nhà cung cấp video AI / No AI video providers available"

# 3. Full regression
npm test
```

### Phase 03: HealthScore from Circuit-Breaker
```bash
# 1. Modify provider-pool.ts, then run:
npx vitest run src/forest/inngest/functions/video-generate.test.ts

# Expected: 5 tests passing (integration test mocks buildProviderPool)

# 2. Type check
npm run type-check

# 3. Full regression
npm test

# 4. Verify circuit-breaker import works
# Check: import { getCircuitStatus } from '@/seed/utils/circuit-breaker'
```

## Deploy Verification (after all phases)

```bash
# 1. Build
npm run build

# 2. Full test suite
npm test

# 3. Type check
npm run type-check

# 4. Deploy (CF-direct)
npm run deploy:full

# 5. Verify SHA match
LOCAL_SHA=$(git rev-parse HEAD | cut -c1-8)
LIVE_SHA=$(curl -s https://sophia.agencyos.network/api/version | grep -o '"shortSha":"[^"]*"' | cut -d'"' -f4)
echo "Local: $LOCAL_SHA  Live: $LIVE_SHA"
[ "$LOCAL_SHA" = "$LIVE_SHA" ] && echo "✅ DEPLOY MATCHES COMMIT" || echo "❌ STALE DEPLOY"
```

## Success Criteria Checklist

| Criteria | Phase 01 | Phase 02 | Phase 03 | All Phases |
|----------|----------|----------|----------|------------|
| TypeScript 0 errors | ✅ | ✅ | ✅ | ✅ |
| New tests pass | ✅ | ✅ | ✅ | ✅ |
| No regressions (6,570+ tests) | ✅ | ✅ | ✅ | ✅ |
| Coverage ≥ existing | ✅ | — | — | ✅ |
| Bilingual messages correct | — | ✅ | — | ✅ |
| HealthScore dynamic for HeyGen | — | — | ✅ | ✅ |
| Deploy SHA verified | — | — | — | ✅ |