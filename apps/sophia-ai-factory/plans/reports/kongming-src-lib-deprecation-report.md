# src/lib/ Deprecation Audit Report

**Date:** 2026-08-02
**Scope:** Audit of `src/lib/` against canonical 4-layer imports (`seed/`, `tree/`, `forest/`, `land/`)
**Status:** COMPLETE — no action required

## Finding

`src/lib/` is **empty**. All files have been migrated to their canonical layer destinations during the 2026-04-14 consolidation.

## Remaining `lib/` References — All Internal (Safe)

| File | Import | Status |
|------|--------|--------|
| `src/forest/worker/worker-handlers.ts:8-11` | `./lib/quota-counter`, `./lib/overage-calculator`, `./lib/usage-emitter`, `./lib/quota-response` | Co-located forest/worker package internals — **not** legacy `@/lib/` alias. These are legitimate internal modules. |

## Canonical Replacements Already in Place

| Former `src/lib/` path | Canonical replacement | Verified |
|------------------------|----------------------|----------|
| `@/lib/auth` | `@/seed/auth/better-auth-session` | ✅ |
| `@/lib/subscription` | `@/seed/db/get-user-tier` | ✅ |
| `@/lib/unified-tier-config` | `@/seed/config/tiers` | ✅ |
| `@/lib/tier-gate` | `@/seed/config/tiers` + land guards | ✅ |

## Recommendation

- No deprecation action needed — `src/lib/` is already cleared.
- The 4 remaining local `./lib/` imports in `forest/worker/` are internal module boundaries and should stay (they are not the banned `@/lib/*` aliases).
- ESLint `no-restricted-imports` rule guards against re-introduction of `@/lib/auth`, `@/lib/subscription`, etc.

## Audit Method

```bash
ls src/lib/  # → empty
grep -rn "from ['\"]@/lib\|from ['\"].*lib/" src/  # → only local ./lib/ in forest/worker
```
