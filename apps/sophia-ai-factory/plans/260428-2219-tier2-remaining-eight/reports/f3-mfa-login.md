# F3 — MFA Login Challenge Enforcement

## Status: COMPLETE

## Files Created / Modified

| File | Action | LOC |
|------|--------|-----|
| `migrations/0029-mfa-pending-sessions.sql` | created | 11 |
| `src/lib/auth/mfa/login-challenge.ts` | created | 97 |
| `src/app/api/auth/mfa/challenge/route.ts` | created | 82 |
| `src/app/[locale]/auth/mfa-challenge/page.tsx` | created | 139 |
| `src/lib/auth/mfa/login-challenge.test.ts` | created | 128 |
| `src/lib/better-auth-server.ts` | modified | +14 lines |
| `src/middleware.ts` | modified | +20 lines |
| `messages/vi.json` | modified | +10 keys |
| `messages/en.json` | modified | +10 keys |

## Architecture

```
Password Login (Better Auth)
  → databaseHooks.session.create.after
    → requireMfaIfEnabled(userId)  -- check mfa_secrets.totp_enabled
    → markSessionMfaPending(sessionId)  -- insert mfa_pending_sessions row (10-min TTL)
  → client redirects to /dashboard
    → Middleware intercepts /dashboard
      → isSessionMfaPending(sessionId)  -- DB lookup
      → if pending → redirect to /auth/mfa-challenge
  → User submits TOTP/backup code
    → POST /api/auth/mfa/challenge
      → verifyTotp() or verifyBackupCode()
      → clearSessionMfaPending(sessionId)
      → {ok: true} → client redirects to /dashboard
```

## Tasks Completed

- [x] Migration 0029 — mfa_pending_sessions table + index
- [x] login-challenge.ts — requireMfaIfEnabled, markSessionMfaPending, clearSessionMfaPending, isSessionMfaPending
- [x] challenge/route.ts — POST endpoint, TOTP + backup code paths, Zod validation
- [x] mfa-challenge/page.tsx — UI with TOTP + backup toggle, i18n
- [x] middleware.ts — MFA pending check on /dashboard, preserves CSRF/CSP/intl
- [x] better-auth-server.ts — session.create.after hook
- [x] i18n — vi.json + en.json, 10 keys each
- [x] login-challenge.test.ts — 7 unit tests
- [x] Migration applied to remote D1 (sophia-raas-db)

## Test Results

- Type check: PASS (0 errors)
- Unit tests: 1680 passed, 31 skipped (baseline ≥1673 — exceeded)
- Migration: Applied — 2 queries, 4 rows written

## Protected Flows (verified not broken)

- Setup Wizard: no changes to wizard paths
- Telegram Bot: webhook path not gated
- NOWPayments IPN: /api/webhooks/* not in MFA gate
- CSRF middleware: preserved unchanged
- CSP nonce: preserved unchanged
- intl detection: preserved unchanged

## Unresolved Questions

1. **Magic link sessions**: Currently magic-link-created sessions also trigger the MFA
   pending hook. If a user logs in via magic link and has TOTP enabled, they will also
   be challenged. This may be intentional — verify with product owner.
2. **OAuth users**: `session.create.after` fires for all session types including OAuth
   (TikTok, YouTube). Those users currently won't have mfa_secrets rows, so
   `requireMfaIfEnabled` returns `required=false` — they pass through. This is correct
   per task scope but worth documenting.
3. **TTL cleanup**: Expired `mfa_pending_sessions` rows are NOT automatically purged.
   A nightly cron `DELETE WHERE expires_at < unixepoch()` should be added eventually.
