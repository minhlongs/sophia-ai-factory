# Phase 2 — Any-type reduction: auth/security modules

**Status:** ✅ COMPLETE (2026-04-19 21:57)
**Priority:** P2
**Session:** continuation of Phase 1 (`/cook next --auto`)

## Scope executed

Remove `:any` from security-critical production code theo canonical architecture (post-consolidation 2026-04-14).

| File | `:any` before | `:any` after | Note |
|---|---|---|---|
| `src/lib/security/jwt-validator.ts` | 17 | **0** | Narrow via `payload as Partial<ExtendedJwtPayload>` + `{ jti?: string }` cast for raw jti |
| `src/lib/auth/jwt-nonce-tracker.ts` | 2 | **0** | Removed `(globalThis as any).KV_KV` — use existing global `KV_KV` declaration |

**Total: 19 `:any` eliminated.**

## Verification

- ✅ Lint: 0 errors (3 pre-existing warnings unrelated)
- ✅ Vitest: 38/38 tests pass (`jwt-validator.test.ts` + `jwt-nonce-tracker.test.ts`)
- ✅ No runtime regression

## Deferred to Phase 3 (D1 migration)

These files còn `:any` vì Supabase-style API (`db.rpc`, `db.from('raas_api_keys')`) mà `createServerClient()` hiện trả về D1 client — runtime mismatch, không chỉ typing:

| File | `:any` | Blocker |
|---|---|---|
| `src/lib/security/sql-rate-limiter.ts` | 1 | `db.rpc('increment_rate_limit', ...)` — needs D1 `.prepare()` rewrite |
| `src/lib/security/api-key-validator.ts` | 5 | `db.from('raas_api_keys')` — needs D1 table migration + rewrite |

**Not fixable by retyping — needs architectural migration.** Scope for Phase 3.

## Remaining in auth/security

- Test files (`*.test.ts`): 30 `:any` — lower priority, convert in Phase 4 alongside API tests
- Documented in next-phase plan when created

## Next phase

Phase 3 priority:
1. D1 migration của `raas_api_keys` + rewrite api-key-validator
2. D1 `rate_limits` function rewrite trong sql-rate-limiter
3. Sau đó: any-type trong `src/app/api/` (137 items, biggest single bucket)
