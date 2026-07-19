---
title: "Wave 20 Independent Code Review"
type: code-review-report
agent: code-reviewer
date: 2026-05-10
scope: 5 commits trên main (Wave 20 P01-P05) đã deploy production
verdict: 3 SAFE, 1 WATCH, 1 RISK
---

# Wave 20 Code Review — Findings

## Verdict per phase

| Phase | Commit | Verdict |
|---|---|---|
| 01 — MarkdownV2 escape | `84906c44` | **SAFE** |
| 02 — Telegram step split | `9f051edd` | **WATCH** |
| 03 — Sidebar quota widget | `d07550aa` | **SAFE** |
| 04 — Email change + export | `1577e1e7` | **RISK** |
| 05 — Schema rename | `661f065b` + `33999bcd` | **SAFE** |

---

## Top 5 findings → Wave 22 backlog

### 1. [HIGH/SECURITY] Email-change token lưu plaintext

**File:** `src/app/api/account/change-email/route.ts:78`
`value = '${newEmail}:${token}'` lưu raw token trong `verification.value`.
**Risk:** D1 dump/backup/support query → attacker chiếm được email-change link.
**Fix Wave 22:** Hash token (`sha256(token)`) ở column `value`, gửi raw token qua email, verify so sánh hash.

### 2. [HIGH/SECURITY] TOCTOU race trên email uniqueness

**Files:** `change-email/route.ts:68-74` (POST check) → `verify/route.ts:63-70` (verify check) → `:73-76` (UPDATE).
**Risk:** 2 user đổi cùng email A → cả 2 pass uniqueness → ai click link cuối wins, người trước thấy success page nhưng email không đổi.
**Fix Wave 22:** Conditional UPDATE: `UPDATE user SET email=? WHERE id=? AND NOT EXISTS (SELECT 1 FROM user WHERE LOWER(email)=? AND id!=?)`, check `meta.changes === 1`.

### 3. [MEDIUM/RELIABILITY] `telegram-send` step có thể không retry vì `retries: 0`

**File:** `src/forest/inngest/functions/publish-execute.ts:374` thừa hưởng function-level `retries: 0` (line 192).
**Risk:** Nếu Inngest không override `retries: 0` cho `RetryAfterError`, Phase 02 fix INCOMPLETE — telegram 429 không thực sự retry sau `retry_after`.
**Fix Wave 22:** Verify Inngest behavior. Nếu cần, set explicit `retries` cho function hoặc dùng `step.sleep(retryAfterSec)` trước khi throw error thường.

### 4. [MEDIUM/UX] `NEXT_PUBLIC_APP_URL` fallback `#` silent

**File:** `change-email/route.ts:96` — env trống → fallback `#` → email link no-op.
**Fix Wave 22:** Throw 500 khi env không set + log warning.

### 5. [LOW/PERF] Migration `0101` thiếu index `(provider, status)`

**File:** `migrations/0101-publishing-jobs-rename-video-job-id-to-video-id.sql`
Telegram path filter `provider='telegram'` không có index → slow khi >10K jobs.
**Fix Wave 22:** `CREATE INDEX IF NOT EXISTS idx_pub_jobs_provider_status ON publishing_jobs(provider, status)`.

---

## Security / data-loss summary

- **#1 + #2** là blocker cho public launch. Hiện chấp nhận được vì pre-launch low traffic.
- DELETE-then-INSERT pattern (`change-email/route.ts:83-94`) OK — single user identifier, không data loss.
- Phase 02 step split fix đúng bug 429-retry-bail; CAS memoize replay-safe.
- Phase 05 sweep đầy đủ — `engine_missions.video_job_id` cố ý giữ; idempotent CREATE đúng spec.

---

## Unresolved questions

1. **Inngest `RetryAfterError` vs `retries: 0`** — cần verify docs hoặc test thực tế.
2. **Quota widget cache 60s** — chấp nhận stale sau publishing job complete? Cần invalidate `useQuery(['/api/quota/status'])` ở `useFreeFlowExecute` success?
3. **`telegram-finalize` step idempotency** — test count chỉ +21 cho Phase 02; chưa thấy explicit test cho replay (DB write idempotent).

---

**Action:** Chuyển 5 findings vào Wave 22 backlog. KHÔNG fix trong Wave 21 (out of scope).
