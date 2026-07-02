# E3/E4 Enterprise Hardening Closure -- BYOK Rotation Shipped, OTel Blocked

**Date**: 2026-07-02 18:13
**Severity**: Medium
**Component**: BYOK key management + OpenTelemetry + Audit logging
**Status**: Partially resolved (commit `bf223a01f`, pushed to main)

---

## What Happened

Closed enterprise hardening roadmap items E3 (OpenTelemetry) and E4 (BYOK Key Rotation). E4 landed fully -- admin UI, auto-rotation cron, and a critical audit log fix. E3 is blocked by a missing Honeycomb API key secret that wasn't part of this session's scope. 6709 tests pass, build exits 0, SHA pushed to GitHub.

---

## The Brutal Truth

The real story here is the silent audit log failure that existed for months. Migration 0210 revealed that the `raas_audit_logs` table had a `CHECK` constraint on `action` that rejected any value outside a hardcoded whitelist. Every `key_rotation.*` event we tried to persist was silently swallowed by D1 -- no error, no warning, just a row that never appeared. The constraint was a well-intentioned guard against garbage data that instead became a garbage-in-nothing-out sink. We rebuilt the table without the constraint and now filter at the application layer with Zod instead.

The other frustration: BYOK encryption is now ~95% solid -- zero hardcoded keys, dual encryption paths, proper key_version rotation -- but Phase 1 (OTel production) sits unfinished because nobody has set the `HONEYCOMB_API_KEY` secret. The deploy doctrine says no operator tokens for third parties, but observability is infrastructure, not customer-facing. This needs an explicit decision.

---

## Technical Details

### E4 -- BYOK Key Rotation (Phase 2 + 3, DONE)

| Component | What | Files |
|-----------|------|-------|
| Rotation UI | `/dashboard/admin/byok-rotation` page with MASTER tier gate | `src/land/admin/byok-rotation/` |
| RotationButton | Confirm dialog + `POST /api/admin/keys/rotate` + toast | Server Action + client component |
| VersionTable | `key_versions` history from D1, active version highlighted | Read-only query |
| StatusLog | Rotation audit events displayed chronologically | Reads `raas_audit_logs` |
| Admin sidebar link | nav item pointing to rotation page | Sidebar config |
| Auto-rotation cron | Inngest `keyRotationCron`, fires every 90 days (`0 0 1 */3 *`) | `src/forest/inngest/functions/` |
| Cron logic | Checks `key_versions.created_at`: skip if <90d, trigger rotation if >=90d | 4 unit tests covering all 4 paths |

### Migration 0210 -- Audit CHECK constraint fix (CRITICAL)

The `raas_audit_logs` table had:
```sql
CHECK (action IN ('user.login', 'user.logout', 'campaign.create', ...))
```

This silently rejected `key_rotation.*` events. D1 does not report CHECK constraint violations as errors visible in the application -- the INSERT succeeds (no exception) but the row is discarded. Migration 0210 rebuilt the table without the constraint. Application-layer validation via Zod now handles action filtering.

### E3 -- OpenTelemetry (Phase 1, BLOCKED)

| Item | Status | Reason |
|------|--------|--------|
| OTel SDK installed | DONE | Dependencies in `package.json` |
| Instrumentation setup | DONE | Hooks registered in Next.js config |
| `HONEYCOMB_API_KEY` env | BLOCKED | Secret not set in CF Workers env |
| Verification deploy | BLOCKED | Depends on Phase 1 |

### BYOK Architecture Analysis (brainstorm/ask output)

- ~95% complete: user-side CRUD, admin rotation, crypto layer all operational
- Zero hardcoded API keys -- only BYOK_MASTER_KEY env var exists
- Dual encryption paths (`user_api_keys` + `user_provider_credentials`) share `key_versions` table
- Remaining 5%: OTel verification + production deploy

### Quality gates

- `npm test`: 6709 passed, 0 failed
- `npm run build`: 0 TS errors
- Files changed: 15+ new/modified across `tree/byok/`, `forest/inngest/`, `land/admin/`, `migrations/`

---

## What We Tried

For the audit CHECK constraint: the initial approach was to ALTER the existing constraint, but D1 (SQLite-based) does not support `ALTER TABLE ... DROP CHECK`. The only option was `CREATE TABLE new ... INSERT INTO new ... DROP TABLE old ... RENAME TABLE new`, which is exactly what migration 0210 does. Learned this the hard way when the first migration attempt failed with a syntax error.

---

## Root Cause Analysis

Two systemic issues:

1. **D1's silent CHECK constraint failure.** SQLite (and by extension D1) discards rows that violate CHECK constraints without raising an error that propagates to the application. The INSERT appears to succeed. This meant `key_rotation.*` audit events were being silently dropped for months without any monitoring signal. The fix (drop the constraint, validate at the app layer) is correct, but the fact that this went undetected means we have no guard against similar silent failures in other D1 tables.

2. **BYOK key rotation lacked a trigger mechanism.** Before this session, keys could be created and used but never rotated -- the `key_versions` table tracked version history but nothing ever incremented the version. The admin rotation UI and auto-cron fill this gap, but the 90-day cron interval is a guess. There's no alerting if rotation fails.

3. **OTel blocked by an env var that nobody owns.** The HONEYCOMB_API_KEY needs to be set in the Cloudflare Workers dashboard. This is one of those tasks that falls between "infrastructure" and "development" and nobody picks it up.

---

## Lessons Learned

- **NEVER trust D1 CHECK constraints for critical data integrity.** They fail silently. Application-layer validation (Zod) or triggers with explicit error logging are the only reliable approach for Cloudflare D1.
- **A rotation cron without a rotation test is a paper exercise.** The 4 unit tests cover the scheduling logic, but there's no E2E test that rotates a live key and confirms old ciphertext can still be decrypted with the new version. The key re-wrap path (decrypt with old key, re-encrypt with new key_version) needs an integration test after deploy.
- **Observability secrets need an owner.** If the deploy doctrine prohibits operator-side third-party tokens, OTel needs an exception or alternative -- or it remains permanently blocked. This should have been resolved before E3 was scoped.
- **When a migration drops a constraint, validate the replacement coverage.** Migration 0210 replaces the CHECK with Zod validation. Verify that the Zod schema covers every action the application actually writes.

---

## Next Steps

1. **Set HONEYCOMB_API_KEY in CF Workers env.** Owner: platform/infrastructure. Blocks Phase 1 verification and the entire E3 closure. Timeline: before next deploy.
2. **Write key rotation E2E test** that creates a key, rotates it, and verifies old data decrypts with the new key_version. This is the remaining 5% of BYOK hardening. Owner: engineering.
3. **Audit all other D1 tables for silent CHECK constraints** that might silently drop valid rows. Grep for `CHECK (` in `migrations/*.sql`. Owner: engineering. Timeline: next hardening session.
4. **Add rotation failure alert.** If `keyRotationCron` fires but the rotation API returns an error, emit a structured log event that surfaces in the admin dashboard. Currently the cron returns a 500 but nobody is watching.
5. **Document the D1 CHECK constraint behavior** in the project database docs so future migrations don't repeat this trap. Owner: docs.
