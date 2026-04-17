# Phase 03 — Callers + Tests

## Context Links

- Caller: `apps/sophia-ai-factory/src/app/api/cron/weekly-signals-digest/route.ts` (line 22 import, lines 82-94 build key + lookup, lines 118-126 write)
- Cache impl (after Phase 02): `apps/sophia-ai-factory/src/lib/llm/cache/llm-cache.ts`
- Tests: `apps/sophia-ai-factory/src/lib/llm/cache/llm-cache.test.ts`
- Plan overview: [plan.md](./plan.md)

## Overview

- **Priority:** P1
- **Status:** pending
- **Description:** Update sole existing caller to pass `'system'` sentinel, add cross-org isolation + hash-divergence + RPC-args tests, run full suite.

## Key Insights

- Only one current caller: `weekly-signals-digest` (system cron, no user context) → use `'system'` sentinel.
- Future Supervisor / RaaS / direct user LLM callers (Phase 4F) MUST use `(await getCurrentUser()).id`. Document the contract in JSDoc on `CacheKey.orgId`.
- Tests in `llm-cache.test.ts` must (a) supply orgId in every existing `baseKey`, (b) add new cross-org isolation scenario, (c) assert RPC call passes `p_org_id`.
- Mock chain currently handles `.eq(...)` once; cross-org isolation test needs the mock to return different rows per `orgId` argument — either track `.eq` calls or switch to a function-returning mock.
- Sentinel naming: `'system'` reserved for platform jobs (cron, health probes). Never usable as user id (user ids are UUIDs, not slugs) — zero collision risk.

## Requirements

### Functional
- `weekly-signals-digest` cron passes `orgId: 'system'`
- All existing 1148 tests still pass (with orgId added to `baseKey`)
- New test: writing under orgId A then looking up under orgId B returns `null`
- New test: `hashCacheKey({orgId: 'a', ...})` ≠ `hashCacheKey({orgId: 'b', ...})` (same prompt)
- New test: `incrementHitCount` RPC receives `p_org_id` matching key
- New test: empty-string orgId → `lookupCache` / `writeCache` short-circuit (no D1 call)

### Non-functional
- Zero regression in pre-existing test suite
- `npm test` runs in <60s on M1 Max
- Test file <400 LOC (currently 375; budget tight — extract shared helpers if needed)

## Architecture

### Caller update (`weekly-signals-digest/route.ts`)

```ts
// Existing
const cacheKey: CacheKey = {
  provider: 'openrouter',
  model:    'openai/gpt-4o-mini',
  messages,
}

// After
const cacheKey: CacheKey = {
  provider: 'openrouter',
  model:    'openai/gpt-4o-mini',
  messages,
  orgId:    'system',    // platform-scope cron; PDF Phase 4E H-1
}
```

### Mock chain upgrade (`llm-cache.test.ts`)

Current `buildChainMock` returns same row regardless of `.eq` arguments. For cross-org isolation:

```ts
function buildOrgAwareChainMock(rows: Record<string, unknown>) {
  // rows keyed by orgId — miss returns { data: null, error: { message: 'not found' } }
  let capturedOrg = ''
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq:     vi.fn((col: string, val: string) => {
      if (col === 'org_id') capturedOrg = val
      return chain
    }),
    single: vi.fn(async () => {
      const row = rows[capturedOrg]
      return row
        ? { data: row, error: null }
        : { data: null, error: { message: 'Row not found' } }
    }),
    upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
  }
  return chain
}
```

### New test cases

1. `cross-org isolation — org A write, org B lookup returns null`
2. `hashCacheKey differs when orgId differs (same prompt)`
3. `lookupCache returns null when orgId is empty string (no D1 call)`
4. `writeCache is no-op when orgId is empty string (no D1 call)`
5. `incrementHitCount RPC receives p_org_id matching key`
6. `upsert payload includes org_id field`

## Related Code Files

**Modify:**
- `apps/sophia-ai-factory/src/app/api/cron/weekly-signals-digest/route.ts` (1-line change to `cacheKey` object)
- `apps/sophia-ai-factory/src/lib/llm/cache/llm-cache.test.ts` (update `baseKey` + add 6 tests)

**Read-only:**
- `apps/sophia-ai-factory/src/lib/llm/cache/llm-cache.ts` (post Phase 02)
- `apps/sophia-ai-factory/src/lib/db/d1-query-builder.ts` (post Phase 02)

## Implementation Steps

### Caller

1. Add `orgId: 'system'` to the `cacheKey` object literal in `summarizeWithAI`
2. Verify no other callers via `rg "from.*llm-cache" apps/sophia-ai-factory/src`

### Tests

3. Update top-level `baseKey` to include `orgId: 'org_test_a'`
4. Existing RPC assertion update: `expect(rpc).toHaveBeenCalledWith('increment_llm_cache_hit', { p_hash: …, p_org_id: 'org_test_a' })`
5. Upsert payload assertion: add `expect(payload.org_id).toBe('org_test_a')`
6. Add test: `hashCacheKey differs when orgId differs` — two keys identical except orgId, expect hashes ≠
7. Add test: `cross-org isolation` — use `buildOrgAwareChainMock({ org_a: {...} })`; call `lookupCache` with orgId `'org_b'` → returns `null`; call with `'org_a'` → returns the row
8. Add test: `empty orgId short-circuits lookupCache` — orgId=`''`, expect null + `createServerClient` NOT called
9. Add test: `empty orgId short-circuits writeCache` — orgId=`''`, expect `createServerClient` NOT called
10. Add test: `upsert payload includes org_id` — inspect `chain.upsert.mock.calls[0][0]`
11. `npm test` from `apps/sophia-ai-factory/` → all green

### Compile + Verify

12. `npm run build` from `apps/sophia-ai-factory/` → 0 TS errors
13. `rg "CacheKey|lookupCache|writeCache" apps/sophia-ai-factory/src --type ts` → confirm every literal CacheKey has orgId field

## Todo List

- [x] Update caller `weekly-signals-digest/route.ts` — add `orgId: 'system'`
- [x] Update test `baseKey` to include orgId
- [x] Update existing hit-count RPC assertion with `p_org_id`
- [x] Add cross-org isolation test (org A write, org B miss)
- [x] Add hash-divergence-by-orgId test
- [x] Add empty-orgId short-circuit tests (lookup + write)
- [x] Add upsert payload org_id assertion
- [x] Add RPC p_org_id assertion
- [x] `npm test` green (target 1154+ tests)
- [x] `npm run build` 0 TS errors
- [x] `rg` sweep confirms all `CacheKey` literals have orgId

## Success Criteria

- All 1148 existing tests still pass
- New tests: 6 added, all pass (target 1154+)
- `npm run build` 0 errors
- No caller constructs `CacheKey` without `orgId` (TS compile enforces)
- Cross-org isolation test fails if any of (a) hash excludes orgId, (b) SELECT missing `.eq('org_id', …)`, (c) upsert payload missing `org_id` — proves defense-in-depth is live

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| `'system'` sentinel collides with a real user UUID | None (UUIDs are hex-dashed, slug is not) | Document in JSDoc; lint rule deferred |
| Mock chain refactor breaks unrelated tests | Medium | Keep existing `buildChainMock`, add `buildOrgAwareChainMock` side-by-side |
| Test file >400 LOC after additions | Low — readability | Extract chain helpers to `__test-utils__/cache-mocks.ts` if exceeded |
| Dashboard `llm_cache_stats` continues aggregating all orgs | Acceptable (admin view) | Deferred per-org variant documented in plan.md |

## Security Considerations

- `'system'` sentinel is hardcoded server-side — never derived from user input
- Test coverage explicitly verifies cross-org MISS (not just hit) — prevents silent regression
- Empty-string guard test ensures the H-1 global-bucket path stays closed
- Future Supervisor/RaaS callsites (Phase 4F) must use `(await getCurrentUser()).id`; add JSDoc note on `CacheKey.orgId` in Phase 02 to enforce the contract at author time

## Next Steps

- Merge PR → deploy to prod (env flag still OFF — zero behavioural change)
- Phase 4F unblocks: wire Supervisor + RaaS workflows to `lookupCache`/`writeCache` with real user orgId
- Phase 4E.2: semantic embedding cache (depends on this schema)
- Phase 4E.4 (deferred): per-org `llm_cache_stats_for_org(org_id)` RPC for future multi-tenant dashboard
