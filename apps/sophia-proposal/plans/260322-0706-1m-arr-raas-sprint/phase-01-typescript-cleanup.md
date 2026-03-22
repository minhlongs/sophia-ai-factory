---
phase: 1
title: "TypeScript Cleanup"
priority: P1
status: pending
effort: 2h
---

# Phase 1 — TypeScript Cleanup

## Context Links
- [System Architecture](../../docs/system-architecture.md)
- [D1 Client](../../lib/db/client.ts)
- [D1 Query Builder](../../lib/db/d1-query-builder.ts)

## Overview

Fix D1 type annotations across codebase. Remove `ignoreBuildErrors` if present. Ensure `tsc --noEmit` passes clean.

## Key Insights

- `lib/db/client.ts` uses `D1Database` type from CF Workers — needs `@cloudflare/workers-types`
- `sentry.server.config.ts` and `sentry.client.config.ts` have `: any` occurrences
- `next.config.js` refs `@supabase/supabase-js` in `serverComponentsExternalPackages`
- `LazyQueryChain` in `lib/db/client.ts` uses `Function` type and `Record<string, Function>`

## Requirements

### Functional
- All `.ts`/`.tsx` files compile with `tsc --noEmit`
- Zero `: any` across `lib/` and `app/`

### Non-functional
- No runtime behavior change
- Keep D1Client Supabase-compatible API surface

## Related Code Files

### Files to modify
- `lib/db/client.ts` — fix `Function` type, add proper generics
- `lib/db/d1-query-builder.ts` — audit D1 result types
- `sentry.server.config.ts` — replace `any`
- `sentry.client.config.ts` — replace `any`
- `next.config.js` — remove `@supabase/supabase-js` from experimental packages
- `tsconfig.json` — verify `strict: true`, no `ignoreBuildErrors`

### Files to create
- `types/d1.ts` — shared D1 type helpers (if needed)

## Implementation Steps

1. Run `npx tsc --noEmit 2>&1 | head -50` to get current error list
2. Add `@cloudflare/workers-types` to `tsconfig.json` types array if missing
3. Fix `lib/db/client.ts`:
   - Replace `Record<string, Function>` with typed chain interface
   - Add proper return types to `LazyQueryChain.execute()`
4. Fix Sentry config files — replace `any` with `unknown` or proper Sentry types
5. Audit `lib/db/d1-query-builder.ts` for untyped returns
6. Remove `ignoreBuildErrors` from `next.config.js` if present
7. Run `npx tsc --noEmit` — must exit 0

## Todo List

- [ ] Baseline `tsc --noEmit` error count
- [ ] Fix D1 client types
- [ ] Fix Sentry config types
- [ ] Clean `next.config.js` experimental packages
- [ ] Verify `tsconfig.json` strict mode
- [ ] Final `tsc --noEmit` clean pass

## Success Criteria

- `npx tsc --noEmit` exits 0
- `grep -r ": any" lib/ app/` returns 0 matches
- All 183+ existing tests still pass

## Risk Assessment

- **D1 type changes could break query builder** — mitigate by running full test suite after each change
- **Sentry SDK may require specific types** — check `@sentry/nextjs` exports
