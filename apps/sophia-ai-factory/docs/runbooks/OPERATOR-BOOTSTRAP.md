# Runbook: Operator Bootstrap — Establishing the Production Founder Account (RUN-BOOT-001)

**Severity:** P0 — Core platform administrative authority  
**Owner:** Platform operator (automated via secret OR human out-of-band break-glass)  
**Classification:** RUN-BOOT-001 | Zero-Touch Automated Bootstrap (Primary) & Break-Glass Recovery (Secondary)  
**Handover Status:** ✅ COMPLETE / GREEN  

---

## Tổng quan / Overview 🏭

### 🇻🇳 Vietnamese
Để vận hành nền tảng Sophia AI Factory với quyền quản trị đầy đủ, nhà vận hành cần một tài khoản **founder/admin** thực trên production D1. Hệ thống hỗ trợ hai phương thức thiết lập:

1. **Quy trình chuẩn (Primary) — Zero-Touch Automated Bootstrap:** Thiết lập biến môi trường `FOUNDER_EMAIL` trên Cloudflare Worker. Khi tài khoản đăng ký qua giao diện web, hook `databaseHooks.user.create.after` sẽ tự động thăng cấp quyền admin, đồng bộ quyền MASTER tier và ghi log kiểm toán bất biến. Hoàn toàn tuân thủ **Sophia No-Code / No-Tech Doctrine** (không yêu cầu chạy lệnh SQL thủ công).
2. **Quy trình phụ (Secondary) — Break-Glass Manual Recovery:** Sử dụng Cloudflare D1 CLI để can thiệp ngoài băng trong trường hợp khẩn cấp (khi tài khoản đã tạo trước khi đặt `FOUNDER_EMAIL` hoặc gặp sự cố đồng bộ). Quy trình này thực hiện cập nhật nguyên tử trên cả 3 bảng (`"user"`, `user_profiles`, `subscriptions`) và ghi nhận vào `admin_audit_log`.

### 🇬🇧 English
To operate Sophia AI Factory with full administrative authority, the operator requires a real **founder/admin** account in production D1. The platform provides two bootstrap paths:

1. **Primary Standard — Zero-Touch Automated Bootstrap:** Configure the `FOUNDER_EMAIL` environment secret on Cloudflare Workers. Upon signup via the web interface, the Better Auth `databaseHooks.user.create.after` hook automatically elevates the user to admin, synchronizes MASTER subscription tier, and writes an immutable audit record. This fully adheres to the **Sophia No-Code / No-Tech Doctrine** (zero terminal SQL required).
2. **Secondary Fallback — Break-Glass Manual Recovery:** An out-of-band Cloudflare D1 CLI procedure for emergency recovery (e.g., account registered before `FOUNDER_EMAIL` was configured). This updates all three authoritative domains (`"user"`, `user_profiles`, `subscriptions`) atomically and appends an audit event to `admin_audit_log`.

---

## Kiến trúc phân quyền / Architecture & Authority Model 🛡️

Quyền hạn quản trị trong Sophia AI Factory được phân bổ đồng bộ trên 3 thực thể:

```
                  ┌───────────────────────────────────────────────┐
                  │          Better Auth Signup Hook              │
                  │   databaseHooks.user.create.after             │
                  └──────────────────────┬────────────────────────┘
                                         │
                         Matches FOUNDER_EMAIL secret?
                                         │
                    ┌────────────────────┴────────────────────┐
                    ▼ YES                                     ▼ NO
  ┌─────────────────────────────────────┐         ┌─────────────────────────┐
  │ bootstrapFounderIfConfigured(user)  │         │ Standard 'user' role    │
  ├─────────────────────────────────────┤         │ Default 'BASIC' tier    │
  │ 1. "user".role = 'admin'            │         └─────────────────────────┘
  │ 2. user_profiles.role = 'admin'     │
  │    user_profiles.subscription_tier  │
  │      = 'MASTER'                     │
  │ 3. subscriptions.tier = 'MASTER'    │
  │ 4. admin_audit_log:                 │
  │    action_type = 'FOUNDER_BOOTSTRAP'│
  └─────────────────────────────────────┘
```

| Domain | Table | Column | Role in System |
|---|---|---|---|
| **Session Identity** | `"user"` | `role` | Read into `session.user.role` by Better Auth; governs ASVS V3.5.1 re-auth challenges (`/api/auth/admin-challenge`) and administrative Server Actions. |
| **Profile Authority** | `user_profiles` | `role` | Queried by `isUserAdmin(user)` and middleware pipelines (`/dashboard/admin/*`). *Note: `user_profiles` is created immediately on signup via hook, not on first login.* |
| **Feature Entitlement** | `subscriptions` & `user_profiles` | `tier` | Evaluated by `requireMaster()` in `src/land/admin/org-manager.ts` and feature tier gates. |
| **Immutable Audit** | `admin_audit_log` | `action_type` | Immutable audit trail (`FOUNDER_BOOTSTRAP`) tracking actor, target, timestamp, and metadata. |

---

## Điều kiện tiên quyết / Prerequisites 📋

| Yêu cầu / Requirement | Phương thức / Method | Mục đích / Purpose |
|---|---|---|
| `FOUNDER_EMAIL` secret | Cloudflare Dashboard hoặc `wrangler secret put FOUNDER_EMAIL` | Kích hoạt tự động thăng cấp khi tài khoản đăng ký (hỗ trợ nhiều email cách nhau bằng dấu phẩy). |
| Cloudflare CLI (`wrangler`) | `wrangler whoami` | Chỉ cần thiết cho quy trình phục hồi khẩn cấp Break-Glass (Secondary). |
| Quyền truy cập D1 production | `sophia-raas-db` binding | Xác thực database trạng thái (`wrangler d1 execute`). |
| Production URL | `https://sophia.agencyos.network` | Giao diện đăng ký và xác minh dịch vụ. |

---

## Quy trình chuẩn (Primary): Zero-Touch Automated Bootstrap ⚡

> **Khuyến nghị tuyệt đối:** Đây là quy trình chuẩn tuân thủ triết lý no-tech của Sophia AI Factory.

### 🇻🇳 Hướng dẫn từng bước (Tiếng Việt)

#### Bước 1: Cấu hình biến bí mật `FOUNDER_EMAIL`
Đặt email của Founder/Nhà vận hành vào Cloudflare Worker secrets:
```bash
npx wrangler secret put FOUNDER_EMAIL
# Nhập email của bạn (ví dụ: founder@agencyos.network)
# Hoặc nhiều email cách nhau bởi dấu phẩy: founder@agencyos.network,ceo@agencyos.network
```

#### Bước 2: Đăng ký tài khoản trên giao diện Web
1. Truy cập: `https://sophia.agencyos.network/vi/register` (hoặc `/register`).
2. Điền thông tin đăng ký với đúng địa chỉ email đã cấu hình tại Bước 1.
3. Hoàn tất đăng ký tài khoản.

#### Bước 3: Tự động thăng cấp & đồng bộ
Khi người dùng được tạo, `better-auth-server.ts` kích hoạt `databaseHooks.user.create.after`:
- Tự động tạo `user_profiles` với `onboarding_completed_at = NULL`.
- Hàm `bootstrapFounderIfConfigured` phát hiện email khớp với `FOUNDER_EMAIL`:
  - Thăng cấp `"user".role = 'admin'`
  - Cập nhật `user_profiles.role = 'admin'`, `subscription_tier = 'MASTER'`
  - Cập nhật `subscriptions.tier = 'MASTER'`, `plan = 'master'`
  - Chèn bản ghi audit vào `admin_audit_log` với `action_type = 'FOUNDER_BOOTSTRAP'`

#### Bước 4: Đăng nhập và xác minh
1. Đăng nhập tại `https://sophia.agencyos.network/vi/login`.
2. Truy cập thẳng trang quản trị: `https://sophia.agencyos.network/vi/dashboard/admin`.
3. Xác nhận giao diện hiển thị đầy đủ quyền quản trị (HTTP 200).

---

### 🇬🇧 Step-by-Step Instructions (English)

#### Step 1: Configure `FOUNDER_EMAIL` Secret
Set the founder's verified email address in Cloudflare Worker secrets:
```bash
npx wrangler secret put FOUNDER_EMAIL
# Enter your email (e.g., founder@agencyos.network)
# Or comma-separated list: founder@agencyos.network,ceo@agencyos.network
```

#### Step 2: Register via Web UI
1. Navigate to: `https://sophia.agencyos.network/register` (or `/vi/register`).
2. Complete signup using the exact email specified in Step 1.
3. Submit the registration form.

#### Step 3: Automated Elevation & Sync
Upon user record creation, `better-auth-server.ts` executes `databaseHooks.user.create.after`:
- `user_profiles` is automatically initialized with `onboarding_completed_at = NULL`.
- `bootstrapFounderIfConfigured` matches the email against `FOUNDER_EMAIL`:
  - Elevates `"user".role = 'admin'`
  - Updates `user_profiles.role = 'admin'`, `subscription_tier = 'MASTER'`
  - Updates `subscriptions.tier = 'MASTER'`, `plan = 'master'`
  - Writes an immutable event to `admin_audit_log` with `action_type = 'FOUNDER_BOOTSTRAP'`

#### Step 4: Login and Verify
1. Sign in at `https://sophia.agencyos.network/login`.
2. Access the admin console directly: `https://sophia.agencyos.network/dashboard/admin`.
3. Confirm administrative dashboard loads with full entitlements (HTTP 200).

---

## Quy trình phụ (Secondary): Break-Glass Recovery Procedure 🚨

> **Lưu ý:** Chỉ sử dụng quy trình này khi cần can thiệp khẩn cấp ngoài băng (ví dụ: tài khoản đã đăng ký trước khi cấu hình `FOUNDER_EMAIL` hoặc Worker secrets không khả dụng).

### 🇻🇳 Hướng dẫn phục hồi khẩn cấp (Tiếng Việt)

#### Bước 1: Xác định `id` của tài khoản
```bash
FOUNDER_EMAIL="founder@agencyos.network"

npx wrangler d1 execute sophia-raas-db --remote \
  --command "SELECT id, email, emailVerified, createdAt FROM \"user\" WHERE email = '${FOUNDER_EMAIL}';"
```
*Lấy giá trị `id` (ví dụ: `usr_abc12345`).*

#### Bước 2: Kiểm tra bản ghi `user_profiles`
Kiểm tra bản ghi profile đã được khởi tạo khi đăng ký (lưu ý trường `onboarding_completed_at`):
```bash
USER_ID="usr_abc12345"

npx wrangler d1 execute sophia-raas-db --remote \
  --command "SELECT user_id, role, subscription_tier, onboarding_completed_at FROM user_profiles WHERE user_id = '${USER_ID}';"
```

#### Bước 3: Đồng bộ toàn diện 3 bảng và ghi Log kiểm toán
Thực thi khối lệnh SQL đồng bộ hóa nguyên tử cả 3 tầng quyền hạn và ghi nhận vào `admin_audit_log`:

```bash
USER_ID="usr_abc12345"
NOW_SEC=$(date +%s)
LOG_ID=$(uuidgen 2>/dev/null || cat /proc/sys/kernel/random/uuid 2>/dev/null || node -e 'console.log(crypto.randomUUID())')

npx wrangler d1 execute sophia-raas-db --remote --command "
UPDATE \"user\" SET role = 'admin' WHERE id = '${USER_ID}';
UPDATE user_profiles SET role = 'admin', subscription_tier = 'MASTER' WHERE user_id = '${USER_ID}';
UPDATE subscriptions SET tier = 'MASTER', plan = 'master' WHERE user_id = '${USER_ID}';
INSERT INTO admin_audit_log (id, actor_user_id, action_type, target_user_id, payload, created_at)
VALUES (
  '${LOG_ID}',
  '${USER_ID}',
  'FOUNDER_BOOTSTRAP',
  '${USER_ID}',
  json_object('email', '${FOUNDER_EMAIL}', 'promotedRole', 'admin', 'tier', 'MASTER', 'source', 'MANUAL_BREAK_GLASS', 'bootstrappedAt', strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  ${NOW_SEC}
);
"
```

---

### 🇬🇧 Break-Glass Recovery Instructions (English)

#### Step 1: Identify the User ID
```bash
FOUNDER_EMAIL="founder@agencyos.network"

npx wrangler d1 execute sophia-raas-db --remote \
  --command "SELECT id, email, emailVerified, createdAt FROM \"user\" WHERE email = '${FOUNDER_EMAIL}';"
```
*Record the user `id` (e.g., `usr_abc12345`).*

#### Step 2: Inspect Profile State
Verify the profile record initialized during signup (checking column `onboarding_completed_at`):
```bash
USER_ID="usr_abc12345"

npx wrangler d1 execute sophia-raas-db --remote \
  --command "SELECT user_id, role, subscription_tier, onboarding_completed_at FROM user_profiles WHERE user_id = '${USER_ID}';"
```

#### Step 3: Execute Synchronized 3-Domain Elevation & Audit Entry
Run the synchronized SQL statement updating all 3 authorization tables and recording an immutable audit event:

```bash
USER_ID="usr_abc12345"
NOW_SEC=$(date +%s)
LOG_ID=$(uuidgen 2>/dev/null || cat /proc/sys/kernel/random/uuid 2>/dev/null || node -e 'console.log(crypto.randomUUID())')

npx wrangler d1 execute sophia-raas-db --remote --command "
UPDATE \"user\" SET role = 'admin' WHERE id = '${USER_ID}';
UPDATE user_profiles SET role = 'admin', subscription_tier = 'MASTER' WHERE user_id = '${USER_ID}';
UPDATE subscriptions SET tier = 'MASTER', plan = 'master' WHERE user_id = '${USER_ID}';
INSERT INTO admin_audit_log (id, actor_user_id, action_type, target_user_id, payload, created_at)
VALUES (
  '${LOG_ID}',
  '${USER_ID}',
  'FOUNDER_BOOTSTRAP',
  '${USER_ID}',
  json_object('email', '${FOUNDER_EMAIL}', 'promotedRole', 'admin', 'tier', 'MASTER', 'source', 'MANUAL_BREAK_GLASS', 'bootstrappedAt', strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  ${NOW_SEC}
);
"
```

---

## Xác minh toàn diện / End-to-End Verification 🔍

Sau khi thăng cấp (bằng phương thức tự động hoặc break-glass), kiểm tra quyền quản trị:

```bash
PROD_URL="https://sophia.agencyos.network"

# 1. Kiểm tra Health check
curl -s -o /dev/null -w "Health: %{http_code}\n" "${PROD_URL}/api/health"
# Kết quả mong đợi: 200

# 2. Đăng nhập vào Browser
# Điều hướng tới: https://sophia.agencyos.network/vi/login
# Đăng nhập bằng email founder

# 3. Kiểm tra trang Quản trị Admin
# Điều hướng tới: https://sophia.agencyos.network/vi/dashboard/admin
# Kết quả mong đợi: HTTP 200 với đầy đủ giao diện thống kê quản trị

# 4. Kiểm tra quyền Organization Manager (MASTER Tier Gate)
# Điều hướng tới: https://sophia.agencyos.network/vi/dashboard/admin/organizations
# Kết quả mong đợi: HTTP 200 (không bị chặn bởi lỗi requireMaster 403)

# 5. Xác minh người dùng thông thường vẫn bị chặn an toàn (Fail-Closed)
curl -s -o /dev/null -w "No Auth Code: %{http_code}\n" "${PROD_URL}/api/admin/users"
# Kết quả mong đợi: 401 hoặc 403
```

---

## Thu hồi quyền / Revoke Admin & Rollback 🔄

Khi cần thu hồi quyền quản trị hoặc hạ cấp về người dùng thông thường:

```bash
USER_ID="usr_abc12345"
NOW_SEC=$(date +%s)
LOG_ID=$(uuidgen 2>/dev/null || cat /proc/sys/kernel/random/uuid 2>/dev/null || node -e 'console.log(crypto.randomUUID())')

npx wrangler d1 execute sophia-raas-db --remote --command "
UPDATE \"user\" SET role = 'user' WHERE id = '${USER_ID}';
UPDATE user_profiles SET role = 'user', subscription_tier = 'BASIC' WHERE user_id = '${USER_ID}';
UPDATE subscriptions SET tier = 'BASIC', plan = 'free' WHERE user_id = '${USER_ID}';
INSERT INTO admin_audit_log (id, actor_user_id, action_type, target_user_id, payload, created_at)
VALUES (
  '${LOG_ID}',
  '${USER_ID}',
  'ADMIN_REVOKE',
  '${USER_ID}',
  json_object('demotedRole', 'user', 'tier', 'BASIC', 'revokedAt', strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  ${NOW_SEC}
);
"
```

Việc thu hồi có hiệu lực ngay lập tức tại tầng DB (`isUserAdmin` kiểm tra `user_profiles.role` theo thời gian thực).

---

## Xử lý sự cố / Troubleshooting & FAQs 🛠️

| Triệu chứng / Symptom | Nguyên nhân / Cause | Cách khắc phục / Resolution |
|---|---|---|
| Đăng ký xong nhưng tài khoản vẫn là `user` | Biến `FOUNDER_EMAIL` chưa được nạp hoặc không trùng khớp email | Kiểm tra `FOUNDER_EMAIL` trên Worker. Có thể áp dụng quy trình Break-Glass Recovery để đồng bộ ngay. |
| Gặp lỗi `no such column: onboarding_completed` | Nhầm lẫn tên cột schema cũ | Sử dụng đúng tên cột `onboarding_completed_at` theo Migration 0004. |
| Bị chặn 403 khi vào Organization Manager | Trước đây `requireMaster()` chỉ kiểm tra bảng `subscriptions` | Đã được khắc phục trong Phase 3: `requireMaster()` tự động cho phép `role === 'admin'`. Đồng thời quy trình bootstrap mới đã đồng bộ cả `subscriptions.tier = 'MASTER'`. |
| Session vẫn hiển thị role cũ sau khi dùng Break-Glass SQL | Cookie session của Better Auth lưu đệm trong thời gian hiệu lực | Đăng xuất (`/api/auth/sign-out`) và đăng nhập lại để làm mới session cookie. |

---

## Tiêu chuẩn Bàn giao / Handover Certification (P0-01) 📜

Runbook này cùng giải pháp Zero-Touch Bootstrap đã giải quyết dứt điểm hạng mục **P0-01** trong `docs/audit/HANDOVER-HARDENING-BACKLOG.md`:

- [x] Tự động hóa Zero-Touch qua biến môi trường `FOUNDER_EMAIL`.
- [x] Đồng bộ nguyên tử cả 3 bảng (`"user"`, `user_profiles`, `subscriptions`).
- [x] Bổ sung Migration `0272_user_profiles_role.sql` bảo đảm tính nhất quán schema.
- [x] Hợp nhất cổng `requireMaster()` cho phép Admin quản trị tổ chức.
- [x] Ghi nhận kiểm toán bất biến vào `admin_audit_log` (`action_type = 'FOUNDER_BOOTSTRAP'`).
- [x] Quy trình Break-Glass rõ ràng, an toàn và có kiểm toán đầy đủ.

Trạng thái mục **P0-01**: **✅ COMPLETE / GREEN**.

---

*Cập nhật lần cuối: 2026-09-10. Tham chiếu: `src/seed/auth/founder-bootstrap.ts`, `src/land/admin/org-manager.ts`, `docs/audit/SUPREME-HANDOVER-CERTIFICATE.md`.*
