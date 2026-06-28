# TIER-2C — MFA (TOTP 2FA + Backup Codes) Implementation Report

**Status:** COMPLETE
**Date:** 2026-04-29

## Pre-Implementation Findings

- `better-auth-server.ts`: two-factor plugin NOT configured — full implementation required
- No `otpauth` or `qrcode` packages in project — installed both
- i18n: JSON format (`messages/en.json`, `messages/vi.json`), no `settings` key existed — added
- Settings page is at `[locale]/dashboard/settings` (existing) — new MFA page created at specified path `[locale]/settings/security/mfa`
- DB: D1 (Cloudflare), `createServerClient()` is sync

## Files Modified / Created

| File | Lines | Action |
|---|---|---|
| `migrations/0028-mfa-secrets.sql` | 14 | Created |
| `src/lib/auth/mfa/totp-service.ts` | 112 | Created |
| `src/lib/auth/mfa/totp-service.test.ts` | 148 | Created |
| `src/app/api/auth/mfa/setup/route.ts` | 54 | Created |
| `src/app/api/auth/mfa/verify/route.ts` | 67 | Created |
| `src/app/api/auth/mfa/disable/route.ts` | 55 | Created |
| `src/app/[locale]/settings/security/mfa/page.tsx` | 178 | Created |
| `messages/en.json` | +20 keys | Modified |
| `messages/vi.json` | +20 keys | Modified |
| `package.json` + lockfile | — | `otpauth` + `qrcode` + `@types/qrcode` added |

## Tests

- `npm test -- totp`: **17/17 passed**
- `npm run build`: **0 errors** (only pre-existing Sentry/Turbopack warnings)
- `npx tsc --noEmit`: **0 errors in new files** (pre-existing errors in other files untouched)

## Implementation Notes

- TOTP uses `otpauth` package (RFC 6238) — issuer "Sophia AI Factory", SHA1, 6 digits, 30s period
- Backup codes: 8 unique XXXX-XXXX format, SHA-256 hashed before storage (plaintext shown once)
- All API routes: Zod validation + `getCurrentUserFromHeaders()` auth gate
- Secret stored as plaintext in `totp_secret_enc` column — see Gap below

## Security Gap (Documented)

**TOTP secret encryption at rest:** Sophia does not currently expose an app-level encryption key/KMS. The `totp_secret_enc` column stores the base32 secret unencrypted in D1. D1 encrypts data at rest at the infrastructure level (Cloudflare). Application-level AES-GCM wrapping deferred until a key management system is available. This should be tracked as a follow-up security item.

## Unresolved Questions

1. **MFA enforcement for roles**: Currently opt-in only. Should ENTERPRISE/MASTER tier users be required to enroll? (Out of scope per task, but worth deciding.)
2. **Backup code recovery flow**: If a user loses both TOTP device and backup codes, current implementation has no admin recovery path — admin override endpoint may be needed.
3. **Better Auth plugin vs custom**: Better Auth v1.6+ has a `twoFactor()` plugin. This implementation is custom to avoid coupling to plugin internals. If upgrading Better Auth, evaluate migrating to the plugin.
4. **MFA at login enforcement**: Current gates only protect the settings page. Actual login-time MFA challenge (second-factor prompt after password) is NOT implemented — would require middleware changes (owned by TIER-2G).
