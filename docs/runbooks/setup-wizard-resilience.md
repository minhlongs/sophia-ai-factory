# Setup Wizard Resilience Runbook / Bảng xử lý sự cố thiết lập

> **Protected Flow 1** — BYOK API key onboarding (OpenRouter, ElevenLabs, D-ID, HeyGen)
> Hướng dẫn này trả lời: "Điều gì xảy ra khi nhà cung cấp AI bị sập? Khi hết hạn? Khi cần đổi mã khóa bảo mật?"

---

## Tổng quan / Overview

Setup Wizard là cánh cổng duy nhất để khách hàng nhập API keys (OpenRouter, ElevenLabs, D-ID, HeyGen). Khách hàng tự làm — không cần người vận hành. Keys được mã hóa AES-256 và lưu trong D1.

---

## Kịch bản 1: OpenRouter bị sập (API down)

### ❌ Failure — Lỗi xảy ra

- OpenRouter trả lỗi `5xx` hoặc timeout
- Khách hàng bấm "Generate" trong Wizard → thất bại
- Phiên làm việc tạm dừng, không lưu key

### ✅ Detection — Phát hiện

| Cách | Mô tả |
|------|-------|
| Khách báo | "Tôi không tạo được video" |
| Sentry tag | `byok_provider=openrouter`, lỗi `BYOKTimeoutError` (timeout sau 25 giây) |
| D1 signals | Bảng `byok_call` ghi nhận `status_code = 0` hoặc `status_code >= 500` |

### 🔧 Recovery — Khắc phục

1. **Kiểm tra trạng thái OpenRouter**: Truy cập [status.openrouter.ai](https://status.openrouter.ai) hoặc Twitter/X của @openrouterai
2. **Thông báo cho khách**: "Hệ thống AI tạm ngưng — đang chờ nhà cung cấp phục hồi. Bạn có thể thử lại sau 15 phút."
3. **Nhắc khách lưu key của họ**: Khách nên copy OpenRouter key ra nơi an toàn — nếu OpenRouter hư hỏng lâu, khách có thể chuyển sang Anthropic/OpenAI (hỗ trợ bởi platform)
4. **Giám sát**: Inngest không tự retry (khách tự retry). Mỗi lần thất bại ghi vào D1 signal. Không cần hành động kỹ thuật cho tới OpenRouter phục hồi.

### 🧪 Test — Kiểm tra

```bash
# Mô phỏng OpenRouter down — kiểm tra timeout guard
# (chỉ chạy trong môi trường dev/test)
curl -s http://localhost:3000/api/health | grep -o '"status":"ok"'
```

**Chuẩn phục hồi**: OpenRouter trả HTTP 200, Sentry ngừng báo `BYOKTimeoutError` trong 15 phút.

---

## Kịch bản 2: D-ID key hết hạn (expired)

### ❌ Failure — Lỗi xảy ra

- D-ID từ chối request với HTTP 401 hoặc 403
- Video avatar generation thất bại
- Khách nhận thông báo lỗi "Invalid D-ID API key"

### ✅ Detection — Phát hiện

| Cách | Mô tả |
|------|-------|
| Khách báo | "Avatar video không tạo được" |
| Sentry tag | `byok_provider=d-id`, lỗi HTTP 401/403 trên `byok_call` |
| D1 signal | `byok_call` → `status_code: 401` |

### 🔧 Recovery — Khắc phục

1. **Nhắn khách hàng** (qua Telegram bot hoặc email): "Key D-ID của bạn đã hết hạn. Vui lòng cập nhật key mới trong **Cài đặt → Video Configuration**."
2. **Hướng dẫn khách tự làm**:
   - Đăng nhập [studio.d-id.com](https://studio.d-id.com) → Settings → API → Tạo key mới
   - Vào Sophia Dashboard → Settings → **D-ID API Key** → Dán key mới
   - Nhấn **Lưu** → hệ thống mã hóa và lưu tự động
3. **Xác minh**: Sau khi khách cập nhật, gửi lại một video avatar nhỏ. Nếu thành công → đã khắc phục.

> ⚠️ Không bao giờ yêu cầu khách gửi key qua Telegram/email — chỉ hướng dẫn nhập trong dashboard.

### 🧪 Test — Kiểm tra

```bash
# Trong dev: dùng key giả → xác nhận timeout guard bắt 401
# Vào dashboard → Settings → nhập đúng key → submit → kiểm tra /api/health
```

---

## Kịch bản 3: Mã khóa bảo mật cần xoay vòng (master key rotation)

### ❌ Failure — Lỗi xảy ra

- `BYOK_MASTER_KEY` (mã khóa 256-bit mã hóa tất cả customer keys) cần thay đổi:
  - Hết hạn theo lịch (90 ngày)
  - Nghi ngờ bị lộ (compromise)
  - Nâng cấp độ mạnh của mã khóa
- Nếu không xoay vòng: tất cả keys đối tác (OpenRouter, ElevenLabs, D-ID) của khách hàng bị lộ nếu mã khóa bị lấy

### ✅ Detection — Phát hiện

| Cách | Mô tả |
|------|-------|
| Inngest cron | `key-rotation-cron` chạy `0 0 1 */3 *` (ngày 1 hàng quý) — kiểm tra key version > 90 ngày |
| Maintenance plan | Lịch xoay vòng đã lên kế hoạch (xem `docs/runbooks/secret-rotation-runbook.md`) |
| Compromise | Có dấu hiệu truy cập trái phép vào BYOK_MASTER_KEY |

### 🔧 Recovery — Xoay vòng tự động (có sẵn)

**Hệ thống tự động xử lý — không cần tác vụ thủ công:**

1. **Cron tự động kích hoạt** (`key-rotation-cron` — chạy hàng quý):
   - Kiểm tra key version mới nhất
   - Nếu > 90 ngày tuổi → tạo version mới, lưu vào D1
   - Gửi event `key.rotation.requested` đến Inngest

2. **Inngest tự động mã hóa lại** (`key-rotation-reencrypt`):
   - Đọc từng key của khách hàng (3 loại: `user_api_keys`, `user_provider_credentials`, `platform_credentials`)
   - Giải mã bằng key cũ → mã hóa lại bằng key mới
   - Cập nhật `key_version` cho mỗi dòng
   - "Dual-decrypt window" 7 ngày: trong 7 ngày, hệ thống vẫn giải mã được cả key cũ lẫn mới → không gián đoạn

3. **Khách hàng không biết gì**: Toàn bộ diễn ra trong nền. Khách vẫn dùng bình thường.

### Cửa sổ đôi (Dual-Decrypt Window)

```
Ngày 1-7:  Hệ thống đọc cả key CŨ và MỚI → khách không bị ảnh hưởng
Ngày 8+:   Chỉ đọc key MỚI → key CŨ có thể bị xóa
```

**Cấu hình**: `DUAL_DECRYPT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000` (từ `@/tree/byok/byok-crypto`)

### 🔧 Recovery — Xoay vòng thủ công (khẩn cấp)

Nếu cần xoay vòng ngay (không chờ cron):

```bash
# Bước 1: Tạo mã khóa mới (chạy 1 lần, giữ kết quả an toàn)
cd apps/sophia-ai-factory
npx tsx -e "
  import { generateMasterKey } from '@/tree/byok/byok-crypto';
  generateMasterKey().then(k => console.log('NEW BYOK_MASTER_KEY:', k));
"

# Bước 2: Cập nhật CF Worker secret (mã khóa mới có hiệu lực ngay)
npx wrangler secret put BYOK_MASTER_KEY --name sophia-ai-factory

# Bước 3: Kích hoạt Inngest xoay vòng toàn bộ
# (trigger event qua Inngest dashboard hoặc API)
```

### ⚠️ Lưu ý quan trọng

| Tình huống | Hành động |
|-----------|-----------|
| Tự động (hàng quý) | Không cần làm gì — cron + Inngest tự xử lý |
| Khẩn cấp (nghi ngờ lộ) | Xoay vòng thủ công theo 3 bước trên |
| Sau khi xoay vòng | Giữ key CŨ thêm 7 ngày rồi mới xóa (dual-decrypt window) |

### 🧪 Test — Kiểm tra

```bash
# Xác minh version mới đang active
cd apps/sophia-ai-factory
npx tsx -e "
  import { getActiveKeyVersion } from '@/tree/byok/byok-crypto';
  getActiveKeyVersion().then(v => console.log('Active key version:', v));
"

# Xác nhận xoay vòng thành công — khách hàng vẫn login và tạo video được
curl -s https://sophia.agencyos.network/api/health

# Kiểm tra audit log (id: key_rotation.reencrypt_complete)
```

---

## Kịch bản 4: ElevenLabs / HeyGen tương tự

Hai nhà cung cấp còn lại tuân theo cùng quy trình với D-ID:

| Nhà cung cấp | Dashboard khách cập nhật | Sentry tag |
|--------------|--------------------------|-----------|
| ElevenLabs | Settings → Voice Config | `byok_provider=elevenlabs` |
| HeyGen | Settings → Video Config | `byok_provider=heygen` |

---

## Quick Reference

| Sự cố | Mức độ | Ai xử lý | Thời gian phục hồi |
|-------|-------|---------|-------------------|
| OpenRouter down | Nhà cung cấp | Theo dõi | Khi OpenRouter phục hồi |
| D-ID key hết hạn | Khách hàng | Hướng dẫn khách | 1-5 phút (khách tự xử lý) |
| Master key hết hạn | Hệ thống | Tự động (Inngest) | 7 ngày dual-decrypt (không gián đoạn) |
| Master key bị lộ | Khẩn cấp | Xoay vòng thủ công | 15-30 phút |

---

## Liên kết liên quan

- `docs/runbooks/secret-rotation-runbook.md` — Danh sách đầy đủ secrets + lịch xoay vòng
- `src/tree/byok/byok-crypto.ts` — Mã nguồn mã hóa/giải mã BYOK
- `src/forest/inngest/functions/key-rotation-reencrypt.ts` — Inngest xoay vòng tự động
