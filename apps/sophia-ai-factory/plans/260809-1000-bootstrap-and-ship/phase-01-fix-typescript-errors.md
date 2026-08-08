# Phase 01: Fix TypeScript Errors

**Priority:** CRITICAL
**Status:** In Progress
**Dependencies:** None

---

## Context Links
- Type-check output: 30+ errors in `src/tree/audit/` and `src/forest/missions/`
- Related files: audit module (crypto-utils, gdpr-redaction, right-to-erasure, logger)

---

## Overview
Fix all TypeScript compilation errors to achieve 0-error build. Primary issues:
1. `src/tree/audit/` — `unknown` type handling, missing properties, type mismatches
2. `src/forest/missions/__tests__/api-key-auth.test.ts` — missing import `../api-key-auth`

---

## Key Insights
- Audit module has accumulated type debt from schema changes
- `unknown` types from database queries need proper narrowing
- GDPR redaction and right-to-erasure types don't match expected interfaces
- Test import path likely wrong — file may be renamed or moved

---

## Requirements
### Functional
- All `tsc --noEmit` errors resolved
- No `:any` types introduced (use proper interfaces)
- Maintain existing runtime behavior

### Non-Functional
- Zero new lint warnings
- No breaking changes to public APIs

---

## Architecture
- Files to fix: `src/tree/audit/*.ts`, `src/forest/missions/__tests__/api-key-auth.test.ts`
- No cross-layer changes needed — these are leaf modules

---

## Related Code Files

### To Modify
1. `src/tree/audit/crypto-utils-signing.test.ts` — lines 149-186: unknown type arguments
2. `src/tree/audit/crypto-utils.test.ts` — lines 250-293: unknown type arguments
3. `src/tree/audit/gdpr-redaction.ts` — lines 84-122: missing properties, type mismatches
4. `src/tree/audit/logger/audit-event-builder.ts` — line 24: QueryResult type
5. `src/tree/audit/logger/audit-writer-extended.ts` — lines 73, 131: unknown → string
6. `src/tree/audit/logger/audit-writer.ts` — lines 58, 100, 142: unknown → string
7. `src/tree/audit/right-to-erasure-legal-hold.ts` — lines 23, 42: missing type, operator error
8. `src/tree/audit/right-to-erasure.ts` — lines 54-91: unknown → string/Date/number
9. `src/forest/missions/__tests__/api-key-auth.test.ts` — line 20: import path

### To Verify
- `src/tree/audit/types.ts` — ensure interfaces are correct
- `src/seed/db/client.ts` — verify QueryResult type

---

## Implementation Steps

1. **Fix crypto-utils test files** — Add proper type guards/narrowing for `unknown` values from crypto operations
2. **Fix gdpr-redaction.ts** — Ensure `RedactedAuditLog` object has all required properties; fix `Json` type usage
3. **Fix audit writer files** — Add type guards for database query results (`unknown` → `string`)
4. **Fix right-to-erasure files** — Define missing `AuditUserMetadataRow` type; fix Date/number conversions
5. **Fix audit-event-builder.ts** — Handle `QueryResult<Record<string, unknown>>` correctly
6. **Fix test import** — Locate `api-key-auth` module and fix import path
7. **Run type-check** — Verify 0 errors

---

## Todo List
- [ ] Fix crypto-utils-signing.test.ts unknown types
- [ ] Fix crypto-utils.test.ts unknown types
- [ ] Fix gdpr-redaction.ts missing properties & type mismatches
- [ ] Fix audit-writer-extended.ts unknown → string
- [ ] Fix audit-writer.ts unknown → string
- [ ] Fix right-to-erasure-legal-hold.ts missing type & operator
- [ ] Fix right-to-erasure.ts unknown conversions
- [ ] Fix audit-event-builder.ts QueryResult type
- [ ] Fix api-key-auth.test.ts import path
- [ ] Run `npm run type-check` → 0 errors

---

## Success Criteria
- `npx tsc --noEmit` exits with code 0
- No new `:any` types introduced
- All existing tests still pass (after Phase 02)

---

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking runtime behavior | Medium | High | Add type guards, not casts; test after each fix |
| Missing interface definitions | High | Medium | Check `src/tree/audit/types.ts` first |
| Circular dependency from fixes | Low | High | Keep changes local to audit module |

---

## Security Considerations
- Audit logging handles PII — ensure type fixes don't leak data
- Right-to-erasure is GDPR-critical — verify logic unchanged

---

## Next Steps
→ Phase 02: Fix Broken Test Import (if not resolved in this phase)
→ Phase 03: Run Full Test Suite + Lint