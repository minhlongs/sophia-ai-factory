# Phase 04 — Move Manifest (Tree Layer)
Generated: 2026-05-03 | Total: 168 files

## Summary

| Group | Count |
|-------|-------|
| src/tree/admin | 7 |
| src/tree/audit | 49 (main + checks/ + logger/) |
| src/tree/byok | 12 |
| src/tree/clients | 4 |
| src/tree/credentials | 6 |
| src/tree/crypto | 3 |
| src/tree/gateway | 14 |
| src/tree/handover | 9 |
| src/tree/telegram | 34 |
| src/tree/components/setup-wizard | 7 |
| **Route files that STAYED** | page.tsx + layout.tsx (src/app/setup-wizard/) |

## Key Decisions
- `lib/agents/*` — scout CSV = forest (NOT tree). Deferred to Phase 05.
- `app/setup-wizard/page.tsx` + `layout.tsx` — STAYED per route mandate
- `app/setup-wizard/components/*` → `src/tree/components/setup-wizard/*`

## Phase 03 Deferral Resolved
- `@/lib/audit/crypto-utils` dynamic import in `seed/security/api-key-validator.test.ts`
  → Fixed: `vi.mock('@/tree/audit/crypto-utils', ...)`

## Extra Fixes (not in codemod, found during build)
- `src/lib/raas-service-key-operations.ts:8` relative `./audit/crypto-utils` → `@/tree/audit/crypto-utils`
- `src/lib/raas-service.test.ts:11` relative `./audit/crypto-utils` → `@/tree/audit/crypto-utils`
- `src/lib/core/index.ts:1` relative `../gateway` → `@/tree/gateway`
- `src/app/setup-wizard/page.tsx` relative `./components/*` → `@/tree/components/setup-wizard/*`

## Build Result
- npm run build: PASS (0 TS errors)
- npm test --run: PASS (2546 / 0 fail, 258 test files)
- Routes unchanged: diff /tmp/routes-before.txt /tmp/routes-after.txt = empty
