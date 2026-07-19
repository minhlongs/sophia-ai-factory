# Telegram Bot Resilience Runbook / Bảng xử lý sự cố Telegram Bot

> **Protected Flow 2** — @Sophia_Bbot (`/campaign`, `/status`, `/results`)
> Hướng dẫn này trả lời: "Điều gì xảy ra khi Inngest sập? Khi D1 lỗi? Khi webhook Telegram gửi thất bại?"

---

## Tổng quan / Overview

@Sophia_Bbot hoạt động qua Telegram webhook. Khi khách nhắn `/campaign`, hệ thống:
1. Telegram gửi update đến `/api/webhooks/telegram` (Cloudflare Worker)
2. Webhook xử lý lệnh → gọi forest (orchestrator)
3. Forest gọi Inngest cho tác vụ dài (tạo campaign, video)
4. Kết quả gửi về khách qua Telegram

---

## Kịch bản 1: Inngest bị sập / không phản hồi

### ❌ Failure — Lỗi xảy ra

- Inngest cloud service ngừng hoạt động hoặc không nhận event
- Tác vụ dài (tạo campaign, tạo video) không chạy
- Khách nhận "Đang xử lý..." nhưng không bao giờ nhận kết quả

### ✅ Detection — Phát hiện

| Cách | Mô tả |
|------|-------|
| Khách báo | "Bot báo đang xử lý nhưng không có kết quả sau 10 phút" |
| Inngest dashboard | Hiển thị "Service Unavailable" hoặc event không được nhận |
| Cloudflare Worker logs | `wrangler tail` → thiếu log `[Inngest] event sent` |
| Timeout đơn giản | Nếu video generate > 30 phút chưa xong → có vấn đề |

### 🔧 Recovery — Khắc phục

1. **Kiểm tra trạng thái Inngest**: Truy cập [inngest.com/status](https://inngest.com/status) hoặc check Cloudflare Dashboard → Workers → inngest
2. **Kích hoạt fallback (nếu có)**: Kiểm tra xem có cron backup nào đang chạy. Một số operations có thể chạy thủ công.
3. **Giám sát hàng đợi**: Nếu nhiều event tắc nghẽn trong Inngest, chúng sẽ xử lý theo thứ tự khi Inngest phục hồi (at-least-once delivery).
4. **Thông báo cho khách**: "Hệ thống xử lý đang bận. Kết quả sẽ gửi đến bạn tự động khi xong — không cần làm gì thêm."

### 🧪 Test — Kiểm tra

```bash
# Kiểm tra Inngest có nhận event không (xem Worker logs)
cd apps/sophia-ai-factory
wrangler tail --format pretty | grep -i inngest

# Gửi lệnh thử vào bot Telegram rồi kiểm tra log
```

---

## Kịch bản 2: Cơ sở dữ liệu D1 gặp sự cố

### ❌ Failure — Lỗi xảy ra

- D1 database mất kết nối hoặc trả lỗi lâu
- Lệnh `/status` đọc dữ liệu khách → lỗi
- Lệnh `/campaign` ghi chiến dịch mới → lỗi
- Tất cả lệnh đọc/ghi đều thất bại

### ✅ Detection — Phát hiện

| Cách | Mô tả |
|------|-------|
| Cloudflare Dashboard | D1 hiển thị "Degraded" hoặc "Unavailable" |
| `/api/health` | Trả lỗi database connection |
| Telegram bot | Trả lỗi chung "Đang có sự cố kỹ thuật" |
| `wrangler d1 list` | Kiểm tra DB status |

### 🔧 Recovery — Khắc phục

1. **Kiểm tra D1 status**: Cloudflare Dashboard → D1 → sophia-raas-db
2. **Nếu D1 đang bảo trì**: Chờ Cloudflare hoàn tất (thường < 15 phút)
3. **Nếu D1 bị lỗi nghiêm trọng**: Khôi phục từ bản sao R2 (xem `docs/runbooks/secret-rotation-runbook.md` phần backup)
4. **Giảm tải**: Nếu quá nhiều request cùng lúc, bot có thể trả "Vui lòng thử lại sau 1 phút"
5. **Thông báo**: Nếu có thể, gửi thông báo thoáng đến khách qua channel khác (email)

### 🧪 Test — Kiểm tra

```bash
# Kiểm tra kết nối D1
cd apps/sophia-ai-factory
npx wrangler d1 info sophia-raas-db --remote

# Sau khi khôi phục: kiểm tra truy vấn đơn giản
echo "SELECT 1" | npx wrangler d1 execute sophia-raas-db --remote
```

---

## Kịch bản 3: Webhook Telegram gửi thất bại

### ❌ Failure — Lỗi xảy ra

- Telegram server không gửi được update đến Worker
- Webhook bị mất (do deploy mới, thay đổi token, v.v.)
- Khách gửi lệnh → bot không trả lời gì

### ✅ Detection — Phát hiện

| Cách | Mô tả |
|------|-------|
| Khách báo | "Bot không trả lời" |
| Telegram | Gửi tin nhắn vào @Sophia_Bbot → không có phản hồi |
| Webhook URL | Kiểm tra bằng cách gửi request trực tiếp |
| BotFather | `/mybots` → kiểm tra webhook URL |

### 🔧 Recovery — Khắc phục

1. **Kiểm tra webhook đã đăng ký chưa**:

```bash
# Kiểm tra webhook hiện tại
curl -s "https://api.telegram.org/bot<TOKEN>/getWebhookInfo" | python3 -m json.tool
# Mong đợi: "url": "https://sophia.agencyos.network/api/webhooks/telegram"
```

2. **Nếu webhook URL sai hoặc mất → đăng ký lại**:

```bash
WEBHOOK_URL="https://sophia.agencyos.network/api/webhooks/telegram"
curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook?url=${WEBHOOK_URL}"
# Mong đợi: {"ok":true,"description":"Webhook was set"}
```

3. **Nếu vẫn không hoạt động**: Kiểm tra CF Worker có đang chạy phiên bản mới không → chạy `npm run deploy:full`

4. **Gửi test message từ Telegram**: Nhắn `/status` vào @Sophia_Bbot → trả lời trong 30 giây = OK

### 🧪 Test — Kiểm tra

```bash
# 1. Xác minh webhook đã đăng ký
curl -s "https://api.telegram.org/bot${TOKEN}/getWebhookInfo"
# Kiểm tra: url đúng, has_custom_certificate = false (Cloudflare tự xử lý cert)

# 2. Gửi test update (giả lập)
curl -s -X POST "https://api.telegram.org/bot${TOKEN}/sendMessage" \
  -d "chat_id=YOUR_CHAT_ID&text=/status"

# 3. Kiểm tra bot phản hồi trong Telegram
```

---

## Kịch bản 4: Nhiều khách cùng gửi lệnh (quá tải bot)

### ❌ Failure — Lỗi xảy ra

- 100+ khách cùng gửi `/campaign` cùng lúc
- Rate limit của Telegram hoặc Worker bị chạm
- Một số khách không nhận được phản hồi

### ✅ Detection — Phát hiện

| Cách | Mô tả |
|------|-------|
| `wrangler tail` | Thấy rate limit errors |
| Sentry | `RateLimitError` từ Telegram API |
| Khách báo | "Bot đôi khi không trả lời" |

### 🔧 Recovery — Khắc phục

1. **Kiểm tra rate limit hiện tại**: Telegram cho phép ~30 msg/giây cho bot
2. **Nếu vượt rate limit**: Hệ thống tự động retry với backoff — không cần hành động thủ công
3. **Nếu Worker bị chặn**: Thông báo cho khách "Hệ thống đang bận — vui lòng thử lại sau 2 phút"

### 🧪 Test — Kiểm tra

```bash
# Kiểm tra Worker request count
# Cloudflare Dashboard → Workers → sophia-ai-factory → Metrics → Requests
```

---

## Quick Reference

| Sự cố | Mức độ | Ai xử lý | Thời gian phục hồi |
|-------|-------|---------|-------------------|
| Inngest down | Nhà cung cấp | Theo dõi | Khi Inngest phục hồi (event queue tự replay) |
| D1 down | Cloudflare | Chờ phục hồi | 5-15 phút |
| Webhook mất | Người vận hành | Đăng ký lại | 2-5 phút |
| Quá tải bot | Tự điều chỉnh | Theo dõi | Tự hồi phục |

---

## Lệnh Telegram khác

| Lệnh | Chức năng | Xử lý lỗi tương tự |
|-------|----------|-------------------|
| `/start` | Liên kết tài khoản | Nếu không link được → hướng dẫn nhập email |
| `/email` | Cập nhật email liên kết | Lỗi → kiểm tra D1 |
| `/status` | Xem trạng thái chiến dịch | Đọc từ D1 → xem kịch bản D1 |
| `/results` | Xem kết quả video | Đọc từ D1/R2 → xem kịch bản D1 |
| `/campaign` | Tạo chiến dịch mới | Gọi Inngest → xem kịch bản Inngest |

---

## Liên kết liên quan

- `src/app/api/webhooks/telegram/route.ts` — Webhook handler chính
- `src/forest/telegram/analytics-commands.ts` — Bot commands orchestrator
- `docs/telegram-bot-setup.md` — Hướng dẫn cài đặt ban đầu
