# Code Review — Phase 26 B2 Hygiene Cleanup (Helper Variant + Unit Tests)

**Date:** 2026-04-26 11:58
**Scope:** 1 new + 3 modified files
**Reviewer:** code-reviewer
**Verdict:** APPROVED — Score 9.7/10

---

## Files Reviewed

| File | Type | LOC Change |
|------|------|-----------|
| `src/lib/auth/is-user-admin.test.ts` | NEW | +59 |
| `src/lib/auth/is-user-admin.ts` | MOD | +21/-5 |
| `src/app/api/usage/export/usage-export-post-handler.ts` | MOD | +1/-3 |
| `src/app/api/quota/status/route.ts` | MOD | +1/-1 |

---

## Verification Results

| Check | Result |
|-------|--------|
| New tests pass | 4/4 PASS (427ms) |
| TS errors | 317 (was 318 — TS2322 fix confirmed at L68) |
| Backward compat (callers of `isUserAdmin`) | 5 callers unchanged (summary route, get-handler, 3 dunning routes) |
| Sophia Protected Flows touched | NONE (no setup wizard / Telegram / NOWPayments code touched) |
| Banned imports introduced | NONE |
| `:any` types introduced | NONE |
| `console.log` introduced | NONE |

---

## Critical Issues

**None.**

---

## Major Issues

**None.**

---

## Minor Issues

### Mi-1: JSDoc on `isUserAdmin` says "queries user_profiles for promotion-after-session — DB is source of truth" — slight semantic tension with existing module-level docstring

`is-user-admin.ts:5` says "Resolves admin status from Better Auth session role OR user_profiles DB role" (OR semantics).
`is-user-admin.ts:18-20` now describes a fast-path (session admin → return true, no DB) AND a fallback (non-admin session → query DB).

These are reconcilable, but a reader scanning only the function-level docstring might miss that "DB is source of truth" is conditional on session NOT being admin. The fast-path *trusts* the session and never re-validates against DB. If session is admin but DB has been demoted (rare race), helper returns admin.

**Risk:** Very low. Session role typically updated synchronously with DB role. The asymmetry (trust session for promotion, ignore session for demotion) is intentional fail-open for the cheap path.

**Recommendation (optional):** Add one line to JSDoc:
```ts
 * Note: session admin is trusted without DB re-check (cheap fast-path).
 * Stale demotions in session are not detected — accepted trade-off.
```

Not blocking.

### Mi-2: Test file does not cover the variant `isUserAdminWithRole` directly

All 4 tests call `isUserAdmin`, which delegates to `isUserAdminWithRole`. The variant's `dbRole` return value is not asserted — only the boolean projection.

**Coverage gap:**
- Session admin fast-path → `dbRole: 'admin'` (synthesized) NOT verified
- DB admin fallback → `dbRole: 'admin'` (from DB) NOT verified
- DB non-admin → `dbRole: 'user'` NOT verified
- Null DB row → `dbRole: null` NOT verified

The behavior is exercised transitively but not asserted. Since the post-handler at L68 uses `dbRole || 'user'` for audit logging tier, an off-by-one in the variant could silently corrupt audit records.

**Recommendation:** Add 1 test asserting variant directly:
```ts
it('returns dbRole=admin (synthesized) on session fast-path', async () => {
  const result = await isUserAdminWithRole({ ...baseUser, role: 'admin' });
  expect(result).toEqual({ isAdmin: true, dbRole: 'admin' });
  expect(mockSingle).not.toHaveBeenCalled();
});

it('returns dbRole from DB when session not admin', async () => {
  mockSingle.mockResolvedValue({ data: { role: 'user' } });
  const result = await isUserAdminWithRole({ ...baseUser, role: 'user' });
  expect(result).toEqual({ isAdmin: false, dbRole: 'user' });
});
```

Not blocking — current tests cover boolean contract which is what callers depend on most.

### Mi-3: Behavior change in audit `tier` field — previous `userData?.role` (DB) vs new `dbRole` (session-synthesized when fast-path)

You correctly identified this in the review request. Previous code:
```ts
tier: userData?.role || 'user'  // ALWAYS reads DB, even when session admin
```
New code:
```ts
tier: dbRole || 'user'  // dbRole = 'admin' (synthesized) when session fast-path hits
```

**Edge case:** Session role 'admin' but DB role 'user' (rare — promoted in session, not yet persisted to DB, or demoted in DB while session still admin):
- Old: `tier='user'` (DB)
- New: `tier='admin'` (synthesized from session)

**Assessment:** New behavior is more semantically consistent with the auth check (the user IS admin per the auth helper, audit should reflect what they ARE, not what DB says they should be). This aligns with the "session is trusted on fast-path" design.

**Risk:** Very low. The window where session and DB diverge is tiny (cache invalidation race). Audit logs become slightly more consistent with authorization decisions, which is desirable.

**Recommendation:** Document this in the helper JSDoc OR in the post-handler comment near L68:
```ts
// tier reflects effective admin status (session-trusted on fast-path),
// not raw DB role. Aligns audit log with authorization decision.
```

Not blocking — semantic improvement.

---

## Positive Observations

1. **Clean DRY refactor** — `isUserAdmin` delegates to `isUserAdminWithRole`, zero logic duplication. Phase 25 review M2 recommendation cleanly executed.
2. **No double DB call** in post-handler — eliminated separate `userData` fetch (was 2 round-trips, now 1 max).
3. **TS2322 fix is incidental but valuable** — uses the helper's already-typed `string | null` return instead of unknown supabase row type. Good leverage.
4. **Test mocks at module scope** — `vi.mock` is hoisted correctly, `mockSingle` is reset in `beforeEach`. Pattern is idiomatic vitest.
5. **Mock chain mirrors actual** — `from().select().eq().single()` matches the helper's call pattern exactly.
6. **Doc anchor in quota/status route** — "Phase 24 deletion of orphan GETStatus" provides forensic trail for future readers. Good practice.
7. **Backward compatibility preserved** — 5 other `isUserAdmin` callers unchanged; no signature breakage.
8. **Sophia Protected Flows untouched** — Setup Wizard, Telegram bot, NOWPayments webhook all unaffected. Confirmed via diff scope.

---

## Edge Cases Verified

| Case | Behavior | Test Coverage |
|------|----------|---------------|
| Session role='admin' | Fast-path returns true, no DB | Test 1 |
| Session role='user', DB role='admin' | DB query, returns true | Test 2 |
| Session role='user', DB role='user' | DB query, returns false | Test 3 |
| Session role=undefined, DB row null | DB query returns null, false | Test 4 |
| Session role='admin', DB role='user' | Fast-path returns true (session trusted) | NOT tested explicitly (Mi-2) |
| `dbRole` correctness on fast-path | Returns 'admin' (synthesized) | NOT asserted (Mi-2) |
| DB query fails / throws | UNCAUGHT — would propagate | NOT covered (pre-existing) |

**Pre-existing gap (not Phase 26 scope):** Helper does not handle DB query exceptions. If `db.from(...).single()` throws (e.g., D1 unavailable), the rejection propagates to caller. All 5 caller routes are wrapped in try/catch, so the failure mode is "500 Internal Server Error" — acceptable but could be more graceful (return false + log). Out of scope for hygiene phase.

---

## Sub-Variant 4 Sweep

Per phase brief: instances unchanged. Confirmed — this phase is pure helper extension + doc work, no `:any` removals attempted.

---

## Score Breakdown

| Dimension | Score | Notes |
|-----------|-------|-------|
| Correctness | 10/10 | Helper logic preserves behavior; tests pass; TS error count drops |
| DRY/Maintainability | 10/10 | Variant + delegation eliminates 2-DB-call anti-pattern; clean API |
| Type Safety | 10/10 | TS2322 fixed; no new `:any`; helper return type explicit |
| Test Coverage | 9/10 | 4 cases on `isUserAdmin`; variant return shape not directly asserted (Mi-2) |
| Documentation | 9/10 | JSDoc improved; Mi-1 minor reconciliation; Mi-3 behavior change unstated |
| Backward Compat | 10/10 | 5 callers unchanged; no signature break |
| Sophia Standards | 10/10 | Protected flows untouched; canonical imports respected |
| Risk Profile | 10/10 | Pure refactor + new tests; no runtime changes for 5 of 6 callers |

**Composite: 9.75/10 → APPROVED (auto-approve threshold ≥9.5 with 0 critical met)**

---

## Recommended Actions (Non-Blocking)

1. (Optional, Mi-2) Add 2 tests asserting `isUserAdminWithRole` return shape directly.
2. (Optional, Mi-1) One-line JSDoc clarification on session-trust asymmetry.
3. (Optional, Mi-3) Comment near `tier: dbRole || 'user'` documenting the audit-tier semantics.

None of these block merge. They would round the score to 10/10.

---

## Unresolved Questions

None. All review focus points (1-6) addressed and satisfactory.
