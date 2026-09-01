# Data Retention Policy — Sophia AI Factory

**Version:** 1.0.0
**Effective:** 2026-08-31
**Scope:** Production at https://sophia.agencyos.network
**Deploy:** CF-direct via wrangler CLI (GitHub Actions disabled by design)

---

## TL;DR (No-Tech Summary)

This policy defines how long Sophia keeps different types of data. Some data is kept forever (user accounts, billing records), some is auto-deleted after a set period (cache, logs), and some is kept only as long as legally required (payment records).

**Vietnamese (Tóm tắt):**
Chính sách này xác định Sophia giữ các loại dữ liệu khác nhau trong bao lâu. Một số dữ liệu được giữ mãi mãi (tài khoản người dùng, hồ sơ thanh toán), một số bị xóa tự động sau một thời gian (bộ nhớ đệm, nhật ký), và một số chỉ được giữ trong thời hạn theo yêu cầu pháp lý (hồ sơ thanh toán).

---

## Retention Periods by Data Category

### 1. User Account & Profile Data

| Data | Retention | Deletion Trigger |
|------|-----------|------------------|
| User profile (name, email, tier) | **Indefinite** | User account deletion |
| BYOK API keys (encrypted) | **Indefinite** | User account deletion or key rotation |
| Session tokens | **30 days** of inactivity | Automatic expiry |
| MFA credentials | **Indefinite** | User account deletion |

**Vietnamese:**
- Hồ sơ người dùng: **Không giới hạn** — Xóa khi người dùng xóa tài khoản
- Khóa API BYOK (mã hóa): **Không giới hạn** — Xóa khi xóa tài khoản hoặc xoay khóa
- Token phiên: **30 ngày** không hoạt động — Tự động hết hạn

### 2. Billing & Payment Records

| Data | Retention | Legal Basis |
|------|-----------|-------------|
| Payment transactions (NOWPayments, PayOS) | **7 years** | Tax / accounting law (VN + international) |
| Tier change history | **7 years** | Tax / accounting law |
| Top-up records | **7 years** | Tax / accounting law |
| Refund records | **7 years** | Tax / accounting law |

**Vietnamese:**
- Giao dịch thanh toán: **7 năm** — Luật thuế / kế toán
- Lịch sử thay đổi gói: **7 năm** — Luật thuế / kế toán
- Hồ sơ nạp tiền: **7 năm** — Luật thuế / kế toán
- Hồ số hoàn tiền: **7 năm** — Luật thuế / kế toán

**Note:** 7-year retention is the **minimum** for tax compliance. Data is NOT auto-deleted at 7 years — deletion requires manual review.

### 3. Campaign & Content Data

| Data | Retention | Deletion Trigger |
|------|-----------|------------------|
| Campaign metadata | **Indefinite** | User deletion |
| Generated video assets (R2) | **Indefinite** | User deletion or manual purge |
| Creative memory / provenance | **Indefinite** | User deletion |

**Vietnamese:**
- Siêu dữ liệu chiến dịch: **Không giới hạn** — Xóa khi người dùng xóa
- Video đã tạo (R2): **Không giới hạn** — Xóa khi người dùng xóa hoặc dọn thủ công
- Bộ nhớ sáng tạo / nguồn gốc: **Không giới hạn** — Xóa khi người dùng xóa

### 4. Observability & Monitoring Data

| Data | Retention | Mechanism |
|------|-----------|-----------|
| `performance_events` | **90 days** | Manual purge (no auto-delete yet) |
| `cron_run_log` | **30 days** | Manual purge |
| `user_alerts` | **90 days** | Manual purge |
| `circuit_breaker_state` | **Indefinite** | State table (current state only) |
| R2 ISR cache | **30 days** | Automatic TTL |
| KV feature flags / alert throttle | **15 min – 6h** | Automatic TTL |
| Sentry error events | **90 days** | Sentry default |
| D1 snapshots (R2 backups) | **30 days** | Automatic cleanup |

**Vietnamese:**
- `performance_events`: **90 ngày** — Dọn thủ công
- `cron_run_log`: **30 ngày** — Dọn thủ công
- `user_alerts`: **90 ngày** — Dọn thủ công
- Bộ nhớ đệm R2 ISR: **30 ngày** — Tự động hết hạn
- Cờ KV / throttle cảnh báo: **15 phút – 6 giờ** — Tự động hết hạn
- Sentry events: **90 ngày** — Mặc định Sentry
- D1 snapshots: **30 ngày** — Tự động dọn

### 5. Temporary / Ephemeral Data

| Data | Retention | Mechanism |
|------|-----------|-----------|
| Inngest job state | **7 days** | Inngest default |
| SSE stream connections | **Duration of connection** | Connection close |
| CSRF tokens | **Session** | Browser session |
| Rate-limit counters | **1 minute** | Sliding window |

---

## Deletion Procedures

### User-Initiated Deletion (Right to Erasure)

When a user requests account deletion:

1. Delete user profile + auth record
2. Delete all campaigns + videos + creative memory
3. Delete BYOK keys
4. **Retain** billing records (7-year legal requirement) — anonymize PII
5. Delete session tokens, MFA credentials

**Vietnamese (Xóa theo yêu cầu người dùng):**
1. Xóa hồ sơ + bản ghi xác thực
2. Xóa tất cả chiến dịch + video + bộ nhớ sáng tạo
3. Xóa khóa BYOK
4. **Giữ lại** hồ sơ thanh toán (yêu cầu pháp lý 7 năm) — ẩn danh PII
5. Xóa token phiên, MFA

### Automated Purge (Future)

Manual purge scripts are planned for `performance_events`, `cron_run_log`, and `user_alerts`. Until then, operators should run quarterly purges:

```bash
# Quarterly purge example (manual)
npx wrangler d1 execute sophia-raas-db --command="DELETE FROM performance_events WHERE recorded_at < unixepoch() - 90*86400;" --remote
npx wrangler d1 execute sophia-raas-db --command="DELETE FROM cron_run_log WHERE run_at < unixepoch() - 30*86400;" --remote
npx wrangler d1 execute sophia-raas-db --command="DELETE FROM user_alerts WHERE created_at < unixepoch() - 90*86400;" --remote
```

---

## Backup Retention

| Backup Type | Retention | Location |
|-------------|-----------|----------|
| D1 snapshots | **30 days** | R2 `BACKUPS_BUCKET` |
| R2 cache | **30 days** | Automatic TTL |
| KV namespace | **N/A** | Transient (re-seed on demand) |

---

## Compliance Notes

- **Vietnam:** Personal data processing must comply with Decree 13/2023/ND-CP (data protection). 7-year financial retention aligns with Law on Accounting 2015.
- **International:** GDPR right-to-erasure honored for non-financial data. Financial records retained under "legal obligation" basis.
- **BYOK keys:** Encrypted at rest. Deletion = cryptographic erasure (key material destroyed).

**Vietnamese (Tuân thủ):**
- **Việt Nam:** Xử lý dữ liệu cá nhân phải tuân thủ Nghị định 13/2023/NĐ-CP. Giữ 7 năm tài chính phù hợp với Luật Kế toán 2015.
- **Quốc tế:** Quyền xóa GDPR được tôn trọng cho dữ liệu phi tài chính. Hồ sơ tài chính được giữ theo cơ sở "nghĩa vụ pháp lý".
- **Khóa BYOK:** Mã hóa lúc nghỉ. Xóa = xóa mật mã (phá hủy vật liệu khóa).

---

## Document History

| Date | Author | Changes |
|------|--------|---------|
| 2026-08-31 | Phase 3 hardening | Initial data retention policy — bilingual EN+VN |
