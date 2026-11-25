# Operations Runbook — BYOK Disaster Recovery (VN / EN)

> **Bilingual Ops Reference** | Zero real keys or secrets are stored in this document.
> **Scope:** Cloudflare Workers + D1 (`sophia-pilot-db` / `sophia-raas-db`) BYOK Encrypted Credential Recovery.

---

## 1. Mối Quan Hệ 3 Thành Phần BYOK DR (3-Part BYOK DR Relationship)

Khôi phục khóa API của khách hàng (BYOK — Bring Your Own Keys) bắt buộc phải có **đồng thời đủ 3 thành phần độc lập**:

| Thành phần (Component) | Nơi lưu trữ (Storage Surface) | Vai trò trong giải mã (Decryption Role) |
|---|---|---|
| **1. Encrypted Customer Data** (`user_api_keys` / BYOK ciphertext rows) | Cloudflare D1 + R2 logical backup (`BACKUPS_BUCKET`) | Chứa chuỗi mã hóa AES-256-GCM (`ciphertext`, `iv`, `authTag`) và `key_version_id`. |
| **2. `key_versions` Metadata Table** | Cloudflare D1 + R2 logical backup | Ánh xạ `key_version_id` → thông số phiên bản khóa mã hóa (version, status, created_at, rotated_at) dùng để chọn đúng khóa dẫn xuất khi giải mã. |
| **3. `BYOK_MASTER_KEY`** (Root Secret) | Cloudflare Worker Secrets (`wrangler secret`) + Offline Break-Glass Vault (tách biệt hoàn toàn khỏi D1/R2) | Khóa gốc dùng để dẫn xuất DEK/KEK giải mã dữ liệu khách hàng. **Không bao giờ** lưu trong D1, R2, hoặc Git. |

---

## 2. Phân Tách Artifact & Phân Quyền Truy Cập (Artifact Separation & Access Roles)

- **Artifact Separation:**
  - **D1 / R2 Backups:** Chỉ chứa ciphertext + `key_versions` metadata (vô giá trị nếu không có `BYOK_MASTER_KEY`).
  - **Cloudflare Worker Secrets / Offline Vault:** Chỉ chứa `BYOK_MASTER_KEY` (không chứa dữ liệu khách hàng).
- **Access Roles (Least Privilege):**
  - **Platform Operator:** Quyền vận hành D1 Time Travel, R2 backup restore, và `wrangler deploy`. Không xem plaintext API key của khách hàng.
  - **Security / Vault Custodian (Founder/Admin):** Quyền truy cập offline break-glass vault để nạp lại `BYOK_MASTER_KEY` qua `wrangler secret put BYOK_MASTER_KEY` trong tình huống DR.
  - **Customer (BYOK Owner):** Sở hữu API key gốc (OpenRouter, ElevenLabs, D-ID, v.v.) và có thể tự nhập lại qua Setup Wizard nếu khóa bị thu hồi.

---

## 3. Trình Tự Khôi Phục Chính Xác (Exact Restore Sequence)

1. **Xác nhận phạm vi sự cố:** Phân biệt lỗi mất D1 (cần restore D1), lỗi mất Worker Secret (cần nạp lại `BYOK_MASTER_KEY`), hay lỗi đồng bộ `key_versions`.
2. **Khôi phục D1 (Encrypted Data + `key_versions`):**
   - Dùng D1 Time Travel (`wrangler d1 time-travel restore <DB_NAME> --bookmark=<BOOKMARK>`) HOẶC khôi phục từ bản dump R2 mới nhất (`wrangler d1 execute <DB_NAME> --remote --file=<dump.sql>`).
3. **Xác minh / Nạp lại `BYOK_MASTER_KEY`:**
   - Security Custodian lấy `BYOK_MASTER_KEY` từ offline break-glass vault và nạp qua đường truyền không echo (`npx wrangler secret put BYOK_MASTER_KEY --config <wrangler.toml>`).
4. **Deploy / Khởi động lại Worker** khớp với schema D1 vừa khôi phục.
5. **Chạy quy trình xác minh (Verification Procedure)** bên dưới trước khi mở lại traffic.

---

## 4. Quy Trình Xác Minh Sau Khôi Phục (Verification Procedure)

1. Kiểm tra `SELECT COUNT(*) FROM key_versions WHERE status = 'active'` trả về >= 1 phiên bản hợp lệ.
2. Kiểm tra `GET /api/health` trả HTTP `200`.
3. Kiểm tra giải mã thử bằng tài khoản kiểm thử nội bộ (canary BYOK record) qua Setup Wizard / health check — xác nhận giải mã thành công không lộ plaintext ra log.

---

## 5. Điều Kiện Thất Bại (Failure Conditions — Fail-Closed)

| Điều kiện thất bại | Biểu hiện | Hành động khắc phục |
|---|---|---|
| **Mất `BYOK_MASTER_KEY` vĩnh viễn** | Giải mã AES-GCM fail (`authTag` mismatch) trên toàn bộ bản ghi | Không thể giải mã ciphertext cũ. Nạp `BYOK_MASTER_KEY` mới, đánh dấu key cũ là `revoked`, và yêu cầu khách hàng nhập lại API key qua Setup Wizard. |
| **Thiếu dòng `key_versions` tương ứng** | Lookup `key_version_id` trả `null` | Restore bảng `key_versions` từ D1 Time Travel / R2 dump cùng thời điểm với bảng encrypted data. |
| **Lệch phiên bản giữa D1 và Worker Secret** | Một phần bản ghi giải mã lỗi | Đối chiếu `key_version_id` trong D1 với lịch sử rotation trong `docs/byok-rotation-guide.md`. |
