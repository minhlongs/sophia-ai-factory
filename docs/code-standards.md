# Code Standards — Sophia AI Factory

> Canonical standards for development, enforced across all code changes (2026).

**Last Updated:** 2026-04-20 (Type Safety + Module Pattern Standards)
**Codebase Commitment:** Zero `:any` types, 100% TypeScript strict mode, 1297+ test pass rate

---

## Type Safety (Non-Negotiable)

### Zero `:any` Rule
- **All code files** must have 0 `:any`, `as any`, or `@ts-ignore` directives
- D1 response double-casts use `as unknown as T` pattern only (see D1Response generic below)
- TypeScript strict mode enforced via `tsconfig.json`
- Verification: `grep -r ': any\|as any\|@ts-ignore' src --include="*.ts" --include="*.tsx"` must return 0 results

### Canonical Pattern: D1Response<T> Generic
**Purpose:** Type-safe wrapper for D1 query results that return `{ data: T | null; error: unknown }`.

**Location:** `src/lib/usage-metering/types.ts` (established Phase 10) — candidate to promote to `src/lib/db/types.ts` in Phase 11+.

**Usage:**
```typescript
import { D1Response } from '@/lib/usage-metering/types';

const result = await db.from('licenses').select().single();
const typed = result as unknown as D1Response<LicenseRow>;
if (typed.error) {
  // handle error
}
```

### Module-Level Types Pattern
**Rule:** Every domain module must have a `<module>/types.ts` file exporting:
1. Shared row interfaces (D1 query results)
2. Domain-specific input/output contracts
3. Reusable generic types (like `D1Response<T>`)

**Established in:** `src/lib/audit/types.ts` (Phase 9), `src/lib/usage-metering/types.ts` (Phase 10)

**Example:**
```typescript
// src/lib/usage-metering/types.ts
export interface D1Response<T> { /* ... */ }
export interface UsageEventInsertable { /* ... */ }
export interface LicenseMetadataRow { /* ... */ }
```

---

## Testing Standards

### Minimum Coverage
- **Unit tests:** All business logic, edge cases, error paths
- **Pass rate:** 100% (no skipped or xfail tests in main)
- **Command:** `npm test` must exit 0 before any commit
- **Current:** 1297/1297 tests pass (106 test files)

### Test Organization
- Co-locate tests: `feature.ts` → `feature.test.ts` in same directory
- Use descriptive `describe()` blocks scoped to module/function
- Test error scenarios + success paths equally
- No `console.log` in tests (use logger.debug if needed)

---

## Module Organization

### File Size Limits
- **Code files:** ≤ 200 lines (split if exceeding)
- **Type files:** ≤ 300 lines (interfaces, generics, unions)
- **Configuration:** No limit (config files exempt)

### Naming Conventions
- **Files:** kebab-case (e.g., `usage-metering.ts`, `api-key-store.ts`)
- **Variables:** camelCase
- **Constants:** UPPER_SNAKE_CASE (exported across modules)
- **Interfaces:** PascalCase, `Row` suffix for D1 queries (e.g., `UsageEventRow`)
- **Types:** PascalCase, `Input`/`Output`/`Config` suffix for contracts

---

## Error Handling

### Patterns
1. **Database errors:** Always type as `unknown`, narrow via `instanceof` or typeof guards
2. **API responses:** Use Zod for validation, return typed response objects
3. **Logging:** Use `logger` from `@/lib/logger.ts`, include structured metadata
4. **No silent failures:** All D1 errors logged with org_id + endpoint context

### Example
```typescript
try {
  const result = await db.from('users').select();
  const typed = result as unknown as D1Response<UserRow>;
  if (typed.error) {
    logger.error('db query failed', { error: typed.error, table: 'users' }, requestId);
    return { ok: false, error: 'failed to query users' };
  }
} catch (err) {
  logger.error('unexpected error', { error: err }, requestId);
  throw err;
}
```

---

## API Design

### Input Validation
- All route handlers validate input via Zod schemas
- Schema location: `src/lib/schema.ts` or route-local `{route}.schema.ts`
- Return errors consistently: `{ ok: boolean; error?: string; data?: T }`

### Tier-Based Gating
- Import tier config from `@/config/tiers` (single source of truth)
- Use `getUserTier()` helper from `@/lib/db/get-user-tier`
- Enforce quotas via `usage-metering` module (pre-flight check before action)
- Return 429 (Too Many Requests) when quota exceeded

---

## Database Conventions

### D1 Migrations
- File naming: `migrations/NNNN-description.sql` (zero-padded sequence)
- Idempotent: all migrations use `IF NOT EXISTS`, `IF EXISTS` where applicable
- Comments: Include `-- TODO` notes for deferred follow-ups (e.g., purge crons, indexes)

### Query Patterns
- Use `db.from<T>()` generics for type inference where possible
- Avoid raw SQL in handlers; extract to `lib/<domain>/` helpers
- Index critical paths: `org_id`, composite keys for multi-tenant isolation

---

## Security Standards

### Secrets & Credentials
- **BANNED:** Hardcoded API keys, master passwords, connection strings in code
- **Required:** Environment variables with runtime type-checking
- **Encryption:** Per-user keys stored encrypted (AES-GCM); see `@/lib/byok/*`
- **Verification:** `grep -r 'API_KEY\|PASSWORD\|SECRET' src --include="*.ts" | grep -v 'env\.' | grep -v import` must return 0

### Multi-Tenant Isolation
- All D1 queries scoped by `org_id`
- LLM cache, usage events, audit logs all org-scoped
- Single-user = single-org mapping (1-to-1 relationship in `users.org_id`)

---

## Build & Deployment

### Pre-Commit
1. `npm run build` must exit 0 (0 TS errors)
2. `npm test` must pass all tests
3. No console.log statements (use logger instead)
4. Commit message: conventional format (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`)

### Production Readiness
- Build time: < 10 seconds
- Zero `:any` types in shipped code
- 100% test pass rate
- All new secrets added to `.env.example` template (no values, just keys)

---

## Established Patterns (By Phase)

| Phase | Pattern | Location |
|-------|---------|----------|
| 9 | Module types extraction | `src/lib/audit/types.ts` |
| 10 | D1Response<T> generic | `src/lib/usage-metering/types.ts` |
| - | Tier normalization | `src/lib/auth/normalize-tier.ts` |
| - | BYOK encryption | `src/lib/byok/*` |
| - | Org resolution | `src/lib/auth/resolve-org-id.ts` |

---

## Code Review Checklist

- [ ] Zero `:any` types introduced
- [ ] All TypeScript errors fixed (`npm run build` clean)
- [ ] Tests pass 100% (`npm test`)
- [ ] No console.log in production code
- [ ] Database queries use proper type generics
- [ ] Error paths tested and logged
- [ ] API responses have consistent shape
- [ ] No breaking changes to existing APIs
- [ ] Comments explain *why*, not *what*

---

## Remaining Type-Safety Backlog

**Phases 7–10 cumulative:** 20 + 33 + 34 + 0 = **87 `:any` eliminated** (Phases 5-10)

**Future phases (candidate work):**
- **Phase 11+:** `lib/raas/*` (license table, quota logic)
- **Phase 12+:** FSM self-heal write-back in `telegram-fsm-state-manager.ts` (design phase 9 deferred)
- **Phase 13+:** `raas_licenses` audit table queries
- **Ongoing:** Ad-hoc refactors as new code written

Current status: **All current production code: 0 `:any` types** ✅

---

_Last reviewed 2026-04-20 by code-reviewer | Standards enforced by pre-commit hooks + CI linting_
