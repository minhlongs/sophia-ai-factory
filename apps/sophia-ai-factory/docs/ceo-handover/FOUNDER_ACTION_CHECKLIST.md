# Founder Action Checklist / Danh sách việc Founder

> **Purpose / Mục đích:** These actions require the Founder's personal login and CANNOT be delegated or automated. A subagent cannot create a Cloudflare service account or promote someone to GitHub org owner.
>
> **Danh sách này yêu cầu Founder đăng nhập bằng tài khoản cá nhân và KHÔNG thể giao cho người khác hoặc tự động hóa.**

---

## 🔴 BLOCKER — Enable Analytics Engine (before any deploy)

**Why:** Cloudflare deploy fails with code 10089 ("You need to enable Analytics Engine"). The `WAE` binding in `wrangler.toml` is NOT new — it was added by commit `34b0eb736` (ancestor of baseline `5dd1f071`), so this is an account-level condition, not a code regression.

**Founder làm:**
1. [ ] Đăng nhập Cloudflare dashboard (`dash.cloudflare.com`)
2. [ ] Account → Workers & Pages → Analytics Engine
3. [ ] Enable Analytics Engine cho account `f691e83094f776311a1bfe3f8b126f1c`
4. [ ] Sau khi enable: `cd apps/sophia-ai-factory && npm run deploy:full`
5. [ ] Verify: `/api/version` shortSha == local SHA (không chỉ HTTP 200)

**Tech Lead kiểm tra:**
```bash
curl -s https://sophia.agencyos.network/api/version | grep -o '"shortSha":"[^"]*"' | cut -d'"' -f4
# Kết quả phải là SHA commit mới (không phải 5dd1f071)
```

---

## Phase 1 — Access Transfer / Chuyển giao quyền truy cập (Day 1)

### 1.1 Cloudflare Service Account / Tài khoản dịch vụ Cloudflare

**Founder làm:**
1. [ ] Đăng nhập Cloudflare dashboard (`dash.cloudflare.com`)
2. [ ] My Profile → API Tokens → Create Token
3. [ ] Cấp quyền:
   - Account: Workers Scripts (Edit), D1 (Edit), R2 (Edit), KV (Edit)
   - Zone: DNS (Edit) cho `agencyos.network`
4. [ ] Tên: `sophia-tech-lead-access`
5. [ ] Hạn sử dụng: 90 ngày (gia hạn được)
6. [ ] Chia sẻ token qua password manager (KHÔNG in ra màn hình, KHÔNG gửi email)

**Tech Lead kiểm tra:**
```bash
export CLOUDFLARE_API_TOKEN="<token>"
npx wrangler whoami
# Kết quả phải hiển thị email Tech Lead, không phải founder
```

### 1.2 GitHub Admin / Admin GitHub

**Founder làm:**
1. [ ] GitHub org Settings → Members
2. [ ] Thêm Tech Lead với vai trò **Owner** (không phải Member)
3. [ ] Tech Lead chấp nhận lời mời

**Tech Lead kiểm tra:**
```bash
gh api user/memberships/orgs
# Kết quả: "role": "admin"
```

### 1.3 NOWPayments / NOWPayments

**Founder làm:**
1. [ ] Đăng nhập NOWPayments dashboard
2. [ ] Settings → Team / Users
3. [ ] Thêm Tech Lead email với full access
4. [ ] Tech Lead chấp nhận qua email

### 1.4 Inngest / Inngest

**Founder làm:**
1. [ ] Đăng nhập `app.inngest.com`
2. [ ] Team Settings → Members
3. [ ] Thêm Tech Lead làm Admin

### 1.5 Sentry / Sentry

**Founder làm:**
1. [ ] Đăng nhập `sentry.io`
2. [ ] Settings → Members
3. [ ] Thêm Tech Lead làm Admin

---

## Phase 2 — MFA + Password Manager / MFA + Password Manager (Day 2)

**Founder + Tech Lead cùng làm:**

1. [ ] Xác minh MFA đã bật trên Cloudflare (Settings → Security)
2. [ ] Xác minh MFA đã bật trên GitHub (Settings → Security)
3. [ ] Xác minh MFA đã bật trên NOWPayments
4. [ ] Xuất recovery codes vào password manager (mỗi tài khoản 1 entry)
5. [ ] CEO đăng nhập password manager và xác nhận có thể xem secrets
6. [ ] Cập nhật `docs/ceo-handover/SECURITY_OPERATIONS.md` → MFA status

---

## Phase 3 — D1 Restore Drill /-Thử nghiệm phục hồi D1 (Days 3-4)

**Tech Lead thực hiện (Founder có thể có mặt để chứng kiến):**

**Ngày 3 — Tạo backup:**
```bash
curl -X POST https://sophia.agencyos.network/api/cron/d1-backup \
  -H "Authorization: Bearer $CRON_SECRET"
```
1. [ ] Xác nhận backup trong R2: `wrangler r2 object list sophia-ai-factory-opennext-cache --prefix backups/`
2. [ ] Tải backup về local
3. [ ] Tạo scratch D1: `wrangler d1 create sophia-raas-db-restore-test`

**Ngày 4 — Phục hồi và kiểm tra:**
4. [ ] Restore: `wrangler d1 execute sophia-raas-db-restore-test --file=<backup.sql> --remote`
5. [ ] Kiểm tra row counts trên critical tables: users, subscriptions, payments, missions
6. [ ] So sánh checksums production vs scratch
7. [ ] Xóa scratch DB sau khi verified: `wrangler d1 delete sophia-raas-db-restore-test`

---

## Phase 7 — Credential Rotation Policy / Chính sách rotate credentials (Day 8)

**Tech Lead lập + CEO phê duyệt:**
1. [ ] Định nghĩa rotation schedule: quarterly cho API keys, annual cho passwords
2. [ ] Ghi procedure từng bước vào `docs/ceo-handover/SECURITY_OPERATIONS.md`
3. [ ] Cập nhật `docs/ceo-handover/ACCESS_OWNERSHIP_MATRIX.md` với rotation schedule
4. [ ] CEO xác nhận đã hiểu trách nhiệm rotation

---

## Phase 8 — Reassessment / Đánh giá lại (Day 8)

**Founder + CEO + Tech Lead:**
1. [ ] Chạy lại readiness audit (12 dimensions)
2. [ ] Cập nhật `docs/ceo-handover/CEO_READINESS_SCORE.md`
3. [ ] Cập nhật `docs/ceo-handover/CEO_HANDOVER_FINAL_REPORT.md`
4. [ ] Ký nhượng quyền (Founder + CEO + Tech Lead)

---

## Why These Cannot Be Automated / Tại sao không thể tự động hóa

| Action | Blocked by |
|--------|-----------|
| Cloudflare API token creation | Founder's logged-in session required |
| GitHub org owner promotion | Org owner privilege required |
| NOWPayments team invite | Account admin required |
| Inngest/Sentry admin add | Account owner required |
| MFA verification | Personal login required |
| D1 restore drill | Live production credentials |
| Final sign-off | Human judgment |

**Các hành động này đều cần đăng nhập bằng tài khoản cá nhân của Founder hoặc có quyền admin account-level.**

---

*Generated 2026-09-02 from `.orchestrate/latest/plan.md` Phase 1/2/3/7/8 action items.*