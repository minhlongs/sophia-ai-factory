---
phase: 02
title: "Fix TOCTOU race on email uniqueness via conditional UPDATE"
priority: P1/HIGH/SECURITY
status: complete
effort_estimate: 1.5h
effort_actual: ~30m
completed: 2026-05-10
dependencies: []
---

# Phase 02 — TOCTOU Email Uniqueness Fix

## Context Links

- W20 review finding #2: `plans/260510-0115-wave21-hardening-and-docs/reports/code-reviewer-wave20-2026-05-10.md` lines 33–37
- Affected files:
  - `src/app/api/account/change-email/route.ts:67-74` (POST uniqueness check)
  - `src/app/api/account/change-email/verify/route.ts:62-76` (verify check + UPDATE)

## Goal

Eliminate Time-Of-Check-To-Time-Of-Use race where two users requesting the same target email can both pass uniqueness checks and the verify-phase UPDATE silently overwrites. Replace with conditional UPDATE; if `meta.changes === 0`, return conflict error to user.

## Key Insights

1. **Better Auth `user` table is plain D1** — no native `UNIQUE(email)` constraint enforced (verified via current schema: `LOWER(email)` index exists for lookup but no unique guarantee).
2. **D1 supports `WHERE NOT EXISTS` subquery in UPDATE** — confirmed via SQLite docs (D1 = SQLite + edge).
3. **Race window is small (~ms)** but real on launch with sequential-click users; reviewer flags as launch-blocker alongside #1.
4. **Sessions unaffected** — Better Auth sessions reference `user.id`, not email; UPDATE email does not invalidate sessions.

## Architecture

```
BEFORE:
  POST /change-email   → SELECT WHERE email=newEmail (check empty) → INSERT verification
  GET  /change-email/verify → SELECT WHERE email=newEmail AND id!=user (check empty)
                            → UPDATE user SET email=newEmail WHERE id=user
  RACE: between SELECT and UPDATE, another user may UPDATE first.

AFTER:
  POST   /change-email → unchanged (advisory check, fast-fail UX)
  VERIFY /change-email/verify → conditional UPDATE:
    UPDATE user
    SET email = ?, updatedAt = ?
    WHERE id = ?
      AND NOT EXISTS (SELECT 1 FROM user WHERE LOWER(email) = ? AND id != ?)
    --> check meta.changes
    if changes === 0 → race lost or stale → redirect ?error=email-change-conflict
    if changes === 1 → success → redirect ?ok=email-changed
```

## Files to Create

None. Logic-only fix.

## Files to Modify

| File | Change |
|---|---|
| `src/app/api/account/change-email/verify/route.ts` | Replace separate SELECT-then-UPDATE with single conditional UPDATE; check `result.meta.changes`; return `email-change-conflict` redirect on 0-changes |
| `src/app/api/account/change-email/__tests__/change-email-verify.test.ts` (create if missing) | +3 tests: happy path, race lost (concurrent UPDATE), self-update no-op |

## Implementation Steps

1. **Read current** `verify/route.ts` lines 62–76 — understand SELECT + UPDATE shape.
2. **Replace verify SQL** with conditional UPDATE:
   ```ts
   const result = await db
     .prepare(
       `UPDATE user
        SET email = ?, updatedAt = ?
        WHERE id = ?
          AND NOT EXISTS (
            SELECT 1 FROM user WHERE LOWER(email) = ? AND id != ?
          )`,
     )
     .bind(newEmail, nowIso, userId, newEmail.toLowerCase(), userId)
     .run();

   const changes = result.meta?.changes ?? 0;
   if (changes === 0) {
     // Race lost OR concurrent UPDATE OR user no longer exists
     await db.prepare(`DELETE FROM verification WHERE id = ?`).bind(row.id).run();
     return failureRedirect('email-change-conflict');
   }
   ```
3. **Remove the now-redundant SELECT** at lines 62–70 (one round-trip saved).
4. **Keep token validation** above the UPDATE — token must be valid before we even try the UPDATE.
5. **Add tests** in `__tests__/change-email-verify.test.ts`:
   - Happy: token valid + email unused → UPDATE 1 row → 302 ok=email-changed
   - Race: pre-seed another user with target email → UPDATE 0 rows → 302 error=email-change-conflict + verification row deleted
   - Stale userId: token valid but user.id was deleted → UPDATE 0 rows → 302 error=email-change-conflict
6. **Run** `npm run build && npm test`.

## Migration

None.

## i18n Keys

Optional: confirm `email-change-conflict` already supported in dashboard error toast (it should be, per W20 P04 work). If missing:
- `messages/en.json`: `dashboard.account.errors.email_change_conflict`: "Email already in use. Please request a different one."
- `messages/vi.json`: same key, VI translation.

Verify by `grep email-change-conflict messages/`.

## Test Strategy

| Test | Type | Expected |
|---|---|---|
| Happy path UPDATE | integration | meta.changes === 1, redirect ok=email-changed |
| Concurrent claim (other user took email) | integration | meta.changes === 0, redirect error=email-change-conflict, verification row deleted |
| Stale userId (user gone) | integration | meta.changes === 0, redirect error=email-change-conflict |

Target: +3 new tests.

## Success Criteria

- [ ] Verify route uses single conditional UPDATE (no separate SELECT)
- [ ] `meta.changes === 0` correctly drives error redirect
- [ ] Verification row deleted on conflict (no token re-use)
- [ ] All tests pass + 3 new
- [ ] Deploy SHA match
- [ ] i18n parity test passes

## Risk Assessment

- **R1: Better Auth uses different email path** — verify Better Auth doesn't read email through ORM that bypasses our UPDATE. Check: `grep -rn "\.email" src/seed/auth/` — should only be read paths.
- **R2: Existing test relies on SELECT being separate** — search `change-email/verify` test file; if any test stubs both queries, update to single query.
- **R3: D1 `NOT EXISTS` perf** — sub-select on `LOWER(email)` index. Already indexed (used in step 1). Acceptable.

## Security Considerations

- Eliminates last documented launch-blocker race in account flows.
- Combined with Phase 01 (token hash), change-email flow is hardened end-to-end.
- No new attack surface.

## Verification Steps

```bash
cd apps/sophia-ai-factory
npm run build               # 0 TS errors
npm test                    # all pass + 3 new
npm run deploy:full
LOCAL_SHA=$(git rev-parse HEAD | cut -c1-8)
LIVE_SHA=$(curl -s https://sophia.agencyos.network/api/version | grep -o '"shortSha":"[^"]*"' | cut -d'"' -f4)
[ "$LOCAL_SHA" = "$LIVE_SHA" ] && echo "✅ SHA match"

# Optional manual race smoke (staging only):
# 1. Issue email-change for User A → email B
# 2. Manually UPDATE user SET email='B' WHERE id='other'
# 3. Click User A confirmation link → should redirect ?error=email-change-conflict
```

## Next Steps

- After P01 + P02 deployed → both launch-blockers cleared.
- No deps blocked by this phase.
