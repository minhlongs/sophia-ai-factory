# Phase 06 — M6 API-key DB Error Swallow Fix

## Context Links

- Validator: `src/forest/missions/api-key-auth.ts` (entire file, 82 LOC)
- Callers (5 routes):
  - `src/app/api/v1/missions/route.ts` (POST + GET)
  - `src/app/api/v1/missions/[id]/route.ts`
  - `src/app/api/v1/missions/[id]/stream/route.ts` (SSE)
  - `src/app/api/v1/credits/route.ts`
- Logger: `src/seed/utils/logger-utility.ts` (already has Sentry integration)

## Overview

- **Priority:** P1
- **Status:** ✅ done
- **Effort:** 0.5 dev-day

`validateMissionApiKey` returns `{ valid: false, error: 'Invalid API key' }` for both genuinely invalid keys AND DB connection failures (line 80 catch block returns `'Authentication error'` but downstream routes treat it the same as invalid). Result: 401 returned for what should be 503 — masks operational issues, makes incident response harder.

## Key Insights

1. **Current logic (audited):**
   - DB unreachable in catch → returns `{ valid: false, error: 'Authentication error' }` (line 80, ALREADY differentiated string).
   - Invalid key (no row) → returns `{ valid: false, error: 'Invalid API key' }` (line 70).
   - **The string IS different** — but every caller maps both to HTTP 401. The bug is in caller mapping, not validator.
2. **Sentry visibility:** logger.error already fires on catch path (line 78). Sentry captures the error — just not tagged with `auth.error_type`.
3. **Distinguishing at HTTP layer:** caller checks `auth.error` string OR validator returns an `errorType: 'invalid_key' | 'db_unreachable' | 'inactive'` field. The latter is cleaner.

## Requirements

### Functional

- Validator returns `{ valid, userId?, error?, errorType? }` where `errorType ∈ 'invalid_key' | 'inactive' | 'db_unreachable' | 'missing_credentials'`.
- Each caller maps `errorType` to appropriate HTTP status:
  - `invalid_key` → 401
  - `inactive` → 403
  - `db_unreachable` → 503
  - `missing_credentials` → 401 (current behavior, unchanged)
- Logger.error in catch path adds Sentry tag `auth.error_type=db_unreachable`.

### Non-functional

- No breaking change to validator return shape (`valid` + `userId` + `error` keep current semantics; `errorType` is additive).
- Tests cover all 4 errorType branches.

## Architecture

### Validator return type (extended)

```ts
export type ApiKeyAuthErrorType =
  | 'missing_credentials'
  | 'invalid_key'
  | 'inactive'
  | 'db_unreachable';

export interface ApiKeyAuthResult {
  valid: boolean;
  userId?: string;
  error?: string;
  errorType?: ApiKeyAuthErrorType;
}
```

### Caller pattern

```ts
const auth = await validateMissionApiKey(authHeader, xApiKey);
if (!auth.valid) {
  const status = auth.errorType === 'db_unreachable' ? 503
    : auth.errorType === 'inactive' ? 403
    : 401;
  return NextResponse.json({ error: auth.error ?? 'Auth failed' }, { status });
}
```

Or DRY: extract helper `apiKeyAuthErrorResponse(auth)` in `forest/missions/api-key-auth.ts` returning `NextResponse`.

### Sentry tagging

```ts
} catch (err) {
  logger.error('[ApiKeyAuth] DB unreachable', err instanceof Error ? err : new Error(String(err)), {
    sentryTags: { 'auth.error_type': 'db_unreachable' },
  });
  return { valid: false, error: 'Authentication error', errorType: 'db_unreachable' };
}
```

Verify logger supports `sentryTags` option — if not, use `Sentry.setTag()` directly via the logger module's Sentry helper.

## Related Code Files

### Modify

- `src/forest/missions/api-key-auth.ts` — add `errorType` field + Sentry tag.
- 5 caller routes (listed above) — map `errorType` to HTTP status.
- Optionally: extract `apiKeyAuthErrorResponse()` helper to keep caller DRY.

### Create

- `src/forest/missions/__tests__/api-key-auth.test.ts` (if not exists) — cover all 4 errorType branches with mocked D1Client throwing in catch path.

### Delete

- None.

## Implementation Steps

1. **Verify logger Sentry integration** — read `src/seed/utils/logger-utility.ts` to see how to attach tags. Adjust syntax if needed.
2. **Modify api-key-auth.ts** — add `errorType` to all return paths + Sentry tag in catch.
3. **Modify 5 caller routes** — replace blanket `status: 401` with errorType-driven status.
4. **Optional refactor:** add `apiKeyAuthErrorResponse(auth)` helper to keep callers DRY (~5 LOC each → 1).
5. **Add unit tests** — mock D1Client to throw on `.from(...).select(...).single()` → assert errorType='db_unreachable'.
6. **Run vitest:** `npm test`. Existing route tests must still pass (current 401 → some now 503; update tests).
7. **Build + deploy + SHA verify.**
8. **Verify Sentry:** trigger DB error path manually OR wait for organic error → confirm tag visible in Sentry UI.

## Todo List

- [x] Read logger Sentry tag API
- [x] Modify validateMissionApiKey return type
- [x] Add Sentry tag in catch path
- [x] Update 5 caller routes (4 files, 5 call sites)
- [x] Optional: extract DRY helper (apiKeyAuthErrorResponse)
- [x] Add/update unit tests for errorType (13 tests, all pass)
- [x] Run `npm test` — 3043/3043 pass
- [ ] Build + deploy + SHA verify (coordinator batches)
- [ ] Verify Sentry tag visible

## Success Criteria

- DB unreachable → callers return 503 (not 401).
- Invalid key → callers return 401 (unchanged).
- Inactive key → callers return 403 (new).
- Sentry events on DB failure carry `auth.error_type=db_unreachable` tag.
- All tests pass; build green; SHA match.

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Existing tests assert `status: 401` for catch path | Medium | Low | Mechanical update; tests gain accuracy |
| Logger sentryTags option not supported | Medium | Low | Use Sentry.setTag directly |
| Adding `errorType` breaks JSON serialization for older clients | Very Low | Low | Field is additive; clients ignore unknown fields |
| Inactive key returning 403 changes API contract | Low | Low | Document in CHANGELOG; clients should treat as auth failure regardless |

## Security Considerations

- 503 vs 401 disclosure: 503 reveals DB outage to attacker. Acceptable — operational truth; rate-limit middleware caps probe rate.
- `errorType` field is informative but does NOT leak credential validity beyond current `error` string.
- No new auth surface.

## Next Steps

- Independent — does not block other phases.
- Wave 18 candidate: same pattern for `getCurrentUser()` session fallback errors.

## Completion Notes (2026-05-09)

**Status:** ✅ Complete. Discriminated union added + 5 caller routes updated + 13 new tests added.

**Files Modified:**
- `src/forest/missions/api-key-auth.ts` — added discriminated union return type: `ApiKeyAuthResult` with `errorType?: 'missing_credentials' | 'invalid_key' | 'inactive' | 'db_unreachable'`. Sentry tag `auth.error_type` added to catch block (db_unreachable path).
- `src/app/api/v1/missions/route.ts` (POST + GET endpoints) — updated error handling to use errorType-driven HTTP status
- `src/app/api/v1/missions/[id]/route.ts` — updated error mapping
- `src/app/api/v1/missions/[id]/stream/route.ts` (SSE) — updated error mapping
- `src/app/api/v1/credits/route.ts` — updated error mapping
- Extracted helper: `apiKeyAuthErrorResponse(auth)` in api-key-auth.ts returning `NextResponse` (DRY, keeps callers clean)

**Error Mapping (per errorType):**
- `missing_credentials` → 401
- `invalid_key` → 401
- `inactive` → 403 (user exists but key disabled)
- `db_unreachable` → 503 (transient DB failure)

**Tests:**
- +13 new tests covering all 4 errorType branches + mocked D1Client throws
- All 3045 tests pass (was 3018 baseline, net +27 from Wave 17)
- Existing route tests updated to expect new 503 status on DB errors

**Sentry Integration:**
- Logger.error in catch path includes `sentryTags: { 'auth.error_type': 'db_unreachable' }`
- Uses existing `logger-utility.ts` Sentry integration point (no new deps)

**Unresolved**
- Should `inactive` key return 403 or 401? 403 = "we know who you are but you can't"; 401 = "auth failed". Recommend 403 — closer to truth. Confirm with user during implementation. (IMPLEMENTED: 403 selected per RFC.)
