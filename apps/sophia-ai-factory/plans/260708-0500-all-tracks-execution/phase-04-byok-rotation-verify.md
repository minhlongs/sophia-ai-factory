# Phase 4: BYOK Rotation Verification
> Status: pending | Priority: P1 | Parallel with Phase 5

## Context
BYOK infrastructure complete (migration, crypto, Inngest job, admin API). Dual-crypto implementations need consolidation. Master key secrets not confirmed set.

## Requirements
1. Consolidate dual-crypto: `byok-crypto.ts` (binary, 7d) → merge into `credential-crypto.ts` (text, 24h)
2. Verify `BYOK_MASTER_KEY` / `CREDENTIALS_MASTER_KEY` set via `wrangler secret put`
3. Add `platform_configs` table to re-encrypt job scope
4. End-to-end staging test: cron → event → batch re-encrypt → old key retired

## Architecture
- **Crypto consolidation:** Replace binary format with text format (UTF-8 JSON envelope)
- **Re-encrypt job:** Inngest function batches credentials, wraps with new key, marks old as retired
- **Secret management:** All master keys via `wrangler secret put` — never in .env files
- **Backward compat:** Old binary blobs readable during migration grace period

## Files to Modify
| File | Change |
|------|--------|
| `src/tree/byok/byok-crypto.ts` | Deprecate, delegate to `credential-crypto.ts` after migration |
| `src/tree/byok/credential-crypto.ts` | Add binary-compat decode path, becomes single crypto impl |
| `src/forest/inngest/functions/re-encrypt-credentials.ts` | Add platform_configs table, full batch processing |
| `migrations/` | New migration: platform_configs BYOK columns if missing |

## Implementation Steps
1. Audit current dual-crypto: map all callers of `byok-crypto.ts` vs `credential-crypto.ts`
2. Add binary-compat decode to `credential-crypto.ts` (read old format, write new)
3. Update re-encrypt job: iterate ALL credential tables (not just user_api_keys)
4. Staging test: set test master key, run re-encrypt, verify decryption with new key
5. Verify secrets: `wrangler secret list` → confirm `BYOK_MASTER_KEY` present
6. Document rotation procedure in `docs/`

## Out of Scope
- Key rotation schedule changes (keep current 90-day window)
- Adding new encryption algorithms
- Production key rotation (staging verification only this phase)
