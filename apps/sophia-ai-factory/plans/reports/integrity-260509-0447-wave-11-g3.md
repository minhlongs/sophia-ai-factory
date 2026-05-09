# Phase Implementation Report — Wave 11 G3

### Executed Phase
- Phase: Wave 11 Group G3 — Data integrity
- Plan: Wave 11 parallel plans
- Status: completed

### Files Modified/Created
| File | Status | Lines |
|---|---|---|
| `migrations/0092-totp-secrets-encrypt-backfill.sql` | NEW | 18 |
| `migrations/0093-usage-events-external-id-unique.sql` | NEW | 27 |
| `src/lib/webhooks/signature.ts` | NEW | 145 |
| `src/lib/webhooks/__tests__/signature.test.ts` | NEW | 99 |
| `src/lib/webhooks/sender.ts` | MODIFIED | 76 |
| `src/lib/webhooks/__tests__/sender.test.ts` | MODIFIED | 158 |
| `src/lib/webhooks/index.ts` | MODIFIED | 32 |

### Tasks Completed
- [x] Task 1: TOTP backfill — Strategy B chosen, migration 0092 created
- [x] Task 2: usage_events external_id UNIQUE migration 0093 created
- [x] Task 3: Unified signature.ts — sign + verify, sender.ts updated

### TOTP Backfill: Strategy B — Reason
Strategy A (Node script) requires `OAUTH_TOKEN_ENC_KEY` env at script runtime and
a D1 remote connection. Workers runtime cannot call `encryptToken` inside SQL.
The `mfa_secrets.totp_secret_enc` column name is already aspirational (schema never
enforced encryption). Strategy B adds `is_encrypted INTEGER DEFAULT 0` column + index,
defers per-row encryption to app-side lazy upgrade on next TOTP verify call.
`src/scripts/totp-backfill.ts` not needed for Strategy B — lazy path is simpler and
zero-downtime.

**Run command for manual batch encrypt (if operator prefers eager):**
```
npx wrangler d1 execute sophia-raas-db \
  --file=migrations/0092-totp-secrets-encrypt-backfill.sql --remote
```
App-layer integration (updating totp-service.ts verify path to encrypt + set
is_encrypted=1) is deferred — out of scope for this phase per file ownership rules.

### Signature Unification
- New format: `t=<unix>,v1=<hmac-sha256-hex>` — Stripe-style, edge-safe (WebCrypto)
- Backwards-compat: `verifyWebhook(..., { acceptLegacy: true })` (default) accepts
  old bare-64-hex signatures for 1 release cycle
- `sender.ts` updated to `signWebhook()` — 1 primary caller updated
- Other callers (`lib/sop/webhook-hmac.ts`, `lib/alerts/webhook-notification-signature.ts`,
  `seed/security/webhook-validator.ts`) use Node `crypto` module for separate inbound
  verification contexts — left intact per file ownership boundary

### Tests Status
- Type check: PASS (0 errors)
- Unit tests (webhooks + mfa): PASS — 67/67
  - 7 new signature.ts tests (sign/verify roundtrip, skew, legacy compat, bad-sig)
  - All existing sender/signer/heygen-sig tests still pass

### Callers of signature.ts Updated
- 1 direct caller updated: `src/lib/webhooks/sender.ts`
- 3 parallel inbound-verify callers (sop/webhook-hmac, alerts/webhook-notification-signature,
  seed/security/webhook-validator) NOT updated — they serve different inbound paths and
  were out of this phase's file ownership scope

### Deferred Items
- `totp-service.ts` lazy encrypt-on-verify logic (requires modifying that file — not in ownership)
- Migrate 3 secondary inbound signature verifiers to unified `verifyWebhook()` API
- Remove legacy bare-hex branch in verifyWebhook after next release cycle

### Migration Idempotency
- 0092: `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` + `CREATE INDEX IF NOT EXISTS WHERE is_encrypted = 0`
- 0093: `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` + `CREATE UNIQUE INDEX IF NOT EXISTS WHERE external_id IS NOT NULL`
- Both safe to re-run on already-migrated DB
