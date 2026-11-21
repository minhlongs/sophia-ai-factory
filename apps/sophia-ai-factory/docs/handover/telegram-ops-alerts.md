# Cảnh báo vận hành Telegram / Telegram operations alerts

## Phạm vi / Scope

VI: Tùy chọn cho nhóm vận hành nền tảng, không phải bước thiết lập của khách hàng. Mặc định tắt; ứng dụng vẫn hoạt động khi chưa cấu hình. Không đổi bot khách hàng, thanh toán hay Setup Wizard. Không bật PayOS.

EN: Optional platform operations channel, not customer onboarding. Disabled by default; missing configuration does not block the app. Customer bot, payments and Setup Wizard are unchanged. PayOS is not enabled.

| Nguồn / Origin | Trước / Before | Nay / Now |
|---|---|---|
| Kiểm tra đơn thử / Synthetic fulfillment | Slack | Optional ops Telegram |
| Mission thất bại / Mission failure | Shared customer Telegram credentials | Separate ops Telegram |
| Gián đoạn dịch vụ / Uptime incident | Legacy admin Telegram | Separate ops Telegram |
| Tổng hợp lỗi / Error digest | Raw report to admin Telegram | Fixed ops event only; email unchanged |

VI: Bản tin kinh doanh hàng tuần và thông báo khách hàng không thuộc đợt chuyển này. Sentry tiếp tục theo dõi lỗi; không tự chuyển quy tắc Sentry bên ngoài sang Telegram.

EN: Weekly business intelligence and customer notifications are outside this migration. Sentry error tracking remains enabled; external Sentry alert rules are not automatically migrated.

## Cấu hình cục bộ / Local configuration

1. VI: Trong cấu hình máy chủ cục bộ, giữ `OPS_ALERT_PROVIDER=disabled` nếu không cần thông báo. EN: Keep `OPS_ALERT_PROVIDER=disabled` in local server configuration when alerts are not needed.
2. VI: Chỉ khi đã được phép, đặt `OPS_ALERT_PROVIDER=telegram`, `TELEGRAM_OPS_BOT_TOKEN` và `TELEGRAM_OPS_CHAT_ID` cho bot/phòng riêng của nhóm vận hành. Không dùng khóa bot khách hàng; không đưa khóa vào mã hoặc ảnh chụp. EN: Only when authorized, set those three variables for a separate operations bot/chat. Never reuse customer bot credentials or put secrets in source/screenshots.
3. VI: Khởi động lại máy chủ. Không có lệnh gửi thử trực tiếp trong tài liệu này. EN: Restart the local server. This guide does not initiate a live test send.

VI: Cloudflare đọc cùng tên từ runtime bindings; nếu có bindings, chúng là nguồn quyết định, không lấy khóa cục bộ để bù. Không thay cấu hình production trong công việc này.

EN: Cloudflare uses the same names from runtime bindings, which are authoritative when present; local credentials do not fill missing Worker values. No production configuration is changed here.

## Kích hoạt sau này, khi được duyệt / Future activation after approval

1. VI: Nhờ BotFather tạo bot vận hành riêng; lưu khóa bằng cơ chế bí mật của môi trường máy chủ, không trong git, tin nhắn nhóm hay ảnh chụp. EN: Create a dedicated operations bot through BotFather; store its token in the server environment secret mechanism, never git, group messages or screenshots.
2. VI: Chọn cuộc trò chuyện riêng hoặc nhóm riêng đã được người phụ trách chấp thuận; thêm bot mới. EN: Choose an explicitly approved private conversation or private group and add the new bot.
3. VI: Người phụ trách xác minh mã chat bằng công cụ Telegram được phê duyệt dành riêng bot mới; không dùng bot khách hàng, không thay webhook và không gọi getUpdates trên bot đang dùng. Không dán URL chứa khóa vào trình duyệt/log/ticket. EN: Verify the chat ID through an approved Telegram tool for the new dedicated bot only; do not use the customer bot, alter its webhook or poll getUpdates on a shared bot. Never paste token-bearing URLs into browser history, logs or tickets.
4. VI: Chỉ sau khi duyệt rõ bot và phòng nhận, người vận hành cấu hình ba biến trên qua cơ chế bí mật rồi cho phép đúng một thông báo thử không dữ liệu khách hàng. Kiểm tra người nhận và kết quả thật; tài liệu này không thực hiện bước đó. EN: Only after explicit bot/destination approval, configure the three variables through the secret mechanism and authorize exactly one customer-data-free smoke message. Verify the actual receiver and delivery result; this local change does not perform that step.
5. VI: Muốn tắt, đặt lại `OPS_ALERT_PROVIDER=disabled` và khởi động lại. EN: To disable, restore `OPS_ALERT_PROVIDER=disabled` and restart.

## Nội dung và kết quả / Content and results

VI: Chỉ gửi mức độ, môi trường, loại sự kiện cố định, mã sự cố và liên kết bảng điều khiển yêu cầu đăng nhập. Không gửi lỗi gốc, báo cáo, khóa, nội dung khách hàng hoặc đích từ dữ liệu sự kiện. Tin nhắn văn bản ngắn, không HTML/Markdown. Múi giờ bàn giao: Asia/Saigon; thông báo không chứa thời gian suy đoán.

EN: Sends only severity, environment, fixed event type, incident reference and a sign-in-protected dashboard link. No raw error/report, key, customer content or event-supplied destination. Messages are short plain text, not HTML/Markdown. Handover timezone: Asia/Saigon; alerts contain no inferred timestamps.

VI: Một lần gửi, giới hạn 5 giây bao gồm đọc phản hồi. Chỉ báo `sent:true` khi HTTP thành công, JSON `ok:true`, có mã tin nhắn và phòng nhận đúng cấu hình. Tắt/thiếu cấu hình không gọi mạng. Không quay về Slack hoặc email khi Telegram thất bại.

EN: One attempt with a 5-second deadline including response parsing. `sent:true` requires successful HTTP, JSON `ok:true`, a message ID and matching destination chat. Disabled/missing configuration makes no delivery request. No Slack or email fallback on Telegram failure.

VI: Không tự gửi lại, không hàng đợi mới. Inngest consumer cảnh báo có `retries:0`. HTTP/JSON 429 trả `rate_limited` và `retryAfterSeconds` (60 giây nếu phản hồi không hợp lệ); circuit breaker hiện có giữ thời gian chờ trong cùng tiến trình. Đây không phải lịch gửi lại bền vững giữa các Worker; khởi động lại có thể mất trạng thái chờ. Không có khử trùng lặp mới. Một số cron không dùng kết quả gửi: cron chạy xong không đồng nghĩa đã báo Telegram. Lỗi thông báo không chạy lại nội dung đã giao hay tính lại MCU.

EN: No automatic retry and no new queue. The Inngest notification consumer has `retries:0`. HTTP/JSON 429 returns `rate_limited` and `retryAfterSeconds` (60 seconds for malformed responses); the existing circuit breaker holds the cooldown within the process. This is not durable cross-Worker retry scheduling; restart may lose cooldown state. No new deduplication is claimed. Some cron callers ignore delivery results: cron completion does not prove Telegram delivery. Notification failure does not replay delivered content or MCU accounting.

VI: URL chứa khóa Telegram được lọc khỏi Sentry events/breadcrumbs/spans/transactions; OTel bỏ riêng fetch Bot API Telegram. Không ghi ngoại lệ gửi thô vào log.

EN: Telegram credential URLs are scrubbed from Sentry events/breadcrumbs/spans/transactions; OTel excludes Telegram Bot API fetch spans only. Raw delivery exceptions are not logged.
