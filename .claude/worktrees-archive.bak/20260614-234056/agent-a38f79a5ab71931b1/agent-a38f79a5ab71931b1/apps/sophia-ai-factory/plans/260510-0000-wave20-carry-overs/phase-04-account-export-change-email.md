# Phase 04 — Account Self-Service: Export + Change-Email (7B)

## Context Links

- Wave 19 Phase 07 carry-over (7B). Delete flow deferred to Wave 21 (legal/audit).
- Existing: `GET /api/account/export` already returns tenant-scoped JSON. No UI button → users can't trigger it.
- Email flow needs custom build — Better Auth in Sophia ships only `magicLink` + `emailAndPassword` plugins (no `changeEmail` plugin loaded).

## Overview

- **Priority:** P1
- **Effort:** 4h
- **Status:** ⏳ IN PROGRESS
- **Description:** Add Export Data + Change Email actions in Profile tab. Export = one-click download. Email change = double-opt-in via verification email sent to NEW address.

## Key Insights

- Better Auth's `verification` table is already in remote D1 — reuse for email-change tokens (identifier prefix `email-change:`). Avoids new migration.
- `user.email` is the Better Auth canonical column. Update there directly via D1 client.
- `sendEmail()` from `@/forest/email/sender` (Resend) already used by magic-link template.
- Profile tab currently shows email as readOnly — convert to editable + Change Email button.
- Token bytes: `crypto.randomUUID()` is good enough; we keep tokens short-lived (1h).

## Requirements

### Functional
- F1. **Export**: profile tab gets "Export Data" button → fetch `/api/account/export` → trigger browser download as `account-export-<userId>.json`.
- F2. **Change Email Step 1**: profile tab email field becomes editable. On change + click "Update Email", POST `/api/account/change-email { newEmail }`.
- F3. **Change Email Step 2**: server validates email format, generates token, stores in `verification` table, sends email to NEW address with `https://sophia.agencyos.network/api/account/change-email/verify?token=<>`.
- F4. **Change Email Step 3**: GET verify route looks up token, updates `user.email`, deletes verification row, redirects to `/dashboard/account?ok=email-changed`.
- F5. Bilingual i18n for new UI labels + email subject/body.

### Non-Functional
- NF1. Tokens expire 1h. Reject expired/missing tokens with 400.
- NF2. Reject change-email if newEmail equals current email (400).
- NF3. Reject change-email if newEmail already in use (`SELECT FROM user WHERE email=?` returns row → 409).
- NF4. No `:any`. Zod-validate body.

## Architecture

```
src/app/api/account/change-email/route.ts            (NEW — POST, generates token + sends email)
src/app/api/account/change-email/verify/route.ts     (NEW — GET, applies email change)

src/app/[locale]/dashboard/account/account-profile-tab.tsx  (MODIFY — editable email + 2 buttons)

messages/{en,vi}.json                                 (MODIFY — new keys)
```

## Implementation Steps

1. Build POST `/api/account/change-email`:
   - Auth required (getCurrentUser)
   - Zod validate `{ newEmail }`
   - Reject if same as current email
   - Reject if newEmail already in `user` table
   - Generate token = randomUUID()
   - Insert into `verification` (identifier=`email-change:<userId>`, value=`<newEmail>:<token>`, expiresAt=ISO+1h)
   - sendEmail to newEmail with bilingual template containing `verify?token=<token>&userId=<userId>` link
   - Return 200 `{ ok: true }`
2. Build GET `/api/account/change-email/verify`:
   - Parse `token` + `userId` from query
   - Fetch verification row by identifier
   - If not found / expired → 400
   - Parse `value` = `<newEmail>:<token>`. Validate token match.
   - UPDATE `user` set email=newEmail where id=userId
   - DELETE verification row
   - Redirect to `/dashboard/account?ok=email-changed`
3. Update `account-profile-tab.tsx`:
   - Email Input becomes editable (controlled state separate from save form)
   - Two new buttons: "Export Data" (fetch + download) + "Update Email" (POST + toast)
   - Banner if `?ok=email-changed` in URL
4. i18n keys: `account.export_btn`, `account.export_pending`, `account.email_change_btn`, `account.email_change_pending`, `account.email_change_sent`, `account.email_change_invalid`, `account.email_changed_success`
5. Email template: bilingual EN/VI body, "Verify new email" CTA.
6. Tests: API route handlers (happy + error branches).
7. Build + tests + deploy.

## Todo List

- [ ] POST change-email route + Zod schema + tests
- [ ] GET verify route + tests
- [ ] Profile tab UI (editable email, 2 buttons, success banner)
- [ ] i18n EN + VI keys
- [ ] Email template helper
- [ ] `npm test` passes
- [ ] `npm run build` passes
- [ ] Commit + CF deploy + SHA verify

## Success Criteria

- [ ] User clicks Export Data → JSON file downloads
- [ ] User submits new email → email arrives at NEW address
- [ ] User clicks verify link → redirected to account page with success banner; subsequent logins use new email
- [ ] Token invalid/expired → 400 with helpful message
- [ ] New email already taken → 409

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Race condition: 2 users claim same email simultaneously | L | M | UNIQUE index on `user.email` (Better Auth default) — second UPDATE fails |
| Verification email lands in spam | M | L | Already on Resend infra (warm domain); doc note in i18n if user complaints |
| Token leaked in browser history (in URL) | L | M | One-time-use; deletes immediately; 1h expiry — acceptable risk for v1 |
| Account hijack via email change | L | H | Auth required to initiate; verify link goes to NEW address only — no password reset |

## Security Considerations

- Verify link sent to NEW email confirms ownership.
- Auth required to start flow (existing session validated via getCurrentUser).
- Rate limit: rely on `withRateLimit` wrapper if added later (Wave 21).

## Next Steps

- Wave 20 wrap-up: Phase 02 (Telegram step split) deferred. All other phases shipped.
