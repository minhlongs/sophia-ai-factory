# Runbook: Operator Bootstrap — Establishing the Production Founder Account

**Severity:** P0 — required before full customer handover can be certified GREEN  
**Owner:** Platform operator (human, out-of-band)  
**Classification:** OPERATOR REQUIRED — this runbook cannot be automated

---

## Tổng quan / Overview

### 🇻🇳 Vietnamese

Để vận hành nền tảng Sophia AI Factory với quyền quản trị đầy đủ, nhà vận hành cần có một tài khoản **founder/admin** thực trên production D1. Quy trình này hướng dẫn từng bước để tạo tài khoản đó một cách an toàn, có thể kiểm tra, và không vi phạm nguyên tắc bảo mật.

Đây là hành động **do con người thực hiện ngoài băng** — không tự động, không giả mạo, không bỏ qua xác thực.

### 🇬🇧 English

To operate Sophia AI Factory with full administrative authority, the operator must have a real **founder/admin** account in production D1. This runbook documents the step-by-step procedure to establish that account safely, auditably, and without violating security principles.

This is an **explicit, out-of-band human action** — not automated, not fabricated, not bypassing authentication.

---

## Prerequisites / Điều kiện tiên quyết

| Requirement | Check |
|---|---|
| `wrangler` CLI authenticated (`wrangler whoami`) | Must show operator Cloudflare account |
| Access to production D1 (`sophia-raas-db`) | Verify with `wrangler d1 list --remote` |
| `BETTER_AUTH_SECRET` known (for session verification) | Required to validate sessions post-bootstrap |
| Production URL accessible | `https://sophia.agencyos.network/api/health` → HTTP 200 |
| A valid email address you control | Will be the production admin email |

---

## Why This Is Manual / Lý do quy trình thủ công

The platform enforces **fail-closed admin checks at every admin route**:

```
requireAdmin(request)
  → getCurrentUser()           // Better Auth session
  → isUserAdmin(user)          // DB lookup: user_profiles.role = 'admin'
```

Source: `src/seed/auth/is-user-admin.ts:22-45`

The DB (`user_profiles.role`) is the **source of truth** — session role alone is insufficient. No code path auto-promotes a user to admin on first login. This is intentional fail-closed behavior that must not be bypassed.

---

## Step 1: Register a real account on production

### 🇻🇳

Đăng ký tài khoản thật với email của nhà vận hành tại production.

### 🇬🇧

Register a real account with the operator's email on production.

```bash
# Option A: Via browser (recommended)
# Navigate to: https://sophia.agencyos.network/vi/register
# Complete registration with operator's real email
# Confirm email if email verification is enabled

# Option B: Verify registration succeeded
PROD_URL="https://sophia.agencyos.network"
curl -s "${PROD_URL}/api/health" | head -c 200
# Must return HTTP 200 with status payload
```

**⚠️ Do NOT use:**
- `synthetic-monitor@sophia.agencyos.network` (system account)
- `e2e-test@sophia.local` (E2E test account)
- Any seed/test identity

---

## Step 2: Confirm the account exists in D1

### 🇻🇳

Xác nhận tài khoản vừa đăng ký tồn tại trong D1 production.

### 🇬🇧

Confirm the newly registered account exists in production D1.

```bash
# Query: find the operator's user record
npx wrangler d1 execute sophia-raas-db \
  --command "SELECT id, email, emailVerified, createdAt FROM user WHERE email = 'YOUR_EMAIL_HERE';" \
  --remote

# Expected output example:
# ┌──────────────────────────────────────┬─────────────────────────┬───────────────┬─────────────────────┐
# │ id                                   │ email                   │ emailVerified │ createdAt           │
# ├──────────────────────────────────────┼─────────────────────────┼───────────────┼─────────────────────┤
# │ abc12345-0000-0000-0000-000000000001 │ operator@yourdomain.com │ 1             │ 2026-09-10 10:00:00 │
# └──────────────────────────────────────┴─────────────────────────┴───────────────┴─────────────────────┘

# Record the user ID: ABC12345-0000-0000-0000-000000000001
```

If no row appears, the registration did not complete. Return to Step 1.

---

## Step 3: Check if user_profiles row exists

### 🇻🇳

Kiểm tra xem `user_profiles` đã có bản ghi cho tài khoản này chưa.

### 🇬🇧

Check whether a `user_profiles` row exists for this account (created on first login).

```bash
USER_ID="YOUR_USER_ID_FROM_STEP_2"

npx wrangler d1 execute sophia-raas-db \
  --command "SELECT user_id, role, onboarding_completed FROM user_profiles WHERE user_id = '${USER_ID}';" \
  --remote
```

**Case A — Row exists, role = 'user':**  
→ Proceed to Step 4 to promote to admin.

**Case B — No row:**  
→ Log in via browser first (`/vi/login`), then re-run this query. Login triggers profile creation.

**Case C — Row exists, role = 'admin':**  
→ Bootstrap is already complete. Skip to Step 5 to verify.

---

## Step 4: Promote to admin in D1

### 🇻🇳

**⚠️ Đây là bước không thể đảo ngược.** Chỉ thực hiện với email nhà vận hành đã xác minh.

### 🇬🇧

**⚠️ This action is auditable and irreversible short of a manual revert.** Only perform with the verified operator email.

```bash
USER_ID="YOUR_USER_ID_FROM_STEP_2"

# Set role to 'admin' in user_profiles
npx wrangler d1 execute sophia-raas-db \
  --command "UPDATE user_profiles SET role = 'admin' WHERE user_id = '${USER_ID}';" \
  --remote

# Verify the change
npx wrangler d1 execute sophia-raas-db \
  --command "SELECT user_id, role FROM user_profiles WHERE user_id = '${USER_ID}';" \
  --remote

# Expected:
# │ user_id   │ role  │
# │ abc12345… │ admin │
```

**Audit log:** Record this action with timestamp, operator name, and user ID in your incident log or journal.

---

## Step 5: Verify admin access end-to-end

### 🇻🇳

Xác minh tài khoản admin hoạt động đúng trên production.

### 🇬🇧

Verify the admin account functions correctly on production.

```bash
PROD_URL="https://sophia.agencyos.network"

# 5.1 — Verify login returns a session (browser-based)
# Navigate to: https://sophia.agencyos.network/vi/login
# Sign in with the operator email
# Expected: redirect to /vi/dashboard (not 401/403)

# 5.2 — Verify admin dashboard route is accessible
# Navigate to: https://sophia.agencyos.network/vi/dashboard/admin
# Expected: 200 OK — not 403 Forbidden

# 5.3 — API-level admin check (with session cookie)
# From browser dev tools, copy the session cookie, then:
curl -s -H "Cookie: YOUR_SESSION_COOKIE" \
  "${PROD_URL}/api/admin/users?limit=1" \
  -w "\nHTTP %{http_code}"
# Expected: HTTP 200 with user list payload
# If HTTP 403: admin promotion did not take effect — re-check Step 4
```

---

## Step 6: Validate privilege gates hold for non-admin users

### 🇻🇳

Xác minh rằng người dùng thường KHÔNG được truy cập admin.

### 🇬🇧

Confirm that non-admin users are properly blocked from admin routes.

```bash
PROD_URL="https://sophia.agencyos.network"

# 6.1 — No session → 401
curl -s "${PROD_URL}/api/admin/users?limit=1" \
  -w "\nHTTP %{http_code}"
# Expected: HTTP 401

# 6.2 — Non-admin session → 403
# Log in as a non-admin user and test the same route
# Expected: HTTP 403 Forbidden
```

Implementation enforced at: `src/seed/auth/require-admin.ts:288-327`

---

## Step 7: Document the bootstrap in the ops journal

### 🇻🇳

Ghi nhật ký bootstrap để đảm bảo truy vết.

### 🇬🇧

Log the bootstrap action for auditability.

Create a journal entry at `docs/operations/` or your ops log:

```markdown
## Operator Bootstrap — YYYY-MM-DD

- Operator email: [REDACTED — do not commit]
- User ID: [REDACTED — do not commit]
- user_profiles.role set to 'admin': YYYY-MM-DD HH:MM:SS UTC
- Verified admin dashboard access: ✅
- Verified non-admin blocked: ✅
- Production SHA at time of bootstrap: [git rev-parse HEAD | cut -c1-8]
- Executed by: [operator name]
```

**⚠️ Do NOT commit operator email or user ID to git.**  
Store in a secure location: password manager, encrypted notes, or team vault.

---

## Rollback / Revoke Admin

### 🇻🇳

Để thu hồi quyền admin:

### 🇬🇧

To revoke admin access:

```bash
USER_ID="THE_USER_ID_TO_DEMOTE"

npx wrangler d1 execute sophia-raas-db \
  --command "UPDATE user_profiles SET role = 'user' WHERE user_id = '${USER_ID}';" \
  --remote

# Verify
npx wrangler d1 execute sophia-raas-db \
  --command "SELECT user_id, role FROM user_profiles WHERE user_id = '${USER_ID}';" \
  --remote
# Expected: role = 'user'
```

Revocation is immediate — the next request from this user will be rejected by `isUserAdmin()` without requiring a session invalidation, because `is-user-admin.ts` always queries the DB directly.

---

## Common Errors / Lỗi thường gặp

| Error | Cause | Fix |
|---|---|---|
| `HTTP 403` after Step 4 | Session is cached before admin promotion | Log out and log back in |
| `No rows returned` in Step 3 | user_profiles not yet created | Log in via browser first |
| `wrangler: authentication error` | Not authenticated to Cloudflare | Run `wrangler login` |
| `HTTP 401` on admin API | Session cookie expired | Re-login |
| Role reverts to 'user' | Another code path overwrites it | Check for profile update triggers |

---

## References / Tài liệu liên quan

| File | Purpose |
|---|---|
| `src/seed/auth/is-user-admin.ts` | Admin resolution — DB is source of truth |
| `src/seed/auth/require-admin.ts` | Route guard: session + DB admin gate |
| `src/seed/auth/better-auth-session.ts` | Session retrieval |
| `src/middleware.ts` | Admin route middleware gate |
| `docs/runbooks/KEY-ROTATION.md` | Key management procedures |
| `docs/runbooks/INCIDENT-RESPONSE-QUICKREF.md` | Emergency procedures |

---

## Certification Gate

This runbook resolves **P0-01** from `docs/audit/HANDOVER-HARDENING-BACKLOG.md`.

**Gate criteria:**
- [ ] Operator account created with real email
- [ ] `user_profiles.role = 'admin'` confirmed in D1
- [ ] `/vi/dashboard/admin` returns HTTP 200
- [ ] Unauthenticated request returns HTTP 401
- [ ] Non-admin user returns HTTP 403
- [ ] Bootstrap action logged in ops journal (off-git)

When all criteria are met, P0-01 status changes from `OPERATOR REQUIRED` to `✅ COMPLETE`.

---

*Last updated: 2026-09-10. Cross-reference: `docs/audit/HANDOVER-HARDENING-BACKLOG.md`, `docs/audit/SUPREME-HANDOVER-CERTIFICATE.md`.*
