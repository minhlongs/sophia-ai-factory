# Phase 03 — Replace Silent .catch() + Fire-and-Forget

**Pillar:** B — Error Handling Contract
**Status:** pending
**Priority:** P1
**Wave:** 1 (parallel with 01, 05)

## Context Links
- Parent: `plans/260630-1626-zero-bug-three-pillars/plan.md`
- Logger: `src/seed/utils/logger-utility.ts`
- Circuit breaker: `src/seed/utils/circuit-breaker.ts`

## Overview

127+ instances của `.catch(() => '')` hoặc `.catch(() => undefined)` nuốt error silently. Mỗi instance cần:
1. Log error qua logger utility
2. Increment metric (nếu có PostHog/metrics context)
3. Return fallback value (giữ behavior hiện tại)

## Pattern Replacement

### Before (anti-pattern):
```typescript
const text = await res.text().catch(() => '');
```

### After (standardized):
```typescript
import { logger } from '@/seed/utils/logger-utility';

const text = await res.text().catch((err) => {
  logger.warn('Failed to read response text', { error: String(err), context: 'functionName' });
  return '';
});
```

### Before (fire-and-forget anti-pattern):
```typescript
fetch('/api/events/track', { method: 'POST', body: JSON.stringify(payload) });
```

### After:
```typescript
import { logger } from '@/seed/utils/logger-utility';

fetch('/api/events/track', { method: 'POST', body: JSON.stringify(payload) })
  .catch(err => logger.warn('Event tracking failed', { error: String(err) }));
```

## Files by Module (ordered by criticality)

### Critical (payment/billing — fix first)
1. `src/land/billing/nowpayments-ipn-subscription.ts` (648 lines)
2. `src/land/billing/nowpayments-ipn-handlers.ts` (217 lines)
3. `src/land/billing/nowpayments-ipn-one-time.ts` (269 lines)
4. `src/land/billing/nowpayments-ipn-dead-letter.ts` (241 lines)

### High (video publishing pipeline)
5. `src/land/video/publishing/providers/bluesky.ts` (3 instances)
6. `src/land/video/publishing/providers/twitter-oauth-client.ts` (2 instances)
7. `src/land/video/publishing/providers/reddit.ts` (2 instances)
8. `src/land/video/publishing/providers/threads.ts` (3 instances)
9. `src/land/video/publishing/providers/mastodon.ts` (1 instance)
10. `src/land/video/publishing/providers/twitter-publisher.ts` (1 instance)
11. `src/land/video/publishing/video-generation.service.ts` (1 instance)

### Medium (external API clients)
12. `src/land/hunter/hunter-client.ts` (1 instance)
13. `src/land/video/heygen-helpers.ts` (1 instance)
14. `src/land/video/assembly/ffmpeg-muxer.ts` (1 instance)
15. `src/land/video/generation/wan21-client.ts` (1 instance)

## Implementation Steps

1. Add `context` parameter convention to logger.warn/logger.error
2. Fix critical payment files first (4 files)
3. Fix video publishing files (7 files)
4. Fix external API clients (4 files)
5. Run `npm run type-check` after each batch
6. Run `npm test` after all fixes

## Success Criteria
- [ ] 0 `.catch(() => '')` patterns in src/
- [ ] 0 `.catch(() => undefined)` patterns in src/
- [ ] 0 fire-and-forget fetch() without .catch()
- [ ] All .catch() blocks log via logger utility
- [ ] `npm run type-check` → 0 errors
- [ ] `npm test` → all pass
