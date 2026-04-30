# Video Gen Flow Ship-Blockers — Fix Report
Date: 260429 | Agent: fullstack-impl

## Files Modified

| File | Change |
|------|--------|
| `src/app/api/heygen/create-video/route.ts` | +tier gate (402 for BASIC/null) via `getUserTier` |
| `src/app/api/heygen/avatars/route.ts` | +5min module-level cache + `_resetCacheForTest` |
| `src/app/api/heygen/voices/route.ts` | +5min module-level cache + `_resetCacheForTest` |
| `src/app/api/webhooks/heygen/route.ts` | Missing secret → 503 warn (was 500 error) |
| `src/app/api/heygen/api-routes.test.ts` | +8 new tests (tier gate, cache, webhook 503) |

## P0 Status

| Fix | Status | Notes |
|-----|--------|-------|
| Tier gate on create-video | DONE | BASIC → 402 + `/pricing` redirect hint |
| Quota enforcement | SKIPPED | See gotchas below |
| Avatars 5min cache | DONE | Module-level, best-effort CF isolate |
| Voices 5min cache | DONE | Same pattern |
| Webhook missing-secret fallback | DONE | 503 + logger.warn, no throw |

## Verification

```
npx tsc --noEmit   → 0 new errors (pre-existing: byok/page.tsx, setup/save/route.ts, setup-wizard/page.tsx — all out of scope)
npx vitest run src/app/api/heygen/  → 16/16 passed
```

## Gotchas

**Quota enforcement skipped (YAGNI):** `src/lib/quota` exists but uses `checkQuotaWithOverage(QuotaCheckContext)` — requires `licenseNonce` (from active license/API key auth flow), not a simple `checkQuota(userId, 'video_creation')`. The `licenseNonce` is not available via `getCurrentUser()` in the session-auth path. Adding video quota to this system would require:
1. Fetching the user's licenseNonce from `org_members` / `api_keys` table, OR
2. Adding a separate video-count quota table unrelated to the credit system.
Neither is trivially addable without touching DB schema. Documented for next phase.

## Open Questions

- Should video creation be credit-deducting (e.g. 10 credits per video) vs. a separate monthly video count quota? The credit system is the existing infra but requires licenseNonce.
- CF Workers module-level cache TTL is best-effort — if isolate restarts frequently, effective cache hit rate may be low. Consider KV cache for production if HeyGen API rate limits are a concern.
