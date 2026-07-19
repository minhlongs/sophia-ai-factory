---
phase: 01
title: "Hash email confirmation tokens (sha256) — change-email + delete"
priority: P1/HIGH/SECURITY
status: complete
effort_estimate: 2h
effort_actual: ~50m
completed: 2026-05-10
migration: 0104-account-deletion-token-hash-column.sql
dependencies: []
---

# Phase 01 — Hash Email Confirmation Tokens (sha256)

## Context Links

- W20 review finding #1: `plans/260510-0115-wave21-hardening-and-docs/reports/code-reviewer-wave20-2026-05-10.md` lines 26–31
- Affected flows:
  - Change-email: `src/app/api/account/change-email/route.ts`, `verify/route.ts`
  - Account-delete: `src/app/api/account/delete/request/route.ts`, `confirm/route.ts`
- Storage tables: `verification` (Better Auth), `account_deletion_requests`

## Goal

Replace plaintext token storage with sha256(token) hash in DB; raw token is sent in email URL only and never persisted. Eliminates DB-dump attack vector flagged as public-launch blocker.

## Key Insights

1. **Web Crypto available** in Cloudflare Workers runtime via `crypto.subtle.digest('SHA-256', ...)` — no need for Node `crypto`.
2. **Token comparison must be constant-time** — use byte-by-byte equal helper, not `===` on hex string (acceptable risk but recommended).
3. **Tokens are random UUIDs (128 bits)** — sha256 input space already collision-resistant; no salt needed (vs. password hashing).
4. **Backward-compat window:** During deploy, in-flight emails contain old plaintext token format. Verify path must accept both for 1h TTL window (existing rows expire naturally).

## Architecture

```
BEFORE (Wave 20/21):
  Issue:   token = randomUUID() → store {value: "newEmail:" + token}    OR  store {confirmation_token: token}
  Verify:  read row → split/eq compare token === storedToken

AFTER (Wave 22):
  Issue:   token = randomUUID()
           hash = sha256Hex(token)                  ← stored in DB
           emailUrl = `...?token=${token}`          ← raw in URL only
           store {value: "newEmail:" + hash}    OR  store {confirmation_token_hash: hash}
  Verify:  read row → hash incoming token → constant-time-compare against stored hash
           If row has legacy plaintext (column populated, hash NULL) → accept once, then migrate
```

## Files to Create

| File | Purpose |
|---|---|
| `src/seed/security/token-hash.ts` | `sha256Hex(input: string): Promise<string>` + `safeCompareHex(a, b): boolean` |
| `src/seed/security/__tests__/token-hash.test.ts` | Unit tests for hash determinism + constant-time compare |
| `migrations/0103-account-deletion-token-hash-column.sql` | Adds `confirmation_token_hash` column to `account_deletion_requests` |

## Files to Modify

| File | Change |
|---|---|
| `src/app/api/account/change-email/route.ts` | Compute `sha256Hex(token)`; store as `value = newEmail + ':' + hash` instead of raw token |
| `src/app/api/account/change-email/verify/route.ts` | Hash incoming `token` from URL; compare against stored hash; legacy fallback if `value` looks like UUID (no hash semantics) for 1h window |
| `src/app/api/account/delete/request/route.ts` | Insert hash into new `confirmation_token_hash` column; null out `confirmation_token` on new rows |
| `src/app/api/account/delete/confirm/route.ts` | Hash incoming token; compare against `confirmation_token_hash` column (fallback to legacy column if hash null) |
| `src/app/api/account/delete/__tests__/account-delete.test.ts` | Update token assertions: row should contain hash not raw; verify with raw token still works |
| `src/app/api/account/change-email/__tests__/*.test.ts` (if exists) | Same dual-shape coverage |

## Migration

```sql
-- migrations/0103-account-deletion-token-hash-column.sql
-- Wave 22 Phase 01 — Add hash column for token storage
-- Old `confirmation_token` column kept temporarily for backward-compat read path
-- (drop in Wave 23 after 1h TTL window of existing rows expires).

ALTER TABLE account_deletion_requests
  ADD COLUMN confirmation_token_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_acct_del_token_hash
  ON account_deletion_requests(confirmation_token_hash)
  WHERE confirmation_token_hash IS NOT NULL;
```

For `verification` table (Better Auth managed): the `value` column already stores `newEmail:<token>`. We replace `<token>` portion with `sha256Hex(token)` — no schema change needed, just write-side change. Verify path detects shape: if `<token>` is 64-char lowercase hex → treat as hash; if 36-char with dashes → legacy plaintext.

## Implementation Steps

1. **Seed util** — Write `src/seed/security/token-hash.ts`:
   ```ts
   export async function sha256Hex(input: string): Promise<string> {
     const buf = new TextEncoder().encode(input);
     const digest = await crypto.subtle.digest('SHA-256', buf);
     return Array.from(new Uint8Array(digest))
       .map(b => b.toString(16).padStart(2, '0'))
       .join('');
   }

   export function safeCompareHex(a: string, b: string): boolean {
     if (a.length !== b.length) return false;
     let diff = 0;
     for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
     return diff === 0;
   }
   ```
2. **Unit tests** — Determinism (same input → same hash), shape (64-char hex), `safeCompareHex` true/false cases including length mismatch.
3. **Apply migration** locally + remote via `bash scripts/apply-migrations.sh`.
4. **Update `change-email/route.ts`** — Replace `value = ${newEmail}:${token}` with `value = ${newEmail}:${await sha256Hex(token)}`.
5. **Update `change-email/verify/route.ts`** — Hash `token` param, then compare with `safeCompareHex(hashed, storedToken)`. Add legacy detector: if `storedToken` length === 36 (UUID) → compare raw (one-window fallback) and log `legacy_token_format=1`.
6. **Update `delete/request/route.ts`** — Compute `hash`; INSERT with `confirmation_token_hash = ?` and `confirmation_token = NULL`.
7. **Update `delete/confirm/route.ts`** — Read both `confirmation_token` (legacy) and `confirmation_token_hash`. If hash present → compare hash; else → compare raw (legacy fallback). Log on legacy hit.
8. **Update tests** — Assert no plaintext UUID in DB after request creation; verify path still works end-to-end.
9. **Run** `npm run build && npm test`.

## i18n Keys

None. Internal storage change only — user-facing strings unchanged.

## Test Strategy

| Test | File | Type |
|---|---|---|
| `sha256Hex` deterministic | `seed/security/__tests__/token-hash.test.ts` | unit |
| `safeCompareHex` true/false | same | unit |
| change-email POST stores hash, not raw | `change-email/__tests__/*` | integration (D1 in-memory) |
| change-email verify hashes incoming + matches | same | integration |
| change-email verify accepts legacy UUID once | same | integration |
| delete request stores hash in new column, null in legacy column | `account-delete.test.ts` | integration |
| delete confirm hashes incoming + matches | same | integration |
| delete confirm legacy fallback (hash NULL) works | same | integration |

Target: +8 new tests, all 3146+ existing pass.

## Success Criteria

- [ ] No plaintext token stored in DB after deploy (verify via D1 query)
- [ ] Existing in-flight emails (issued pre-deploy) still verify within 1h TTL
- [ ] All tests pass; +8 new
- [ ] Deploy SHA matches commit
- [ ] Manual smoke: trigger change-email → row in `verification` shows 64-char hex after `:` (not UUID)
- [ ] Manual smoke: trigger account-delete → row shows `confirmation_token_hash` populated, `confirmation_token` NULL

## Risk Assessment

- **R1: Legacy fallback bypass** — attacker could submit any 36-char UUID and get raw-equality compare. Mitigation: legacy fallback only fires when `storedToken.length === 36` (only true for pre-deploy rows, all expire within 1h). Log every legacy hit; alert if any after 24h.
- **R2: Cloudflare Workers timing** — `crypto.subtle` is async, adds ~1ms per request. Acceptable.
- **R3: Migration column ALTER on remote D1** — D1 supports `ADD COLUMN` without table rewrite. Verified.

## Security Considerations

- Hash function: sha256 (sufficient for 128-bit random tokens).
- No salt: tokens are already cryptographically random; rainbow table attack moot.
- No pepper: sha256 of UUIDv4 has full entropy.
- Constant-time compare: enabled via `safeCompareHex`.

## Verification Steps

```bash
cd apps/sophia-ai-factory
npm run build               # 0 TS errors
npm test                    # all pass + 8 new
bash scripts/apply-migrations.sh
npm run deploy:full
LOCAL_SHA=$(git rev-parse HEAD | cut -c1-8)
LIVE_SHA=$(curl -s https://sophia.agencyos.network/api/version | grep -o '"shortSha":"[^"]*"' | cut -d'"' -f4)
[ "$LOCAL_SHA" = "$LIVE_SHA" ] && echo "✅ SHA match"

# Smoke: confirm hash format in DB after request
npx wrangler d1 execute sophia-raas-db --remote \
  --command "SELECT substr(value, instr(value, ':')+1, 8) AS prefix, length(value) - instr(value, ':') AS hashlen FROM verification WHERE identifier LIKE 'email-change:%' ORDER BY createdAt DESC LIMIT 1"
# Expect: hashlen = 64 (sha256 hex), prefix = 8-char hex
```

## Next Steps

- Phase 07 depends on this (shared email component reuses unified token shape).
- Wave 23: drop legacy `confirmation_token` column from `account_deletion_requests` after 7-day cooldown rows from pre-deploy expire.
