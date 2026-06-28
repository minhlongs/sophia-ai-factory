# Infrastructure Hardening Checklist

**Last Updated:** 2026-04-28  
**Scope:** DNS, R2 Lifecycle, GitHub Secrets (Sophia AI Factory)

---

## EN: Infrastructure Hardening Guide

### DNS Hardening (Cloudflare)

**Domain:** `sophia.agencyos.network`

| Control | Status | Details |
|---------|--------|---------|
| **Proxy Mode** | Required | Orange cloud (proxied) must be ON in Cloudflare DNS |
| **CAA Records** | Required | `0 issue "letsencrypt.org"` to restrict SSL cert issuance |
| **DNSSEC** | Required | Enable DNSSEC validation via `dig +dnssec` verification |
| **SPF Record** | Required | `v=spf1 include:_spf.google.com ~all` (adjust for email provider) |
| **DKIM Records** | Required | DKIM signing keys configured at provider (Gmail/Resend/etc.) |
| **DMARC Policy** | Required | `v=DMARC1; p=quarantine; rua=mailto:admin@sophia.agencyos.network` |

**Verification Command:**
```bash
dig sophia.agencyos.network A
dig sophia.agencyos.network CAA
dig sophia.agencyos.network MX
dig sophia.agencyos.network TXT  # SPF, DMARC
dig +dnssec sophia.agencyos.network  # Verify DNSSEC chain
```

**Current Provider:** Cloudflare  
**Email Provider:** (Verify: Gmail, Resend, SendGrid, etc.)

---

### R2 Lifecycle Policy

**Bucket Name:** `sophia-ai-factory-opennext-cache`  
**Binding:** `NEXT_INC_CACHE_R2_BUCKET`

| Rule | TTL | Reason | Status |
|------|-----|--------|--------|
| **Cache Objects** | 30 days | Auto-delete stale cache (regeneratable) | TODO |
| **Health Check Files** | 7 days | Rotate health-check.txt, test files | TODO |

**Implementation:**
```bash
# Apply 30-day cache cleanup policy
npx wrangler r2 bucket lifecycle put \
  --bucket-name sophia-ai-factory-opennext-cache \
  --rules '[{"filter":{"prefix":""},"deleteAfterDays":30}]'

# Apply 7-day health check rotation
npx wrangler r2 bucket lifecycle put \
  --bucket-name sophia-ai-factory-opennext-cache \
  --rules '[{"filter":{"prefix":"health-check"},"deleteAfterDays":7}]'
```

**Verification:**
```bash
npx wrangler r2 bucket info sophia-ai-factory-opennext-cache
```

---

### GitHub Secrets Inventory

**Repository:** `longtho638-jpg/sophia-ai-factory`

#### Required Secrets

| Secret | Purpose | Rotation | Status |
|--------|---------|----------|--------|
| `CLOUDFLARE_API_TOKEN` | Deploy + D1 access | 90 days | TODO |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare identity | Static (no rotation) | TODO |
| `SENTRY_AUTH_TOKEN` | Error tracking + source maps | 90 days | TODO |
| `SENTRY_ORG` | Sentry org slug | Static | TODO |
| `SENTRY_PROJECT` | Sentry project slug | Static | TODO |
| `BETTER_AUTH_SECRET` | Session encryption | 180 days | TODO |
| `NOWPAYMENTS_IPN_SECRET` | Webhook signature | 90 days | TODO |
| `OPENROUTER_API_KEY` | LLM API (if used) | 90 days | TODO |

#### Rotation Cadence

- **90-day tokens** (API keys): `CLOUDFLARE_API_TOKEN`, `SENTRY_AUTH_TOKEN`, `NOWPAYMENTS_IPN_SECRET`, `OPENROUTER_API_KEY`
- **180-day keys** (encryption keys): `BETTER_AUTH_SECRET`
- **Static identifiers** (no rotation): `CLOUDFLARE_ACCOUNT_ID`, `SENTRY_ORG`, `SENTRY_PROJECT`

#### Revocation Procedure (If Leak Suspected)

1. **Immediate (< 5 min):** Delete secret from GitHub
2. **Provider Revocation (< 15 min):**
   - Cloudflare: Regenerate API token in dashboard
   - Sentry: Rotate auth token in org settings
   - NOWPayments: Regenerate IPN secret in merchant dashboard
3. **Redeployment (< 30 min):** Update secret in GitHub, push to trigger CI/CD
4. **Audit Log:** Document in `plans/reports/incident-[DATE].md`

---

### Worker Bindings Audit

**Verify bindings match wrangler.toml:**

```bash
# D1 Database
npx wrangler d1 list | grep sophia-raas-db
# Expected: sophia-raas-db (ID: 78bd1961-b62d-43bb-b551-0c5d7d389506)

# R2 Bucket
npx wrangler r2 bucket list | grep sophia-ai-factory-opennext-cache
# Expected: sophia-ai-factory-opennext-cache

# KV Namespace
npx wrangler kv key list --namespace-id c3857792e4014334ba31b62b19d2f32a | head -5
# Expected: EXPERIMENT_KV (ID: c3857792e4014334ba31b62b19d2f32a)

# Current User
npx wrangler whoami
# Expected: Authenticated as CloudFlare account owner
```

---

## VI: Hướng Dẫn Tăng Cường An Toàn Cơ Sở Hạ Tầng

### Tăng Cường DNS (Cloudflare)

**Domain:** `sophia.agencyos.network`

| Kiểm Soát | Yêu Cầu | Chi Tiết |
|----------|---------|---------|
| **Chế Độ Proxy** | Bắt Buộc | Đám mây cam (proxied) phải BẬT trong DNS Cloudflare |
| **Bản Ghi CAA** | Bắt Buộc | `0 issue "letsencrypt.org"` để hạn chế cấp phát chứng chỉ SSL |
| **DNSSEC** | Bắt Buộc | Bật xác thực DNSSEC qua lệnh `dig +dnssec` |
| **Bản Ghi SPF** | Bắt Buộc | `v=spf1 include:_spf.google.com ~all` (điều chỉnh cho nhà cung cấp email) |
| **Bản Ghi DKIM** | Bắt Buộc | Các khóa ký DKIM được cấu hình ở nhà cung cấp (Gmail/Resend/etc.) |
| **Chính Sách DMARC** | Bắt Buộc | `v=DMARC1; p=quarantine; rua=mailto:admin@sophia.agencyos.network` |

**Lệnh Xác Thực:**
```bash
dig sophia.agencyos.network A
dig sophia.agencyos.network CAA
dig sophia.agencyos.network MX
dig sophia.agencyos.network TXT  # SPF, DMARC
dig +dnssec sophia.agencyos.network  # Xác minh chuỗi DNSSEC
```

**Nhà Cung Cấp Hiện Tại:** Cloudflare  
**Nhà Cung Cấp Email:** (Xác minh: Gmail, Resend, SendGrid, v.v.)

---

### Chính Sách Vòng Đời R2

**Tên Bucket:** `sophia-ai-factory-opennext-cache`  
**Ràng Buộc:** `NEXT_INC_CACHE_R2_BUCKET`

| Quy Tắc | TTL | Lý Do | Trạng Thái |
|---------|-----|--------|-----------|
| **Đối Tượng Bộ Nhớ Đệm** | 30 ngày | Tự động xóa bộ nhớ đệm cũ (có thể tái tạo) | TODO |
| **Tệp Kiểm Tra Sức Khỏe** | 7 ngày | Xoay vòng health-check.txt, tệp kiểm tra | TODO |

**Triển Khai:**
```bash
# Áp dụng chính sách làm sạch bộ nhớ đệm 30 ngày
npx wrangler r2 bucket lifecycle put \
  --bucket-name sophia-ai-factory-opennext-cache \
  --rules '[{"filter":{"prefix":""},"deleteAfterDays":30}]'

# Áp dụng xoay vòng kiểm tra sức khỏe 7 ngày
npx wrangler r2 bucket lifecycle put \
  --bucket-name sophia-ai-factory-opennext-cache \
  --rules '[{"filter":{"prefix":"health-check"},"deleteAfterDays":7}]'
```

**Xác Minh:**
```bash
npx wrangler r2 bucket info sophia-ai-factory-opennext-cache
```

---

### Danh Sách Kho Bí Mật GitHub

**Kho Lưu Trữ:** `longtho638-jpg/sophia-ai-factory`

#### Bí Mật Bắt Buộc

| Bí Mật | Mục Đích | Xoay Vòng | Trạng Thái |
|--------|---------|----------|-----------|
| `CLOUDFLARE_API_TOKEN` | Triển khai + Quyền truy cập D1 | 90 ngày | TODO |
| `CLOUDFLARE_ACCOUNT_ID` | Nhận dạng Cloudflare | Tĩnh (không xoay) | TODO |
| `SENTRY_AUTH_TOKEN` | Theo dõi lỗi + bản đồ nguồn | 90 ngày | TODO |
| `SENTRY_ORG` | Slug tổ chức Sentry | Tĩnh | TODO |
| `SENTRY_PROJECT` | Slug dự án Sentry | Tĩnh | TODO |
| `BETTER_AUTH_SECRET` | Mã hóa phiên | 180 ngày | TODO |
| `NOWPAYMENTS_IPN_SECRET` | Chữ ký webhook | 90 ngày | TODO |
| `OPENROUTER_API_KEY` | API LLM (nếu sử dụng) | 90 ngày | TODO |

#### Chu Kỳ Xoay Vòng

- **Mã thông báo 90 ngày** (Khóa API): `CLOUDFLARE_API_TOKEN`, `SENTRY_AUTH_TOKEN`, `NOWPAYMENTS_IPN_SECRET`, `OPENROUTER_API_KEY`
- **Khóa 180 ngày** (Khóa mã hóa): `BETTER_AUTH_SECRET`
- **Mã định danh tĩnh** (không xoay): `CLOUDFLARE_ACCOUNT_ID`, `SENTRY_ORG`, `SENTRY_PROJECT`

#### Quy Trình Thu Hồi (Nếu Nghi Ngờ Rò Rỉ)

1. **Ngay Lập Tức (< 5 phút):** Xóa bí mật khỏi GitHub
2. **Thu Hồi Nhà Cung Cấp (< 15 phút):**
   - Cloudflare: Tạo lại mã thông báo API trong bảng điều khiển
   - Sentry: Xoay vòng mã thông báo xác thực trong cài đặt tổ chức
   - NOWPayments: Tạo lại bí mật IPN trong bảng điều khiển thương gia
3. **Triển Khai Lại (< 30 phút):** Cập nhật bí mật trong GitHub, đẩy để kích hoạt CI/CD
4. **Nhật Ký Kiểm Toán:** Ghi lại trong `plans/reports/incident-[DATE].md`

---

### Kiểm Toán Ràng Buộc Worker

**Xác minh ràng buộc khớp với wrangler.toml:**

```bash
# Cơ sở dữ liệu D1
npx wrangler d1 list | grep sophia-raas-db
# Dự kiến: sophia-raas-db (ID: 78bd1961-b62d-43bb-b551-0c5d7d389506)

# Bucket R2
npx wrangler r2 bucket list | grep sophia-ai-factory-opennext-cache
# Dự kiến: sophia-ai-factory-opennext-cache

# Không gian tên KV
npx wrangler kv key list --namespace-id c3857792e4014334ba31b62b19d2f32a | head -5
# Dự kiến: EXPERIMENT_KV (ID: c3857792e4014334ba31b62b19d2f32a)

# Người Dùng Hiện Tại
npx wrangler whoami
# Dự kiến: Được xác thực là chủ sở hữu tài khoản CloudFlare
```

---

## Next Steps (User Action Items)

- [ ] **Week 1:** Run audit scripts (`scripts/infra/audit-*.sh`) and document baseline
- [ ] **Week 2:** Apply R2 lifecycle rules via script
- [ ] **Week 3:** Rotate 90-day secrets, update GitHub Actions secrets
- [ ] **Week 4:** Configure CAA + DNSSEC records in Cloudflare dashboard
- [ ] **Ongoing:** Monthly rotation calendar for 90-day tokens

---

## References

- Cloudflare DNS: https://dash.cloudflare.com/
- Wrangler CLI: https://developers.cloudflare.com/workers/wrangler/
- GitHub Secrets: https://github.com/longtho638-jpg/sophia-ai-factory/settings/secrets/actions
