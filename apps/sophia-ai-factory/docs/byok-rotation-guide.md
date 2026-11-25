# BYOK Master Key Rotation & Revocation Guide (VN / EN)

> **Bilingual Security Guide** | Zero real keys, tokens, or secrets are stored in this document.
> **Related:** `docs/ops-runbook.md` (3-Part BYOK Disaster Recovery).

---

## 1. Chính Sách Xoay Vòng Khóa (Rotation Policy)

- **Chu kỳ định kỳ (Scheduled Rotation):** Xoay vòng `BYOK_MASTER_KEY` tối thiểu mỗi **90 ngày** hoặc ngay lập tức khi có thay đổi nhân sự có quyền Security Custodian.
- **Xoay vòng khẩn cấp (Emergency Rotation):** Bắt buộc kích hoạt trong vòng **1 giờ** nếu nghi ngờ rò rỉ `BYOK_MASTER_KEY`, rò rỉ Cloudflare account token, hoặc truy cập trái phép vào break-glass vault.
- **Nguyên tắc không gián đoạn (Zero-Downtime Envelope Rotation):**
  1. Tạo phiên bản khóa mới (`key_version_id = vN+1`, `status = 'active'`) trong bảng `key_versions`.
  2. Giữ phiên bản cũ ở trạng thái `decrypt_only` trong suốt cửa sổ re-encryption.
  3. Re-encrypt toàn bộ dòng ciphertext sang `vN+1` theo batch idempotent.
  4. Xác minh 0 dòng còn dùng `vN`, sau đó chuyển `vN` sang trạng thái `retired`.

---

## 2. Chính Sách Thu Hồi (Revocation Policy)

1. **Thu hồi khóa khách hàng (Customer API Key Revocation):**
   - Khách hàng có thể xóa/thay thế API key bất cứ lúc nào trong **Setup Wizard** (BYOK self-service).
   - Hệ thống ghi đè/xóa ciphertext trong D1 ngay lập tức; không lưu bản sao plaintext.
2. **Thu hồi phiên bản khóa hệ thống (`key_versions` Revocation):**
   - Đánh dấu `status = 'revoked'` cho phiên bản bị xâm phạm.
   - Hệ thống **fail-closed**: từ chối giải mã mọi bản ghi gắn `key_version_id` đã `revoked` và thông báo khách hàng cập nhật lại khóa qua Setup Wizard.

---

## 3. Checklist An Toàn Khi Xoay Vòng / Khôi Phục

- [ ] Lưu bản sao `BYOK_MASTER_KEY` mới vào offline break-glass vault **trước** khi ghi đè Cloudflare Worker secret.
- [ ] **KHÔNG** in giá trị khóa ra terminal, CI log, PR description, hay file markdown.
- [ ] Chụp D1 Time Travel bookmark trước khi chạy batch re-encryption.
- [ ] Xác minh giải mã canary record thành công sau khi hoàn tất rotation.
