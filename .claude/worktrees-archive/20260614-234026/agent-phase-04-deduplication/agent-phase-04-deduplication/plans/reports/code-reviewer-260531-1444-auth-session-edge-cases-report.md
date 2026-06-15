# Auth & Session Edge-Case Review — Sophia AI Factory

## Scope
Files: 6 | Focus: auth/session security

## Edge-Case Results

### 1. API key auth timing attack — SHA-256 hash vs DB lookup
**Status: Partially mitigated**

`api-key-auth.ts:93` computes `sha256(rawKey)` then does `.eq('key_hash', keyHash).single()` — DB index lookup on hash. This is NOT constant-time string comparison, but since it's a DB equality filter (index seek), the timing signal leaks to the DB engine internals, not the application layer. An attacker cannot observe DB query timing from an HTTP response.

The `timingSafeEqual` function exists in `crypto-utils.ts:120` but is **NOT used** here — it's only available for re-export via `tree/audit/crypto-utils`.

**Risk:** Low. DB index lookups don't expose timing to remote callers. The hash comparison is against stored hashes, not raw secrets.

---

### 2. Empty Bearer token ("Bearer " with space, no key)
**Status: Unhandled — info leak**

`api-key-auth.ts:62-63`: `authHeader?.startsWith('Bearer ')` is true for `"Bearer "`, then `substring(7).trim()` → `""` (empty string). Falls through to `!rawKey` check at line 70 → session fallback.

If no session exists, returns `{ errorType: 'missing_credentials' }` — 401. This is consistent behavior.

**However:** The response message says "Invalid API key" vs "Missing API key" — for `"Bearer "` it returns `missing_credentials` (different message). This timing difference could theoretically distinguish between "no credentials sent" and "empty key sent" — minor info leak.

**Risk:** Low. Both paths return 401. The error message difference is observable but low-signal.

---

### 3. API key reuse after revocation — same hash, different user
**Status: Vulnerable**

`raas_api_keys` schema (migration 0001:116): `key_hash TEXT UNIQUE NOT NULL`. This enforces uniqueness at the DB level.

BUT: If user A revokes their key (sets `is_active = 0` or deletes row) and user B is issued a new key that happens to hash to the same value, the DB UNIQUE constraint on `key_hash` would **prevent** the insert — the second key generation must produce a different hash.

The real risk: **What if `is_active` is the only revocation mechanism?** Looking at `api-key-auth.ts:111-118`: a row with `is_active = 0` still matches the hash lookup and returns 403. The row is never deleted or invalidated. If the `is_active` flag is set incorrectly (e.g., during a failed update), a revoked key could remain valid.

Additionally, `expires_at` column exists in the schema (line 122) but is **never checked** in `validateMissionApiKey()`. Expired keys would still authenticate.

**Risk: Medium.** Expired keys bypass expiration check. Revocation depends solely on `is_active` flag integrity.

---

### 4. MFA check only on sensitive prefixes (/api/account, /api/checkout, /api/admin)
**Status: Intentional but incomplete coverage**

`middleware.ts:85-87`: MFA gate applies only to:
- `/api/account`
- `/api/checkout`
- `/api/admin`

Routes like `/api/missions`, `/api/campaigns`, `/api/factory` bypass MFA entirely. This appears intentional — MFA is enforced for:
1. Financial operations (checkout, account changes)
2. Admin operations

**Gap:** No MFA enforcement on `/api/billing`, `/api/payouts`, `/api/affiliates`, or `/api/user/byok` — these handle financial/credential data but are outside the sensitive prefix list.

**Risk:** Low-Medium. Intentional design, but BYOK routes (which store API keys for external services) could benefit from MFA enforcement.

---

### 5. getCurrentUser() in API key fallback — expired session behavior
**Status: Handled — returns null**

`better-auth-session.ts:47-49`: `getCurrentUser()` calls `getSession()` which calls `auth.api.getSession()`. If session is expired:
- Better Auth's `getSession()` returns `null` (session cookie invalid/expired)
- `getSession()` catches DB errors and returns `null` (line 39)
- `getCurrentUser()` returns `null` at line 49

Back in `api-key-auth.ts:71-75`: `if (user)` → returns `{ valid: true }`. If `null` → falls through to `missing_credentials`.

**One caveat:** `getCurrentUserFromHeaders()` (line 68-99) throws `AuthSystemError` on DB failures — this is the correct pattern for distinguishing "no session" (null → 401) from "system down" (503). But `getCurrentUser()` swallows all errors and returns null — callers cannot distinguish expired session from DB outage.

**Risk:** Low. Expired sessions correctly return null. Error swallowing is a minor observability gap.

---

## Summary

| # | Edge Case | Status | Severity |
|---|-----------|--------|----------|
| 1 | Timing attack on hash comparison | Mitigated (DB index) | Low |
| 2 | Empty Bearer token info leak | Unhandled | Low |
| 3 | Key reuse after revocation + expired keys not checked | Vulnerable | Medium |
| 4 | MFA prefix gap (billing/payouts/byok) | Partial | Low-Medium |
| 5 | Expired session → null (correct) | Handled | Low |

## Key Findings

- **#3 is the most actionable**: `expires_at` column exists but is never validated. Add `if (data.expires_at && new Date(data.expires_at) < new Date())` check before returning valid.
- **#2**: Return identical error messages for all 401 cases to eliminate timing side-channel.
- **#4**: Consider adding `/api/user/byok` to MFA-sensitive prefixes (stores external API keys).

## Unresolved Questions
- Is `is_active = 0` the only revocation mechanism, or are rows also deleted?
- Does `raas_user_api_keys` (migration 0076) have the same `expires_at` gap?
- Are there other routes beyond `/api/account|checkout|admin` that should require MFA?
