# Phase 4 — KV Feature-Flag Canary Helper

## Context Links
- `apps/sophia-ai-factory/src/lib/signals/feature-flags.ts` (existing PostHog-backed flag eval — DO NOT modify)
- `apps/sophia-ai-factory/wrangler.toml` (`EXPERIMENT_KV` already bound)
- Reports: `plans/reports/synthesis-260417-1011-sophia-claudekit-mekong-mapping.md` §"#3 Canary Rollout Helper"

## Overview
- **Priority:** P2
- **Status:** pending
- **Owner:** dev-C (fullstack-developer)
- **Effort:** 2h
- New helper at `src/lib/feature-flags/index.ts` providing **percentage-rollout primitive** independent of PostHog. Co-exists with `signals/feature-flags.ts` (PostHog A/B). Use cases: "ship to 10% then 50% then 100%" without PostHog dep.

## Key Insights
- Reuse existing `EXPERIMENT_KV` namespace — no new wrangler.toml edit.
- Stable hash: `userId` → bucket 0–99 via FNV-1a or SHA-256 truncation. **Same userId always → same bucket**, regardless of process restart.
- Flag config stored as KV value: JSON `{ "enabled": bool, "percent": 0-100 }`. KV key: `flag:{flagName}`.
- Decision rule: `enabled && (percent === 100 || hash(userId) % 100 < percent)`.
- If KV miss or no `userId`: return `false` (closed by default).

## Requirements

### Functional
- `isEnabled(flagName: string, userId?: string): Promise<boolean>` — main API.
- `setFlag(flagName: string, config: { enabled: boolean; percent: number }): Promise<void>` — admin write helper.
- `bucketFor(userId: string): number` — exposed for tests + telemetry.
- Default behavior when flag missing: closed (`false`).
- 60s in-process memo (per Worker isolate) to dedupe KV reads in hot loops.

### Non-Functional
- Edge runtime; no Node-only crypto (use `crypto.subtle` or pure-JS FNV-1a — pick FNV-1a for sync determinism).
- Zero `:any`. Zod-validate KV value on read (corrupt KV → fail closed).
- ≤100 LOC implementation file.

## Architecture
```ts
// src/lib/feature-flags/index.ts
import { z } from 'zod'

const ConfigSchema = z.object({
  enabled: z.boolean(),
  percent: z.number().int().min(0).max(100),
})

const memo = new Map<string, { value: boolean; expires: number }>()
const TTL_MS = 60_000

function fnv1aHash(input: string): number { /* …32-bit FNV-1a… */ }
export function bucketFor(userId: string): number { return fnv1aHash(userId) % 100 }

export async function isEnabled(flagName: string, userId?: string): Promise<boolean> {
  const memoKey = `${flagName}:${userId ?? '_anon'}`
  const cached = memo.get(memoKey)
  if (cached && cached.expires > Date.now()) return cached.value

  const kv = (globalThis as Record<string, unknown>)['EXPERIMENT_KV'] as KVNamespace | undefined
  if (!kv) return false

  let value = false
  try {
    const raw = await kv.get(`flag:${flagName}`)
    if (raw) {
      const parsed = ConfigSchema.parse(JSON.parse(raw))
      if (parsed.enabled) {
        if (parsed.percent >= 100) value = true
        else if (userId) value = bucketFor(userId) < parsed.percent
      }
    }
  } catch {
    value = false
  }

  memo.set(memoKey, { value, expires: Date.now() + TTL_MS })
  return value
}

export async function setFlag(/* … */): Promise<void> { /* PUT to KV */ }
```

## Related Code Files

### Create
- `apps/sophia-ai-factory/src/lib/feature-flags/index.ts` — main impl
- `apps/sophia-ai-factory/src/lib/feature-flags/index.test.ts` — ≥6 tests:
  - flag missing → false
  - flag disabled → false
  - flag enabled @ 100% → true (even no userId)
  - flag enabled @ 50% → ~50/100 deterministic split across 100 fake userIds
  - same userId always same bucket
  - corrupt KV value → false (no throw)

### Modify
- none (consumers will adopt in future iterations; this phase ships the primitive only — YAGNI on premature instrumentation)

### Delete
- none

## Implementation Steps
1. Create `src/lib/feature-flags/index.ts` per Architecture spec. Implement FNV-1a inline (~20 LOC).
2. Create `src/lib/feature-flags/index.test.ts` with ≥6 cases. Mock `EXPERIMENT_KV` via `globalThis` injection.
3. Verify `npm run build` 0 errors, `npm test` all pass.
4. Add JSDoc usage example at top of `index.ts`:
   ```ts
   /**
    * Usage:
    *   await setFlag('new-checkout-flow', { enabled: true, percent: 10 })
    *   if (await isEnabled('new-checkout-flow', userId)) { … }
    *
    * Admin from CLI:
    *   wrangler kv key put --binding=EXPERIMENT_KV "flag:new-checkout-flow" '{"enabled":true,"percent":10}'
    */
   ```
5. Document in `docs/codebase-summary.md` under §"Key Patterns" (defer to docs-manager agent if not in scope).

## File Ownership (Parallel Mode)
- **Owns exclusively:** `apps/sophia-ai-factory/src/lib/feature-flags/` (entire new dir).
- Zero overlap with `src/lib/signals/feature-flags.ts` (different file, different dir, different purpose — PostHog A/B vs percentage canary).

## Dependencies
- **Blocks:** none
- **Blocked by:** Phase 0

## Todo List
- [ ] Create `src/lib/feature-flags/index.ts` (~100 LOC)
- [ ] Implement FNV-1a hash
- [ ] Implement `isEnabled`, `bucketFor`, `setFlag`
- [ ] Write 6+ unit tests (deterministic distribution test critical)
- [ ] Add JSDoc usage example
- [ ] `npm run build` 0 errors
- [ ] `npm test` all pass

## Success Criteria
- `await isEnabled('test-flag', 'user123')` returns same value across calls.
- For 1000 fake userIds w/ flag @ 30%, ~280–320 return true (statistical sanity).
- KV unset → returns false; corrupt JSON → returns false.

## Risk Assessment
- **R1:** FNV-1a not perfectly uniform → test for ±5% drift on 1000 samples.
- **R2:** In-process memo bloats memory under high cardinality → cap at 1000 entries via simple LRU; document as YAGNI for now (Workers isolates restart often, natural eviction).
- **R3:** Founder confuses with existing `signals/feature-flags.ts` → docs example clarifies "use this for canary %, use signals for PostHog A/B".

## Security Considerations
- `setFlag` is admin-only — guard at caller layer (don't expose unauthenticated). Document explicitly.
- Hash collisions across users acceptable (canary, not auth).

## Next Steps
- Future: build admin UI for flag management (deferred — KV CLI suffices for solo founder).
- Future: instrument flag eval w/ `track('feature_flag_eval', …)` once Phase 1 is in place.
