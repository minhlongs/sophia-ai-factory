# Payment Flow Resilience Runbook / Bảng xử lý sự cố thanh toán

> **Protected Flow 3** — NOWPayments IPN webhook → tier activation
> Hướng dẫn này trả lời: "Điều gì xảy ra khi IPN đến trễ? Khi DLQ đầy? Khi giao dịch D1 bị gián đoạn giữa chừng?"

---

## Tổng quan / Overview

Luồng thanh toán hoạt động như sau:

```
Khách trả tiền → NOWPayments gửi IPN → /api/payments/nowpayments/webhook
  → Lưu vào payment_events (atomic lock)
  → Xử lý: finished → kích hoạt tier
            failed → xử lý thất bại
            refunded → hoàn tiền
  → DLQ (nếu lỗi vĩnh viễn) → DLQ Reaper tự động retry
```

---

## Kịch bản 1: IPN NOWPayments bị trễ

### ❌ Failure — Lỗi xảy ra

- NOWPayments gửi IPN nhưng đến muộn (> 5 phút sau khi khách thanh toán)
- Khách thấy "Đang xử lý thanh toán" trên dashboard
- Tier chưa được kích hoạt dù khách đã trả tiền

### ✅ Detection — Phát hiện

| Cách | Mô tả |
|------|-------|
| Khách báo | "Tôi đã trả tiền nhưng tier vẫn là FREE" |
| NOWPayments dashboard | Payment status = "finished" nhưng IPN không được ghi |
| D1 | Kiểm tra bảng `payment_events` — không có entry tương ứng |
| Sentry | Lỗi `PaymentWebhookAuthFailed` (nếu secret sai) |

### 🔧 Recovery — Khắc phục

1. **Kiểm tra IPN Secret đang hoạt động**:
```bash
# Test endpoint với IPN test từ NOWPayments dashboard
# NOWPayments → Settings → IPN → Send Test IPN
curl -s -X POST https://sophia.agencyos.network/api/payments/nowpayments/webhook \
  -H "Content-Type: application/json" \
  -d '{"payment_id":"test","payment_status":"finished","price_amount":29,"price_currency":"usd"}'
```

2. **Nếu IPN Secret đúng nhưng IPN mất**:
   - NOWPayments tự retry IPN sau 1 phút, rồi 5 phút, rồi 15 phút
   - Chờ tối đa 30 phút — NOWPayments sẽ gửi lại
   - Nếu sau 1 giờ vẫn chưa có → xem **Kịch bản 3: DLQ đầy**

3. **Thông báo cho khách**: "Thanh toán của bạn đã được xác nhận. Tier sẽ được kích hoạt trong vài phút. Nếu sau 1 giờ vẫn chưa thay đổi, liên hệ hỗ trợ."

### 🧪 Test — Kiểm tra

```bash
# Xác minh endpoint IPN chạy
curl -sI -X POST https://sophia.agencyos.network/api/payments/nowpayments/webhook

# Kiểm tra payment_events có nhận lock không
cd apps/sophia-ai-factory
npx wrangler d1 execute sophia-raas-db --remote \
  --command "SELECT event_id, processed, created_at FROM payment_events ORDER BY created_at DESC LIMIT 5"
```

---

## Kịch bản 2: Giao dịch D1 bị gián đoạn giữa chừng

### ❌ Failure — Lỗi xảy ra

- IPN nhận được, đã vào atomic lock (`INSERT ON CONFLICT`)
- Nhưng trong lúc xử lý, D1 mất kết nối hoặc Worker bị gián đoạn
- Lock giữ nguyên → lần IPN tiếp theo thất bại với "Already processing"

### ✅ Detection — Phát hiện

| Cách | Mô tả |
|------|-------|
| D1 | `payment_events` có entry `processed = 0` và tuổi > 5 phút |
| NOWPayments | Nhận IPN retry liên tiếp với cùng `payment_id` |
| Sentry | Lỗi `D1_TIMEOUT` hoặc `D1_UNAVAILABLE` |

### 🔧 Recovery — Lock cũ tự động dọn (Stale Lock Recovery)

Hệ thống có cơ chế tự phục hồi:

1. **Sau 5 phút**: Lock tự động bị xóa — NOWPayments retry sẽ tạo lock mới
2. **Đoạn mã** (từ `nowpayments-ipn-handlers.ts`):
   ```typescript
   const lockAgeMs = Date.now() - new Date(existing.created_at).getTime()
   if (lockAgeMs > 5 * 60 * 1000) {
     // Xóa lock cũ, cho phép retry
     await db.prepare('DELETE FROM payment_events WHERE event_id = ?')
     return { success: false, message: 'Stale lock cleared — retry' }
   }
   ```

### 🔧 Recovery — Nếu vẫn mắc kẹt sau 5 phút

1. **Kiểm tra D1 có đang hoạt động**:
```bash
cd apps/sophia-ai-factory
npx wrangler d1 info sophia-raas-db --remote
```

2. **Xác minh lock đã được giải phóng**:
```bash
npx wrangler d1 execute sophia-raas-db --remote \
  --command "SELECT event_id, processed, created_at FROM payment_events WHERE processed = 0"
```

3. **Nếu vẫn có lock > 15 phút**: Gửi lại IPN test từ NOWPayments dashboard → NOWPayments sẽ gửi lại

### 🧪 Test — Kiểm tra

```bash
# Xác nhận stale lock recovery hoạt động
# 1. Tạo một lock giả (processed = 0, tạo 6 phút trước)
npx wrangler d1 execute sophia-raas-db --remote \
  --command "INSERT OR REPLACE INTO payment_events (event_id, event_type, payload, processed, created_at) VALUES ('test_stale_lock', 'nowpayments.test', '{}', 0, datetime('now', '-6 minutes'))"

# 2. Gửi IPN test — hệ thống phải phát hiện stale lock và xóa
curl -s -X POST https://sophia.agencyos.network/api/payments/nowpayments/webhook \
  -H "Content-Type: application/json" \
  -d '{"payment_id":"test_stale_lock","payment_status":"finished","price_amount":29,"price_currency":"usd"}'

# 3. Xác minh lock đã biến mất
npx wrangler d1 execute sophia-raas-db --remote \
  --command "SELECT * FROM payment_events WHERE event_id = 'test_stale_lock'"
# Mong đợi: không kết quả (lock đã bị xóa)
```

---

## Kịch bản 3: DLQ (Dead-Letter Queue) phát triển quá lớn

### ❌ Failure — Lỗi xảy ra

- Nhiều IPN thất bại cùng lúc
- DLQ (`ipn_dead_letter_queue`) gần đầy hoặc đã đầy (giới hạn 1000)
- IPN mới bị từ chối → lưu vào `payment_events_dropped`
- Khách hàng không được kích hoạt tier

### ✅ Detection — Phát hiện

| Cờ báo | Mức độ | Hành động |
|-------|-------|----------|
| DLQ >= 500 (50%) | Cảnh báo | Theo dõi — Sentry log cảnh báo màu vàng |
| DLQ >= 900 (90%) | Nghiêm trọng | Kiểm tra NOWPayments trạng thái ngay |
| DLQ >= 1000 (100%) | Khẩn cấp | Dừng nhận — chuyển sang `payment_events_dropped` |

### 🔧 Recovery — Khắc phục

1. **Kiểm tra số DLQ hiện tại**:
```bash
cd apps/sophia-ai-factory
npx wrangler d1 execute sophia-raas-db --remote \
  --command "SELECT COUNT(*) as count FROM ipn_dead_letter_queue WHERE resolved = 0"
```

2. **Kiểm tra events đã bị loại bỏ** (nếu DLQ đã đầy):
```bash
npx wrangler d1 execute sophia-raas-db --remote \
  --command "SELECT COUNT(*) as count, MIN(dropped_at), MAX(dropped_at) FROM payment_events_dropped"
```

3. **Giải phóng DLQ**:
   - Cách 1: **DLQ Reaper (tự động)** — Inngest chạy hàng giờ (`0 * * * *`), tự động re-enqueue các entry cũ > 1 giờ
   - Cách 2: **Thủ công** — sử dụng admin endpoint `/api/admin/dlq/reconciliation` (nếu có)

4. **Xử lý các event đã bị loại bỏ**:
   - Nếu DLQ đầy, các IPN mới được lưu vào `payment_events_dropped` thay vì DLQ
   - Admin cần manually replay các dropped events này

### ⚠️ Cảnh báo quan trọng

- **Không xóa DLQ entries trực tiếp** — mỗi entry cần được xử lý hoặc đánh dấu `resolved = 1`
- **Nếu NOWPayments đang gặp sự cố**: Chờ NOWPayments phục hồi trước — tự retry sẽ xử lý các IPN trễ

### 🧪 Test — Kiểm tra

```bash
# 1. Kiểm tra DLQ Reaper đang chạy
cd apps/sophia-ai-factory
wrangler tail --format pretty | grep -i "DLQReaper"

# 2. Manually trigger DLQ Reaper qua Inngest (nếu cần)
# Inngest Dashboard → Functions → dlq-reaper → Send Test Event

# 3. Xác minh DLQ không đầy sau khi Reaper chạy
npx wrangler d1 execute sophia-raas-db --remote \
  --command "SELECT COUNT(*) FROM ipn_dead_letter_queue WHERE resolved = 0"
```

---

## Kịch bản 4: Tier activation thất bại sau khi IPN xử lý

### ❌ Failure — Lỗi xảy ra

- IPN `finished` được xử lý thành công
- Nhưng tier của khách không được cập nhật trong D1
- Khách không được cấp quyền mới

### ✅ Detection — Phát hiện

| Cách | Mô tả |
|------|-------|
| Khách báo | "Tôi đã trả tiền nhưng không được dùng tính năng Master" |
| D1 audit | `tier-change-provisioner` chưa chạy hoặc lỗi |
| payment_events | `processed = 1` nhưng bảng `user_tiers` không cập nhật |

### 🔧 Recovery — Khắc phục

1. **Kiểm tra trạng thái payment trong D1**:
```bash
npx wrangler d1 execute sophia-raas-db --remote \
  --command "SELECT event_id, processed FROM payment_events WHERE event_type = 'nowpayments.finished' ORDER BY created_at DESC LIMIT 5"
```

2. **Kiểm tra tier hiện tại của khách**:
```bash
npx wrangler d1 execute sophia-raas-db --remote \
  --command "SELECT user_id, tier FROM user_tiers WHERE user_id = '<USER_ID>'"
```

3. **Kích hoạt tier thủ công** (nếu cần):
   - Điều này cần làm thông qua admin interface hoặc trực tiếp D1
   - Lưu ý: Chỉ làm khi đã xác nhận khách đã thanh toán (kiểm tra NOWPayments dashboard)

### 🧪 Test — Kiểm tra

```bash
# Xác minh tier activation chain hoạt động
# 1. IPN finished → payment_events processed = 1
# 2. tier-change-provisioner chạy → user_tiers updated
# 3. Khách thấy tier mới ngay lập tức

# Check audit log cho tier changes
npx wrangler d1 execute sophia-raas-db --remote \
  --command "SELECT * FROM audit_events WHERE action LIKE '%tier%' ORDER BY created_at DESC LIMIT 5"
```

---

## Architecture: Hệ thống tự phục hồi

```
IPN Incoming
    │
    ├─ Atomic Lock (INSERT ON CONFLICT)
    │   ├─ Lock owned → Process → Mark done
    │   ├─ Already processed → Return OK
    │   └─ Stale (>5min) → DELETE lock → Return retry
    │
    ├─ Processing
    │   ├─ Success → Mark processed = 1
    │   └─ Failure
    │       ├─ Transient (network) → Release lock → NOWPayments retries
    │       └─ Permanent (schema/validation) → DLQ (max 3 retries)
    │
    └─ DLQ (1000 entries max)
        ├─ <50% → Log warning
        ├─ 50-90% → Log alert
        ├─ ≥90% → Log critical
        ├─ ≥100% → Drop to payment_events_dropped
        └─ DLQ Reaper (hourly) → Re-enqueue stale entries
```

---

## Quick Reference

| Sự cố | Mức độ | Ai xử lý | Thời gian phục hồi |
|-------|-------|---------|-------------------|
| IPN IPN đến trễ | Trung bình | NOWPayments tự retry | 15-30 phút |
| Stale lock | Tự phục hồi | Hệ thống tự xử lý (5 phút) | 5 phút |
| DLQ 50-90% | Cảnh báo | Theo dõiSentinel cảnh báo | DLQ Reaper hàng giờ |
| DLQ ≥100% | Khẩn cấp | Admin reconcile | 1-4 giờ |
| Tier activation thất bại | Trung bình | Admin kiểm tra + kích hoạt thủ công | 15-30 phút |
| NOWPayments IPN Secret lỗi | Khẩn cấp | Xoay vòng secret | 10-15 phút |

---

## Liên kết liên quan

- `src/land/billing/nowpayments-ipn-handlers.ts` — Main IPN dispatcher
- `src/land/billing/nowpayments-ipn-dead-letter.ts` — DLQ management
- `src/forest/inngest/functions/dlq-reaper.ts` — DLQ Reaper Inngest function
- `src/land/billing/nowpayments-ipn-dropped-events.ts` — Dropped events tracking
- `docs/runbooks/secret-rotation-runbook.md` — NOWPAYMENTS_IPN_SECRET rotation
- `docs/RUNBOOKS.md` — General operational procedures
