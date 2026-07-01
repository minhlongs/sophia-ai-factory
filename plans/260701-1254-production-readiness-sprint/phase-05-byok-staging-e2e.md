# Phase 05 — BYOK Rotation Staging E2E Verification

**Priority:** P0 | **Effort:** 1h | **Status:** pending | **Depends on:** Phase 04

## Overview

Verify BYOK key rotation end-to-end in staging environment. Test the admin API with real D1, confirm Inngest re-encryption runs, and verify audit log chain.

## Prerequisites

- [ ] Phase 04 integration tests pass
- [ ] Staging environment accessible
- [ ] At least one test user with API keys in staging
- [ ] Admin credentials for staging

## Implementation Steps

### 1. Check staging DB state (~10 min)

```bash
# Query current key versions
npx wrangler d1 execute sophia-raas-db --remote --command="SELECT * FROM key_versions ORDER BY version DESC"

# Check credential counts by version
npx wrangler d1 execute sophia-raas-db --remote --command="SELECT key_version, COUNT(*) FROM user_api_keys GROUP BY key_version"
```

### 2. Trigger rotation via admin API (~15 min)

```bash
# Using curl with admin auth
curl -X POST https://sophia.agencyos.network/api/admin/keys/rotate \
  -H "Content-Type: application/json" \
  -H "Cookie: <admin-session-cookie>" \
  -H "x-csrf-token: <csrf-token>" \
  -d '{"reason": "Staging E2E rotation test"}'
```

Expected response:
```json
{
  "success": true,
  "keyVersion": <N>,
  "oldVersion": <N-1>,
  "dualDecryptWindowMs": 604800000,
  "message": "Key rotation queued. Re-encryption will run asynchronously."
}
```

### 3. Verify Inngest re-encryption (~15 min)

Wait 1-2 minutes for Inngest to pick up the event, then verify:

```bash
# Check credential re-encryption
npx wrangler d1 execute sophia-raas-db --remote --command="SELECT key_version, COUNT(*) FROM user_api_keys GROUP BY key_version"
# All credentials should now have new key_version

# Check old version retired
npx wrangler d1 execute sophia-raas-db --remote --command="SELECT version, is_active, rotated_at FROM key_versions WHERE version = <oldVersion>"
# is_active should be 0, rotated_at should be set

# Check new version active
npx wrangler d1 execute sophia-raas-db --remote --command="SELECT version, is_active FROM key_versions WHERE version = <newVersion>"
# is_active should be 1
```

### 4. Verify audit log entries (~10 min)

```bash
# Check audit log for rotation events
npx wrangler d1 execute sophia-raas-db --remote --command="SELECT * FROM audit_events WHERE action LIKE 'key_rotation.%' ORDER BY created_at DESC LIMIT 10"
```

Expected entries:
- `key_rotation.requested` — admin user, version info
- `key_rotation.reencrypt_start` — system, version info
- `key_rotation.reencrypt_complete` — system, total re-encrypted count

### 5. Verify dual-decrypt window (~10 min)

After rotation, verify keys encrypted with old version still decrypt (dual-decrypt window):

```bash
# Try to use an API key that was encrypted with old version
# This should work during the 7-day dual-decrypt window
curl -X POST https://sophia.agencyos.network/api/campaigns \
  -H "Authorization: Bearer <test-api-key>" \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
# Should return 200 (key decrypts with either old or new version)
```

## Success Criteria

- [ ] Rotation API returns 200 with new key version
- [ ] Inngest re-encrypts all credentials to new version
- [ ] Old key version retired (is_active=0, rotated_at set)
- [ ] Audit log entries recorded (requested + start + complete)
- [ ] Dual-decrypt window works (old credentials still valid)
- [ ] No production errors or regressions
