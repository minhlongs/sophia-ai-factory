import { GuideContentRenderer } from "@/components/guide/guide-content-renderer";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Telegram Bot — Hướng Dẫn Sophia AI Factory",
  description: "Cách sử dụng bot @Sophia_Bbot trên Telegram để tạo video",
};

const content = `# Hướng Dẫn Telegram Bot

> Điều khiển chiến dịch từ điện thoại với @Sophia_Bbot

---

## 1. Cài Đặt Telegram

1. Mở **App Store** (iPhone) hoặc **Google Play** (Android)
2. Tìm kiếm **"Telegram"**
3. Nhấn **"Cài Đặt"**
4. Mở ứng dụng Telegram sau khi cài xong
5. Đăng ký tài khoản bằng số điện thoại

> Nếu bạn đã có Telegram, bỏ qua bước này.

---

## 2. Kết Nối Với @Sophia_Bbot

1. Mở Telegram trên điện thoại
2. Nhấn vào **biểu tượng kính lúp** (tìm kiếm) ở góc phải trên
3. Nhập: \`@Sophia_Bbot\`
4. Nhấn vào kết quả **"Sophia Bbot"** (có biểu tượng bot)
5. Nhấn nút **"START"**
6. Bot sẽ gửi tin nhắn chào mừng bạn
7. Nhập lệnh: \`/link\`
8. Bot sẽ hỏi email — nhập email bạn dùng để đăng ký Sophia
9. Bot gửi mã xác nhận 6 số về email bạn
10. Nhập mã xác nhận vào Telegram
11. **"Kết nối thành công!"** — bạn đã sẵn sàng!

---

## 3. Các Lệnh Bot

### /campaign — Tạo Video Mới

1. Nhập: \`/campaign\`
2. Bot hỏi tên chiến dịch — nhập tên
3. Bot hỏi chọn mẫu video — chọn từ danh sách
4. Bot hỏi nội dung chính — nhập nội dung
5. Bot hỏi giọng nói — chọn nam hoặc nữ
6. Đợi 2-5 phút, bot thông báo khi xong

---

### /status — Kiểm Tra Trạng Thái

Nhập \`/status\` để xem trạng thái tất cả chiến dịch.

Trạng thái:
- **Đang xử lý** (vàng)
- **Hoàn thành** (xanh)
- **Lỗi** (đỏ)

---

### /results — Xem Kết Quả

Nhập \`/results\` để tải video hoàn thành.

---

### /start và /stop — Bắt Đầu và Dừng

- \`/start\` — Tiếp tục chiến dịch đã tạm dừng
- \`/stop\` — Tạm dừng chiến dịch đang chạy

---

### /help — Xem Trợ Giúp

Nhập \`/help\` để xem tất cả lệnh có sẵn.

---

## 4. Bảng Tóm Tắt

| Lệnh | Chức năng |
|---|---|
| \`/link\` | Kết nối tài khoản |
| \`/campaign\` | Tạo video mới |
| \`/status\` | Kiểm tra trạng thái |
| \`/results\` | Xem kết quả |
| \`/start\` | Tiếp tục chiến dịch |
| \`/stop\` | Tạm dừng chiến dịch |
| \`/help\` | Trợ giúp |

---

## 5. Mẹo Sử Dụng

- Bạn có thể gửi lệnh **bất kỳ lúc nào**, 24/7
- Khi video xong, bot **tự động gửi thông báo**
- Nếu bot không trả lời trong 30 giây, thử nhập lại lệnh
- Mọi lệnh bắt đầu bằng dấu \`/\`

---

## Cần Hỗ Trợ?

| Kênh | Liên hệ |
|---|---|
| Telegram | \`/help\` trong @Sophia_Bbot |
| Email | support@agencyos.network |
| FAQ | [Câu hỏi thường gặp](/guide/faq) |
| Bắt đầu | [Hướng dẫn sử dụng](/guide) |
`;

export default function TelegramGuidePage() {
  return <GuideContentRenderer content={content} />;
}
