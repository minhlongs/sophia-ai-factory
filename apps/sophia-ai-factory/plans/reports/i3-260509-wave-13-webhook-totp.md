# Phase Implementation Report — Wave 13 G-I3

### Executed Phase
- Phase: Wave 13 Group I3 — Webhook verifier migration + TOTP lazy encrypt
- Plan: Wave 13 parallel plan
- Status: completed

### Files Modified

| File | Change |
|---|---|
| `src/lib/sop/webhook-hmac.ts` | Replaced inline HMAC with `signWebhook`/`verifyWebhook`; removed 70 lines of duplicated crypto |
| `src/lib/alerts/webhook-notification-signature.ts` | Replaced Node `crypto` with `signWebhook`/`verifyWebhook`; `generateWebhookSignature` now async → returns `t=<ts>,v1=<hex>` unified header |
| `src/lib/alerts/webhook-notification-service.ts` | Added `await` on `generateWebhookSignature` call (async migration) |
| `src/seed/security/webhook-validator.ts` | Replaced inline HMAC with `signWebhook`/`verifyWebhook`; both functions now async |
| `src/app/api/analytics/agencyos-sync/route.ts` | `verifyAgencyOSAuth` → `async`, added `await` on `verifyWebhookSignature` call |
| `src/seed/auth/mfa/totp-service.ts` | Added `verifyTotpWithLazyEncrypt()`, `MfaSecretsEncRow`, `LazyEncryptDb` interfaces (+60 lines) |
| `src/seed/auth/mfa/totp-service.test.ts` | Added 3 lazy-encrypt test cases (cases 9/10/11); imported `vi` |

### Tasks Completed

- [x] Migrate `src/lib/sop/webhook-hmac.ts` → `verifyWebhook` with `acceptLegacy: true`
- [x] Migrate `src/lib/alerts/webhook-notification-signature.ts` → `verifyWebhook` with unified header reconstruction for split-header legacy callers
- [x] Migrate `src/seed/security/webhook-validator.ts` → `verifyWebhook` with `acceptLegacy: true`
- [x] Fix callers of migrated async functions (`webhook-notification-service.ts`, `agencyos-sync/route.ts`)
- [x] TOTP `verifyTotpWithLazyEncrypt()` added to `totp-service.ts`
- [x] Setup path already encrypts before INSERT (verified in `mfa/setup/route.ts` line 32 — `encryptToken(secret)`)
- [x] Unit tests: case 9 (encrypted secret), case 10 (plaintext + DB backfill), case 11 (bad code, no DB write)
- [x] Canary webhook doc written: `plans/reports/canary-webhook-260509.md` (105 lines)
- [x] Phase summary report written

### Tests Status
- Type check: pass (0 errors)
- Unit tests: 2901 passed (293 files, 1 skipped) — 7 net new tests above prior baseline
- New TOTP lazy-encrypt tests: 3/3 pass

### Issues Encountered

1. `webhook-validator.ts` `verifyWebhookSignature` had a bug in the original: it signed over `${timestamp}.${sig}` (the already-extracted hex) instead of `${timestamp}.${body}`. Fixed by routing through `verifyWebhook` which uses the correct signed payload.

2. `generateWebhookSignature` in both `webhook-notification-signature.ts` and `webhook-validator.ts` was synchronous. Made async (Web Crypto API). Required updating 2 callers.

3. `webhook-validator.ts` split-header path (`v1=<hex>` + timestamp string, no body) cannot fully verify because the body is unknown at that layer. The reconstructed unified header passes body as `''`. Added code comment: callers using split-header must migrate to pass full body via `verifyWebhook` directly.

### Next Steps
- 2026-05-23: Remove `acceptLegacy: true` from all 3 verifier files
- 2026-06-06: Remove legacy bare-hex branch from `src/lib/webhooks/signature.ts`
- Challenge route (`src/app/api/auth/mfa/challenge/route.ts`) + verify route can optionally adopt `verifyTotpWithLazyEncrypt()` for automatic DB backfill — not modified this wave (outside file ownership)

### Unresolved Questions
- Alert notifications still send split headers (`X-Signature` + `X-Timestamp`). Receivers need to migrate to reading the full unified `X-Signature: t=<ts>,v1=<hex>` format. Outbound is fixed; inbound receiver migration is external.
