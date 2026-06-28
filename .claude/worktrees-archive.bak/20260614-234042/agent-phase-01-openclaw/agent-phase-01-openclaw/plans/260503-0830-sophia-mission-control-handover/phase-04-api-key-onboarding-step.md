# Phase 04 — API Key Issuance + Rotate UI (Onboarding Wire-Up)

## Context Links
- `apps/sophia-ai-factory/src/lib/security/api-key-validator-db.ts` — `generateApiKey`, `revokeApiKey`, `getUserApiKeys` (existing)
- `apps/sophia-ai-factory/src/lib/security/api-key-validator-crypto.ts` — sha256 hashing, format validation (existing)
- `apps/sophia-ai-factory/src/components/raas/api-key-list.tsx` — existing UI
- `apps/sophia-ai-factory/src/components/raas/api-key-create-modal.tsx` — existing modal
- `apps/sophia-ai-factory/src/db/migrations/20260308-create-raas-api-keys.sql` — Postgres schema (Supabase legacy)

## Overview
- **Priority:** P1
- **Status:** pending
- **Effort:** 30m

Validator + UI exist but Postgres-only. Need D1 migration for `raas_api_keys` (or rename to `api_keys`) + thin Next.js route the onboarding step calls. Existing dashboard `/dashboard/api-keys` already uses these components — both surfaces share endpoints.

## Key Insights
- Postgres migration `20260308-create-raas-api-keys.sql` references `auth.users(id)` (Supabase) — must port to D1 schema referencing `user.id` (Better Auth)
- Crypto: keys are `sk_live_<keyId>_<signature>` where `keyId` is 16-char public id and stored DB col is sha256(signature)
- Tier-based rate limit: BASIC=100/min, PREMIUM=500/min, ENTERPRISE/MASTER=2000/min — wire from tier lookup

## Requirements
- D1 table `raas_api_keys` with same shape as Postgres but TEXT ids and INTEGER timestamps
- `POST /api/v1/api-keys/create` — issue, returns full key once + masked prefix forever
- `POST /api/v1/api-keys/[id]/rotate` — revoke old + issue new
- `POST /api/v1/api-keys/[id]/revoke` — soft-delete via `revoked_at`
- `GET /api/v1/api-keys` — list user's keys (no full key, only prefix + metadata)
- All endpoints require Better Auth session, return zod-validated payloads
- Rate limit per tier enforced via existing rate-limit middleware

## Architecture
```
D1 table raas_api_keys
  id TEXT PK (uuid)
  key_id TEXT UNIQUE (16-char public)
  key_hash TEXT (sha256, 64-char)
  owner_id TEXT FK user.id
  name TEXT
  permissions TEXT (JSON array)
  rate_limit_per_min INTEGER
  created_at INTEGER, expires_at INTEGER, revoked_at INTEGER, last_used_at INTEGER
  
Routes:
/api/v1/api-keys              GET  → list
                              POST → create
/api/v1/api-keys/[id]/rotate  POST → rotate
/api/v1/api-keys/[id]         DELETE → revoke
```

## Related Files
**Create:**
- `migrations/0067-d1-api-keys.sql` — D1 schema
- `src/app/api/v1/api-keys/route.ts` — GET + POST
- `src/app/api/v1/api-keys/[id]/route.ts` — DELETE
- `src/app/api/v1/api-keys/[id]/rotate/route.ts` — POST
- `src/lib/security/api-key-validator-db-d1.ts` — D1 adapter (mirrors Postgres impl)

**Modify:**
- `src/lib/security/api-key-validator.ts` — switch backend to D1 adapter (env-flag for migration)
- `src/components/raas/api-key-create-modal.tsx` — point to `/api/v1/api-keys` (verify current path)
- `src/components/raas/api-key-list.tsx` — same

## Implementation Steps
1. Migration 0067 (TEXT ids, INTEGER timestamps for D1):
   ```sql
   CREATE TABLE raas_api_keys (
     id TEXT PRIMARY KEY, key_id TEXT NOT NULL UNIQUE,
     key_hash TEXT NOT NULL, owner_id TEXT NOT NULL,
     name TEXT NOT NULL, permissions TEXT NOT NULL DEFAULT '[]',
     rate_limit_per_min INTEGER NOT NULL DEFAULT 100,
     created_at INTEGER NOT NULL, expires_at INTEGER,
     revoked_at INTEGER, last_used_at INTEGER,
     FOREIGN KEY (owner_id) REFERENCES user(id) ON DELETE CASCADE
   );
   CREATE INDEX idx_api_keys_key_id ON raas_api_keys(key_id);
   CREATE INDEX idx_api_keys_owner ON raas_api_keys(owner_id);
   CREATE INDEX idx_api_keys_active ON raas_api_keys(owner_id, key_id) 
     WHERE revoked_at IS NULL;
   ```
2. Port `api-key-validator-db.ts` Postgres queries to D1 prepared statements in `api-key-validator-db-d1.ts`
3. POST `/api/v1/api-keys`: zod `{name: string.min(1).max(64), permissions?: string[]}`, lookup user tier, call `generateApiKey(userId, name, tierToRateLimit(tier))`, return `{keyId, fullKey, prefix, createdAt}`
4. GET `/api/v1/api-keys`: return `[{id, keyId, name, prefix, createdAt, lastUsedAt, revokedAt}]` — never return key_hash or full key
5. DELETE: zod path param, set `revoked_at = now`, return 204
6. Rotate: tx — revoke old, generate new, return new key once
7. Front-end: confirm `api-key-list.tsx` + `api-key-create-modal.tsx` paths align

## Todo
- [ ] Migration 0067 applied
- [ ] D1 adapter implemented + unit tests (sha256 hash/verify roundtrip)
- [ ] 4 routes (create, list, rotate, revoke) with zod
- [ ] Rate-limit-per-tier mapping
- [ ] Dashboard UI smoke-tests pass
- [ ] Onboarding step 2 successfully creates key

## Success Criteria
- New user issues key → returned once → reload page → only prefix visible
- Plain-text key never stored in DB (verify via `wrangler d1 execute "SELECT * FROM raas_api_keys LIMIT 1"`)
- Rotate: old key returns 401 on next call, new key works
- Revoke: 401 on subsequent calls
- Rate limits scale with tier

## Risk Assessment
- **Existing Postgres data**: production may have rows in Supabase — write one-off migration script `scripts/migrate-api-keys-to-d1.ts` if needed
- **Backend switch flag**: gate via `API_KEY_BACKEND=d1|postgres` env to allow rollback during transition

## Security Considerations
- **HASH-AT-REST mandatory** — sha256(signature), never plaintext
- Constant-time compare (`crypto.subtle.timingSafeEqual` polyfill or `crypto.timingSafeEqual` in Workers)
- Key prefix (`sk_live_<keyId>`) safe to display; signature half NEVER stored or returned after creation
- Audit log on create/rotate/revoke (use existing `writeAuditLog`)

## Next
Phase 05 builds the dashboard widget that surfaces the keys + tier + quota in one composite mission-control card.
