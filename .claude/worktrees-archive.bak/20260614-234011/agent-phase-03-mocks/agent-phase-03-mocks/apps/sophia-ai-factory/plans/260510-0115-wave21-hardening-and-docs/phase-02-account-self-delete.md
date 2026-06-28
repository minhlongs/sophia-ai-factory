---
phase: 02
title: "Account self-delete with double-confirm + 7-day cooldown"
priority: P1
status: complete
effort_actual: ~1h
deploy_sha: b7f20a26
completed: 2026-05-10
---

# Phase 02 — Account Self-Delete + 7-Day Cooldown

## Goal

Replace immediate `DELETE /api/account` with safer 2-stage flow + 7-day cooldown. Prevent accidental destruction.

## Architecture

```
User: types "DELETE" → click button
   ↓
POST /api/account/delete/request (action: 'request')
   ↓ creates row + sends email
Email link → GET /api/account/delete/confirm?token&userId
   ↓ validate token → set confirmed_at → scheduled_at = now+7d
[7-day cooldown begins]
   ↓ user can cancel any time:
POST /api/account/delete/request (action: 'cancel')
   ↓ OR after scheduled_at elapsed:
DELETE /api/account (with X-Confirm-Delete header)
   ↓ checks cooldown row → cascade delete tenant data
```

## Files Created

| File | Purpose |
|---|---|
| `migrations/0102-account-deletion-cooldown.sql` | Table + 2 indexes |
| `src/app/api/account/delete/request/route.ts` | POST stage 1 + cancel |
| `src/app/api/account/delete/request/email-template.ts` | Bilingual EN+VI |
| `src/app/api/account/delete/confirm/route.ts` | GET stage 2 (email link) |
| `src/app/api/account/delete/status/route.ts` | GET current state |
| `src/app/api/account/delete/__tests__/account-delete.test.ts` | 14 unit tests |
| `src/app/[locale]/dashboard/account/account-danger-zone.tsx` | UI Danger Zone |

## Files Modified

| File | Change |
|---|---|
| `src/app/api/account/route.ts` | DELETE now returns 412 unless cooldown elapsed (or admin override) |
| `src/app/api/account/__tests__/gdpr-account.test.ts` | +3 cooldown gate tests, all updated for new behavior |
| `src/app/[locale]/dashboard/account/account-profile-tab.tsx` | Mount `<AccountDangerZone />` |
| `messages/en.json` + `messages/vi.json` | +12 keys each (danger_section, delete_*, status_*) |

## Key Design Choices

1. **Reuse existing DELETE endpoint** — gated by cooldown, not duplicated. Maintains backwards compat.
2. **Admin override** — `X-Override-Cooldown: I_KNOW_WHAT_IM_DOING` + `ALLOW_COOLDOWN_OVERRIDE=1` env. Lets ops emergency-delete without 7d wait.
3. **Token plaintext storage** — same pattern as Wave 20 P04 change-email. Phase 03 review flagged this; consistent fix in Wave 22 sweep.
4. **No Inngest cron** — actual delete happens on-demand when user re-confirms after 7d. Avoids cron complexity. Wave 22 may add automated finalize.
5. **Confirmation page** — redirects to `/account?ok=delete-confirmed` (or `?error=*` variants). Reuses `searchParams` reading pattern from change-email.

## Verification

- ✅ npm test: 3146/3146 pass (+17 new tests)
- ✅ npm run build: exit 0
- ✅ Migration applied to remote D1 (5 rows changed: 1 table + 2 indexes)
- ✅ Deploy: `b7f20a26` SHA match
- ✅ /api/account/delete/status → 401 (auth wall)
- ✅ /api/account/delete/request → 405 (POST-only)
- ✅ /api/account/delete/confirm → 307 (redirect with error when missing params)

## Success Criteria

- [x] Migration creates table + indexes idempotently
- [x] Request → email → confirm → cooldown flow tested
- [x] Cancel works during cooldown
- [x] DELETE blocked when no confirmed cooldown
- [x] DELETE allowed when cooldown elapsed
- [x] Admin override works with env flag
- [x] UI prevents typo deletion (must type DELETE literal)
- [x] Bilingual EN + VI

## Wave 22 Backlog (carried forward from Phase 03 review + this phase)

1. **HIGH/SECURITY**: Hash both change-email AND delete tokens (sha256) — sweep Wave 22.
2. **MEDIUM**: Inngest cron job to auto-finalize delete after cooldown elapses without requiring user re-action.
3. **LOW**: Email Templates — extract shared `<bilingual-cta-email>` component, both flows reuse.
