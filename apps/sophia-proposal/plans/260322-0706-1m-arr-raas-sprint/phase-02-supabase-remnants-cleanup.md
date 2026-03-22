---
phase: 2
title: "Supabase Remnants Cleanup"
priority: P1
status: pending
effort: 1h
---

# Phase 2 — Supabase Remnants Cleanup

## Context Links
- [System Architecture](../../docs/system-architecture.md) — still says "Supabase" in Data Layer section
- [D1 Client](../../lib/db/client.ts) — already D1, but has Supabase naming
- [middleware.ts](../../middleware.ts)

## Overview

Remove all Supabase references: unused env vars, imports, package deps, docs mentions. Platform is 100% Cloudflare (D1 + Workers + R2).

## Key Insights

- `lib/db/client.ts` — comment says "drop-in replacement for lib/supabase/client.ts" (ok to keep as historical note)
- `next.config.js` — `serverComponentsExternalPackages: ['@supabase/supabase-js']` must go
- `middleware.ts` — no Supabase imports found (clean)
- `docs/system-architecture.md` — Data Layer still says "Supabase" throughout
- `docs/development-roadmap.md` — mentions "Supabase Auth" in Phase 1

## Requirements

### Functional
- Remove `@supabase/supabase-js` from `package.json` if present
- Remove `NEXT_PUBLIC_SUPABASE_*` env var references
- Clean `next.config.js` experimental packages

### Non-functional
- Update docs to say "Cloudflare D1" instead of "Supabase"
- No runtime behavior change

## Related Code Files

### Files to modify
- `next.config.js` — remove supabase from `serverComponentsExternalPackages`
- `package.json` — remove `@supabase/supabase-js` dep if still listed
- `.env.example` (if exists) — remove SUPABASE vars
- `docs/system-architecture.md` — update Data Layer section: D1 not Supabase
- `docs/development-roadmap.md` — update Phase 1 milestones: "Custom JWT Auth" not "Supabase Auth"

### Files to delete
- `lib/supabase/` directory (if still exists)

## Implementation Steps

1. `grep -r "supabase\|SUPABASE" . --include="*.ts" --include="*.tsx" --include="*.js" --include="*.json"` — get full list
2. Remove `@supabase/supabase-js` from `package.json` dependencies
3. Clean `next.config.js` — remove `serverComponentsExternalPackages` entirely
4. Remove any `lib/supabase/` files if they still exist
5. Update `docs/system-architecture.md`:
   - Data Layer: "Cloudflare D1" not "Supabase"
   - Auth: "Custom JWT (Web Crypto API)" not "Supabase Auth"
   - RPC: "D1 stored procedures" not "Supabase RPC"
6. Update `docs/development-roadmap.md` Phase 1 — accurate auth description
7. Run tests to verify nothing broke

## Todo List

- [ ] Grep for all Supabase references
- [ ] Remove `@supabase/supabase-js` package dep
- [ ] Clean `next.config.js`
- [ ] Delete `lib/supabase/` if exists
- [ ] Update system-architecture.md
- [ ] Update development-roadmap.md
- [ ] Run full test suite

## Success Criteria

- `grep -r "supabase" package.json` returns 0 matches
- `grep -r "@supabase" lib/ app/` returns 0 matches
- Docs accurately reflect Cloudflare D1 stack
- All tests pass
