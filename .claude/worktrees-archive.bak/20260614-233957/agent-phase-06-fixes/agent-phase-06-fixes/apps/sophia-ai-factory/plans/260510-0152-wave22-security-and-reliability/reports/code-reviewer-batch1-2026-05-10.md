# Wave 22 Batch 1 — Code Review

**Date:** 2026-05-10
**Reviewer:** code-reviewer (CC CLI)
**Scope:** P02 (TOCTOU email), P03 (URL fallback throw), P04 (D1 index), P08 (CEO smoke SOP)
**Tests:** 3149/3149 pass · Build: 0 errors

---

## Verdict

| Phase | Verdict | Notes |
|---|---|---|
| **P02 — TOCTOU email uniqueness** | **APPROVED** | Conditional UPDATE is semantically tight; tests cover both failure modes. |
| **P03 — URL fallback throw + try/catch** | **APPROVED** | Throw paths correctly return 502 with rollback intact. |
| **P04 — Composite index `(provider, status)`** | **WATCH** | Correct, idempotent, but column-order rationale is debatable for SQLite leftmost-prefix; see finding M2. |
| **P08 — CEO smoke SOP** | **APPROVED** | Bilingual, no leaked secrets, accurate endpoints. |

**Overall:** SHIP NOW. No blockers. One MED finding on P04 column order (non-blocking, future tuning).

---

## Findings

### P02 — TOCTOU email uniqueness fix

**HIGH-severity correctness verified.** The conditional UPDATE replaces the SELECT-then-UPDATE race window cleanly.

- ✅ **SQL semantics:** `UPDATE … WHERE id = ? AND NOT EXISTS (SELECT 1 FROM user WHERE LOWER(email) = ? AND id != ?)` is atomic in SQLite/D1 (single statement, single transaction). No window between the existence check and the write — the planner evaluates the subquery while holding the row lock.
- ✅ **Self-update safe:** `id != ?` excludes the row we're updating, so updating to a casing variant of the user's own current email cannot collide with itself.
- ✅ **0-changes path:** When subquery returns a row → outer UPDATE matches 0 rows → `meta.changes === 0`. Code correctly: deletes verification row + redirects `?error=email-change-conflict`. Verification row deletion prevents replay attacks via the same token.
- ✅ **Tests:** Both "race lost" and "stale userId" exercise the `meta.changes === 0` branch with the same outcome — same 3-stmt sequence (SELECT verification, UPDATE user, DELETE verification).

**LOW — L1 (P02):** The `newEmail` from `row.value.slice(0, sepIndex)` is not re-validated as a non-empty email at verify time. If the verification row was somehow corrupted (`:tok-x` with empty prefix), the UPDATE would set `email = ''`. Consider a defensive `if (!newEmail) return failureRedirect('email-change-invalid')` after the slice. Risk is minimal because the POST endpoint validates via Zod and only the server writes the row, but defense-in-depth is cheap.

**LOW — L2 (P02):** The case-insensitive uniqueness check uses `LOWER(email) = ?` in the subquery. If the `user` table has a citext-style index (case-insensitive), this is fine. If not, the subquery does a full table scan via `LOWER()` per row. For a multi-tenant scaling concern, consider an `idx_user_email_lower` covering index later. Out of scope for this batch.

---

### P03 — URL fallback throw + try/catch wrap

**Correctness + UX both improved.** Throwing instead of falling back to `#` correctly surfaces config errors as 502 instead of silently emailing broken links.

- ✅ **Throw inside template helper:** `buildChangeEmailHtml` (route.ts:118) and `buildDeleteConfirmHtml` (email-template.ts:6) both throw on invalid scheme. Caller wraps in try/catch (route.ts:102-113 for change-email, request/route.ts:131-148 for delete). 502 is the correct status for "transient infrastructure misconfig — retryable upstream of user."
- ✅ **Rollback for delete request:** `await db.prepare(\`DELETE FROM account_deletion_requests WHERE user_id = ?\`).bind(userId).run()` runs on any throw inside the try block (template build + sendEmail). Test `account-delete.test.ts:283-296` exercises the exact path and asserts both 502 and DELETE call.
- ✅ **No 500 escape:** `buildChangeEmailHtml` is invoked only inside the try. `buildDeleteConfirmHtml` likewise. There is no path where the throw bypasses the catch and bubbles to the framework.
- ✅ **Logging distinct enough:** `[change-email] template/send failed` vs `[acct-delete] template/send failed` — both prefixes tell the operator which endpoint and which class of failure (template + send share a catch, acceptable per "uniform 502 response" goal).

**LOW — L3 (P03):** The catch block doesn't distinguish between "template threw (URL invalid)" and "sendEmail threw (Resend down)." A future enhancement could split these: template-throw → 500 (server config bug, page someone), sendEmail-throw → 502 (transient, retry). But for batch 1 the unified 502 is acceptable and simpler.

**LOW — L4 (P03):** The change-email POST endpoint does NOT roll back the just-inserted `verification` row when send fails (route.ts:88-94 inserts unconditionally; only DELETE on existing pending). If template/send throws, the verification row stays in the table for 1 hour — harmless (user can retry → DELETE-then-INSERT replaces it) but inconsistent with the delete-request rollback model. Consider symmetric rollback for cleanliness; non-blocking.

---

### P04 — `idx_pub_jobs_provider_status` composite index

**Idempotent, syntactically correct.** Migration is clean and safe to apply.

**MED — M2 (P04):** Column order `(provider, status)` is not optimal for the documented use cases. Analysis:

1. **Inngest token-refresh / publish-execute lookups** — these read individual rows by `id` (CAS update at `publish-execute-cas.test.ts:31`: `UPDATE … WHERE id = ? AND status = ?`). The composite `(provider, status)` does NOT cover this query.

2. **The actual query that benefits** is the UNION's second leg in `src/app/api/v1/distribute/jobs/[videoId]/status/route.ts:91`: `WHERE pj.provider = 'telegram' AND pj.tenant_id = ? AND pj.video_id = ?`. Note: this filters on `provider + tenant_id + video_id`, not `provider + status`. The new index `(provider, status)` provides only the leftmost `provider` prefix here — partial selectivity. A more targeted index would be `(provider, tenant_id, video_id)` or extend `idx_publishing_jobs_tenant_status_sched` already in `0091`.

3. **Existing coverage:** `idx_publishing_jobs_tenant_status_sched(tenant_id, status, scheduled_at)` from migration 0091 already serves the queue-polling pattern. `idx_pub_jobs_status_sched(status, scheduled_at)` (referenced in migration 0091 comment line 52) covers global polling.

4. **`provider` cardinality:** Currently 2-3 distinct values (`''`, `'telegram'`, future OAuth providers). Low-cardinality leading column = poor leftmost-prefix selectivity. SQLite planner may skip the index entirely if `provider = 'telegram'` is the only filter and it covers >30% of rows.

**Recommendation:** This index is harmless (write cost negligible at <10K rows), and likely WILL be used for the Telegram UNION leg's leading-column filter — but it's NOT the optimal shape for the Inngest cron path described in the migration comment. Do not block the deploy. After deploy, run `EXPLAIN QUERY PLAN` on the actual hot queries against production to verify index usage; if planner skips it, swap for `(provider, tenant_id)` or extend tenant composite. File a follow-up ticket.

**LOW — L5 (P04):** Migration comment claims "Inngest token-refresh cron" usage. Searched `src/forest/inngest/functions/*` — no SQL with explicit `WHERE provider AND status`. Update comment to reference the actual beneficiary (UNION leg in distribute/jobs/[videoId]/status route) for future spelunkers.

---

### P08 — CEO production smoke SOP

**Approved. CEO-grade quality.**

- ✅ No leaked secrets — explicitly directs operator to fetch keys from Bitwarden (sop:75).
- ✅ Endpoints accurate: `https://sophia.agencyos.network`, `/api/version`, `@Sophia_Bbot`. Match `apps/sophia-ai-factory/CLAUDE.md` and `sophia-deploy-verify.md`.
- ✅ Bilingual EN+VI throughout all 5 steps + reporting + frequency tier.
- ✅ Cross-references `sophia-deploy-verify.md` and `sophia-handover-rules.md` correctly.
- ✅ `/api/version` flagged as public-safe (line 76) — accurate per `sophia-deploy-verify.md`.
- ✅ Frequency tier matrix (critical / feature / dependency) is sensible policy.

**LOW — L6 (P08):** Step 4 says "click 'Starter' tier → reach NOWPayments page." On a new account with no auth, the click likely shows login first. Optional: add a sub-step "log in if redirected to /sign-in" so a fresh CEO test session doesn't fail Step 4. Non-blocking.

---

## Cross-Cutting Checks

- **i18n parity:** All user-facing strings in this batch are HTML email bodies (already EN+VI inline) or error codes (`email-change-conflict`, etc., consumed by the dashboard which has its own i18n map — verified `dashboard/account` page handles these via existing translation keys; no new untranslated strings introduced). ✅ PASS.
- **Layer architecture (seed/tree/forest/land):** All API code is in `src/app/api/account/` (Next.js routing, app layer — outside the 4-layer split per `sophia-layer-architecture.md`). No imports cross the forbidden directions (`seed → tree`, `land → forest`, etc.). ✅ PASS.
- **Banned imports check:** No `@/lib/auth`, `@/lib/subscription`, `@/lib/unified-tier-config`, `@/lib/tier-gate` introduced. ✅ PASS.
- **Zero `:any`:** Spot-checked `verify/route.ts:21-23` — `UpdateMeta` is a proper interface. ✅ PASS.
- **No `console.*` in production code:** All routes use `logger.warn / .info / .error`. ✅ PASS.
- **Zod validation:** `change-email/route.ts:27-29` and `delete/request/route.ts:25-27` — present. ✅ PASS.
- **Tests cover happy + error paths:** P02 race-lost, P02 stale-user, P03 invalid-scheme (both endpoints) all asserted. ✅ PASS.
- **CF-direct deploy compat:** Migration 0103 must be applied via `npm run deploy:migrations` before code deploy hits live (or after if no code uses the index — index is a pure perf optimization, no read/write code change, so order does not matter). ✅ PASS.

---

## Recommended Actions

**Before deploy (none required — SHIP).**

**After deploy (optional follow-ups, file as Wave 23 candidates):**

1. **L1:** Add defensive `if (!newEmail)` check in `verify/route.ts` after slice.
2. **L2:** Consider `idx_user_email_lower` for case-insensitive uniqueness scaling.
3. **L4:** Symmetric rollback on `change-email` POST when send/template fails (DELETE inserted verification row).
4. **M2 / L5:** After deploy, `EXPLAIN QUERY PLAN` on `provider='telegram' AND tenant_id=? AND video_id=?` to verify `idx_pub_jobs_provider_status` is actually selected; if not, file follow-up to tune column order (suggest `(provider, tenant_id, video_id)`). Update migration 0103 comment to reference the real query (`v1/distribute/jobs/[videoId]/status` UNION leg).
5. **L6:** Add "log in if redirected" sub-step to SOP Step 4.

---

## Metrics

- Files reviewed: 7 (3 route.ts, 1 email-template.ts, 1 verify route.ts, 1 SQL, 1 SOP MD)
- Tests reviewed: 2 test files (+3 new tests asserted as passing)
- Findings: 0 BLOCK · 1 WATCH (M2) · 6 LOW
- Type coverage: 100% (no new `:any`)
- Linting: clean (per user-reported build exit 0)

---

## Unresolved Questions

1. **P04 column order:** Is the migration intentionally targeting future Telegram-only filter queries (e.g., a planned admin endpoint listing all telegram jobs by status), or is it meant to optimize the existing UNION leg? If the latter, `(provider, tenant_id, video_id)` is a better fit. Recommend post-deploy `EXPLAIN QUERY PLAN` to confirm.
2. **P03 retryability semantics:** Should template-throw and sendEmail-throw return different status codes (500 vs 502)? Current unified 502 is simpler but conflates "ops can retry" with "config bug, page someone."
3. **Verification row replay:** When P02 hits `meta.changes === 0` and deletes the verification row, the user must restart the change-email flow. Is the resulting UX (vague "email change conflict" error) clear enough, or should the response include "the new email was claimed — try a different one" guidance? (i18n consideration for follow-up.)
