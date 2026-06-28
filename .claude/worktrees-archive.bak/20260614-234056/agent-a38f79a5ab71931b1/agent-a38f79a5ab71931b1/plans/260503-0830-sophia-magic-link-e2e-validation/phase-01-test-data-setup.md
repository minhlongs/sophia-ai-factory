# Phase 01 — Test Data Setup

## Context Links
- Predecessor plan: `plans/260503-0746-setup-wizard-fix-go-live/`
- Magic-link helpers: `apps/sophia-ai-factory/src/lib/handover/handover-magic-link.ts`
- Handover create endpoint: `apps/sophia-ai-factory/src/app/api/admin/handover/create/route.ts`
- Wrangler config: `apps/sophia-ai-factory/wrangler.toml` → DB binding `DB` (db `sophia-raas-db`, id `78bd1961-b62d-43bb-b551-0c5d7d389506`)

## Overview
- Priority: P1 (blocks Phase 02)
- Status: pending
- Description: Seed a deterministic test user + handover row in production D1 and mint a magic-link token usable by Phase 02 browser automation.

## Key Insights
- D1 has no separate "staging" — must seed against production `sophia-raas-db` with a clearly-marked test email (`e2e-test@sophia.local`) so cleanup is trivially scriptable in Phase 06.
- Re-using `createMagicLinkToken(handoverId)` keeps the test path identical to real magic-links (same TTL/SQL path) → DRY.
- Handover row needs minimum schema fields: `id`, `customer_user_id`, `agency_name`, `agency_type`, `tier`, `magic_link_token`, `magic_link_expires_at`, `status`, `source`. Use `source='e2e_test'` to make audit-log filtering easy.

## Requirements
**Functional**
- Idempotent seed (re-run safely → upsert user + handover, mint fresh token)
- Output exact magic-link URL on stdout: `https://sophia.agencyos.network/{vi|en}/welcome/<token>`
- Single bash entrypoint, no manual SQL editing

**Non-functional**
- Runs against PROD D1 via `npx wrangler d1 execute sophia-raas-db --remote`
- Marks test rows with `source='e2e_test'` for trivial cleanup
- Token TTL 1h (override default 24h — minimize blast radius if leaked)

## Architecture
```
scripts/e2e/seed-magic-link.sh
  ├── npx wrangler d1 execute --remote   (UPSERT user + handover)
  └── npx wrangler d1 execute --remote   (mint token via UPDATE)
       → echoes magic-link URL to stdout
```
Two-statement strategy avoids importing the Next.js runtime (handover-magic-link.ts uses `getD1Raw` which only resolves inside the Worker). Equivalent SQL is small and inline.

## Related Code Files
**To create**
- `apps/sophia-ai-factory/scripts/e2e/seed-magic-link.sh` — seed script
- `apps/sophia-ai-factory/scripts/e2e/cleanup-magic-link.sh` — used by Phase 06

**To read (do NOT modify)**
- `src/lib/handover/handover-types.ts` — verify column names
- `src/lib/handover/handover-magic-link.ts` — token format reference

## Implementation Steps
1. Read `handover-types.ts` to confirm `customer_handovers` schema (column names, NOT NULL constraints).
2. Read `handover-account-setup.ts` (or grep for INSERT INTO `user`) to copy the user upsert pattern Better Auth expects.
3. Write `seed-magic-link.sh`:
   - `EMAIL="e2e-test@sophia.local"`, `USER_ID="e2e-test-user-fixed-uuid"` (deterministic), `HANDOVER_ID="e2e-test-handover-fixed-uuid"`
   - SQL block 1: `INSERT OR REPLACE INTO user(id,email,name,emailVerified,createdAt,updatedAt) VALUES (...)`
   - SQL block 2: `INSERT OR REPLACE INTO customer_handovers(id, customer_user_id, agency_name, agency_type, tier, source, status, magic_link_token, magic_link_expires_at, created_at) VALUES (...)`
   - Token = `openssl rand -hex 32` (matches `generateToken()` shape: 64 hex chars)
   - Echo `https://sophia.agencyos.network/vi/welcome/$TOKEN`
4. Write `cleanup-magic-link.sh`: `DELETE FROM customer_handovers WHERE source='e2e_test'; DELETE FROM user WHERE email='e2e-test@sophia.local';`
5. Test seed → verify in D1 via `npx wrangler d1 execute sophia-raas-db --remote --command "SELECT magic_link_token FROM customer_handovers WHERE source='e2e_test'"`
6. Hand off output URL to Phase 02.

## Todo List
- [x] Confirm `customer_handovers` schema columns (migration 0064+0065; source CHECK constraint: manual|auto_payment|auto_signup)
- [x] Confirm `user` table required columns (Better Auth schema)
- [x] Write `seed-magic-link.sh`
- [x] Write `cleanup-magic-link.sh`
- [x] Dry-run seed script → token mints, URL printed
- [x] Verify row visible via wrangler d1 SELECT (has_token=1, expires_at set)

## Success Criteria
- Running `./scripts/e2e/seed-magic-link.sh` prints a valid magic-link URL
- `SELECT * FROM customer_handovers WHERE source='e2e_test'` returns exactly 1 row with non-null `magic_link_token` and `magic_link_expires_at > now`
- `validateMagicLinkToken(token)` would succeed (token shape matches `generateToken()` output)

## Risk Assessment
- **R1:** PROD D1 write fails due to wrangler auth → mitigation: pre-flight `wrangler whoami` check at top of script
- **R2:** `INSERT OR REPLACE` on `user` table may break Better Auth foreign keys (sessions table) → mitigation: use deterministic `USER_ID` so re-runs preserve identity; FK cascade not needed for this user
- **R3:** Test email leaks into transactional flows (welcome email send) → mitigation: `source='e2e_test'` filter + email domain `.sophia.local` is non-routable (no MX record)

## Security Considerations
- 1h TTL on token (vs 24h default) limits leakage window
- No real PII in test row (synthetic email, fixed UUID)
- Cleanup script in Phase 06 ensures no persistent test data in PROD

## Next Steps
- Hand off magic-link URL to Phase 02 via stdout capture
- Keep `wrangler tail` running for Phase 03 immediately after seed completes
