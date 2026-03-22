# Phase Implementation Report

### Executed Phase
- Phase: pilot-onboarding-api
- Plan: none (direct task)
- Status: completed

### Files Modified
| File | Lines | Action |
|------|-------|--------|
| `lib/raas/onboarding.ts` | 133 | created |
| `app/api/v1/onboard/route.ts` | 70 | created |
| `app/api/v1/org/[orgId]/usage/route.ts` | 90 | created |
| `app/api/v1/org/[orgId]/api-keys/route.ts` | 52 | created |

### Tasks Completed
- [x] `lib/raas/onboarding.ts` — createOrganization(), createAdminUser(), generateOrgApiKey()
- [x] `app/api/v1/onboard/route.ts` — POST handler, input validation, 201 response
- [x] `app/api/v1/org/[orgId]/usage/route.ts` — GET handler with API key auth + org-scope guard
- [x] `app/api/v1/org/[orgId]/api-keys/route.ts` — POST handler with API key auth + org-scope guard

### Implementation Notes
- Used `crypto.subtle` (Web Crypto) throughout — SHA-256 for API key hashing, PBKDF2 for passwords; matches pattern in `lib/db/auth.ts`
- `generateOrgApiKey()` extracted to `lib/raas/onboarding.ts` so both the onboard route and api-keys route share one implementation (DRY)
- Both org-scoped routes guard `auth.orgId !== params.orgId` → 403, preventing cross-org key use
- Duplicate email/org D1 UNIQUE errors surfaced as 400 in onboard route
- No edge runtime export — opennextjs handles routing
- `validateApiKey` reused from existing `lib/raas/api-key-manager.ts` (no duplication)

### Tests Status
- Type check: pass (tsc --noEmit → 0 errors)
- Unit tests: not run (no test suite configured in project)
- Integration tests: not run

### Issues Encountered
- None

### Next Steps
- D1 migrations needed: `organizations` table needs `email` + `plan` columns; `api_keys` table (separate from `raas_api_keys` used by missions); `mcu_ledger` table
- Confirm table names match existing schema — task spec uses `api_keys` but existing `api-key-manager.ts` uses `raas_api_keys`
- Consider rate-limiting the `/onboard` endpoint (currently unbounded)

### Unresolved Questions
1. Table name conflict: task spec says `api_keys` table, but `lib/raas/api-key-manager.ts` uses `raas_api_keys`. Should onboarding use `raas_api_keys` to be consistent with `validateApiKey()`?
2. `organizations` table schema — does it already have `email` and `plan` columns, or do migrations need to add them?
3. `mcu_ledger` vs `org_balances` — missions use `org_balances` for balance checks via `debit_mcu_balance` RPC. Should ledger inserts also update `org_balances`?
