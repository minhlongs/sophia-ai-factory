import { GuideContentRenderer } from "@/components/guide/guide-content-renderer";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Lệnh Telegram Bot — Hướng Dẫn Sophia AI Factory",
  description: "Danh sách đầy đủ các lệnh bot Telegram của Sophia",
};

const content = `# Lệnh Bot Telegram

Sophia có bot Telegram giúp bạn quản lý mọi thứ từ điện thoại.
**Bot:** @Sophia_Bbot

---

## Bắt Đầu Nhanh

1. Mở Telegram
2. Tìm kiếm **@Sophia_Bbot** (hoặc dùng link: [t.me/Sophia_Bbot](https://t.me/Sophia_Bbot))
3. Nhấn **"Start"**
4. Liên kết email của bạn: \`/email your@email.com\`

---

## Danh Sách Lệnh

| Lệnh | Chức năng | Ví dụ |
|---------|-------------|---------|
| \`/start\` | Tin nhắn chào mừng + thiết lập | \`/start\` |
| \`/email\` | Liên kết tài khoản Sophia | \`/email john@example.com\` |
| \`/campaign\` | Tạo chiến dịch video mới | \`/campaign Đánh giá thiết bị thân thiện môi trường\` |
| \`/status\` | Kiểm tra chiến dịch đang chạy | \`/status\` |
| \`/results\` | Lấy link video đã hoàn thành | \`/results\` |
| \`/help\` | Xem tất cả lệnh | \`/help\` |

---

## Cách Tạo Video Qua Telegram

**Bước 1:** Đảm bảo tài khoản đã được liên kết (\`/email\`)

**Bước 2:** Nhập \`/campaign\` theo sau là chủ đề video

**Bước 3:** Sophia sẽ viết kịch bản, tạo giọng nói, tạo video avatar

**Bước 4:** Nhập \`/status\` để kiểm tra tiến độ

**Bước 5:** Nhập \`/results\` để lấy link YouTube khi xong

---

## Mẹo Hay

- **Mô tả chủ đề cụ thể:** \`/campaign Top 5 tai nghe không dây dưới 1 triệu đánh giá\` tốt hơn \`/campaign tai nghe\`
- **Kiểm tra trạng thái thường xuyên:** chiến dịch mất 5-10 phút để hoàn thành
- **Dữ liệu thuộc về bạn** — video được đăng trực tiếp lên kênh YouTube CỦA BẠN
- **Nhiều chiến dịch:** bạn có thể tạo nhiều chiến dịch và kiểm tra trạng thái tất cả cùng lúc
`;

export default function CommandsGuidePage() {
  return <GuideContentRenderer content={content} />;
}
