# Phase 02 — Cache API: orgId threading

## Context Links

- Current impl: `apps/sophia-ai-factory/src/lib/llm/cache/llm-cache.ts`
- RPC helpers: `apps/sophia-ai-factory/src/lib/db/d1-query-builder.ts` (`incrementLlmCacheHit`, `llmCacheStats`)
- Migration: [phase-01-migration-and-schema.md](./phase-01-migration-and-schema.md)
- Plan overview: [plan.md](./plan.md)

## Overview

- **Priority:** P1
- **Status:** pending
- **Description:** Extend `CacheKey` with required `orgId`, thread through hash + queries, update RPCs. No behavioural change when `LLM_CACHE_ENABLED=0`.

## Key Insights

- `orgId` is REQUIRED (not optional) — callers must make a conscious choice (real user id vs `'system'` sentinel). Optional field = footgun where caller forgets and leaks revert to global bucket.
- `hashCacheKey` including `orgId` is **defense-in-depth**. Primary enforcement is SQL `WHERE org_id = ?`. Hash divergence ensures even a bug in query builder (e.g. forgotten `.eq('org_id', …)`) cannot collide rows across orgs.
- `increment_llm_cache_hit` RPC must also take `p_org_id` — composite PK means hash alone no longer identifies a single row.
- `llm_cache_stats` RPC stays global for Phase 4.7 dashboard (aggregate across orgs = admin view). Per-org variant deferred.
- Supabase-style `.eq('hash', h).eq('org_id', o).single()` chain — existing pattern, no new primitives.

## Requirements

### Functional
- `CacheKey { provider, model, messages, orgId }` — orgId required string
- `hashCacheKey` emits different hash for same prompt across different orgIds
- `lookupCache(key)` → SQL filters `hash = ? AND org_id = ?`
- `writeCache(key, entry, ttl)` → upsert includes `org_id`; conflict target `(hash, org_id)`
- `incrementLlmCacheHit(hash, orgId)` → `UPDATE … WHERE hash = ? AND org_id = ?`
- `llmCacheStats()` unchanged signature (aggregates all orgs — admin dashboard)

### Non-functional
- All files <200 LOC (llm-cache.ts currently 158 LOC — stays under)
- Zero `:any` types
- No `console.log`
- Swallow-all error semantics preserved (cache must never throw to caller)

## Architecture

### Public API change

```ts
// BEFORE
export interface CacheKey {
  provider: string
  model:    string
  messages: CacheMessage[]
}

// AFTER
export interface CacheKey {
  provider: string
  model:    string
  messages: CacheMessage[]
  orgId:    string           // NEW — required; '' is rejected by runtime guard
}
```

### Hash input

```ts
JSON.stringify({
  orgId:    key.orgId,       // NEW
  provider: key.provider,
  model:    key.model,
  messages: key.messages.map(m => ({ role: m.role, content: m.content })),
})
```

### Runtime guard

`lookupCache` / `writeCache` return early (`null` / `void`) when `orgId === ''` — same short-circuit posture as `isCacheEnabled()`. Prevents accidental empty-string bypass.

### SELECT

```ts
await db
  .from('llm_cache')
  .select('response, input_tokens, output_tokens, cost_usd, expires_at')
  .eq('hash',   hash)
  .eq('org_id', key.orgId)       // NEW
  .single()
```

### UPSERT

```ts
await db.from('llm_cache').upsert({
  hash,
  org_id:        key.orgId,      // NEW
  provider:      key.provider,
  model:         key.model,
  response:      entry.response,
  input_tokens:  entry.inputTokens,
  output_tokens: entry.outputTokens,
  cost_usd:      entry.costUsd,
  expires_at:    expiresAt.toISOString(),
})
```

### RPC change

```ts
// d1-query-builder.ts — incrementLlmCacheHit
private async incrementLlmCacheHit(
  hash:  string,
  orgId: string,        // NEW
): Promise<QueryResult<unknown>> {
  await this.db
    .prepare('UPDATE llm_cache SET hit_count = hit_count + 1 WHERE hash = ? AND org_id = ?')
    .bind(hash, orgId)
    .run();
  return { data: { success: true }, error: null };
}

// switch case dispatch
case 'increment_llm_cache_hit':
  return await this.incrementLlmCacheHit(
    params.p_hash   as string,
    params.p_org_id as string,
  );
```

```ts
// llm-cache.ts — incrementHitCount
async function incrementHitCount(hash: string, orgId: string): Promise<void> {
  try {
    const db = createServerClient()
    await db.rpc('increment_llm_cache_hit', { p_hash: hash, p_org_id: orgId })
  } catch { /* swallow */ }
}
```

## Related Code Files

**Modify:**
- `apps/sophia-ai-factory/src/lib/llm/cache/llm-cache.ts`
- `apps/sophia-ai-factory/src/lib/db/d1-query-builder.ts` (one case + one helper method)

**Do NOT modify:**
- `apps/sophia-ai-factory/src/lib/admin/monitoring-queries.ts` — `llm_cache_stats` stays global (admin view)

## Implementation Steps

### `llm-cache.ts`

1. Add `orgId: string` to `CacheKey` interface + JSDoc noting required field
2. Update `hashCacheKey` normalized JSON to include `orgId` as first key
3. Add helper `function isValidOrgId(orgId: string): boolean { return typeof orgId === 'string' && orgId.length > 0 }` OR inline the check
4. `lookupCache`: early `return null` if `!key.orgId`
5. `lookupCache`: add `.eq('org_id', key.orgId)` chain
6. `lookupCache`: pass `key.orgId` to `incrementHitCount`
7. `incrementHitCount` signature `(hash, orgId)` + pass `p_org_id`
8. `writeCache`: early `return` if `!key.orgId`
9. `writeCache`: include `org_id: key.orgId` in upsert payload
10. Verify file <200 LOC

### `d1-query-builder.ts`

11. `incrementLlmCacheHit` add `orgId: string` param, update SQL `WHERE hash = ? AND org_id = ?`, `.bind(hash, orgId)`
12. Switch case `'increment_llm_cache_hit'` — forward `params.p_org_id as string`
13. Do NOT modify `llmCacheStats` (deferred per-org variant)

## Todo List

- [x] Update `CacheKey` interface — add `orgId: string`
- [x] Update `hashCacheKey` normalized JSON — include orgId
- [x] Update `lookupCache` — early return, `.eq('org_id', …)`, pass orgId to hit count
- [x] Update `writeCache` — early return, include `org_id` in upsert payload
- [x] Update `incrementHitCount` helper signature + RPC params
- [x] Update `d1-query-builder.ts` `incrementLlmCacheHit` method + switch case
- [x] `npm run build` from `apps/sophia-ai-factory/` → 0 errors
- [x] `grep -n "orgId" src/lib/llm/cache/llm-cache.ts` → verify threading complete

## Success Criteria

- `npm run build` 0 TS errors in `apps/sophia-ai-factory/`
- No `:any` types added
- File sizes: `llm-cache.ts` <200 LOC, `d1-query-builder.ts` unchanged structure
- Type-level: `lookupCache({ provider, model, messages })` (missing orgId) = compile error

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking change to `CacheKey` — existing callers don't compile | Caught by TypeScript | Phase 03 updates all callers in same PR |
| Empty-string `orgId` slips through | H-1 regression | Runtime guard (`!key.orgId`) short-circuits to disabled behaviour |
| Forgot to update test mocks for new RPC signature | CI fails | Phase 03 updates mocks |
| `llm_cache_stats` RPC stays global — admin sees cross-org totals | Acceptable — admin role | Documented in plan.md "Out of Scope" |

## Security Considerations

- `orgId` in hash = if `.eq('org_id', …)` chain is ever accidentally removed (regression), hashes still differ → no cross-org response served
- Runtime empty-string guard closes the global-bucket escape
- `orgId` derived server-side ONLY — callers in Phase 03 must use `getCurrentUser()` → user.id, or hard-coded sentinel for cron
- NEVER accept `orgId` from request body / query string directly

## Next Steps

Phase 03: update the single caller `weekly-signals-digest` to pass `'system'` sentinel, add cross-org isolation tests, run full suite.
