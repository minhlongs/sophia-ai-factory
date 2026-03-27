import { GuideContentRenderer } from "@/components/guide/guide-content-renderer";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cách Hoạt Động — Hướng Dẫn Sophia AI Factory",
  description: "Bản đồ hành trình người dùng và quy trình làm việc của Sophia AI Video Factory",
};

const content = `# Hành Trình Người Dùng

> Bạn chỉ cần làm theo từng bước — Sophia sẽ lo phần còn lại.

---

## 1. Chào Mừng

Sophia AI Video Factory là phần mềm giúp bạn **tự động tạo video** bằng trí tuệ nhân tạo (AI). Bạn không cần biết lập trình. Bạn không cần biết dựng video. Sophia làm tất cả cho bạn.

**Sophia giúp bạn:**
- Tìm sản phẩm bán chạy để giới thiệu
- Viết kịch bản video tự động
- Tạo giọng nói AI tự nhiên
- Tạo người trình bày ảo (avatar)
- Đăng video lên YouTube tự động

---

## 2. Bản Đồ Hành Trình

\`\`\`
  BẠN
    |
    v
+---------------------------+
|  1. TRANG CHỦ / LANDING   |  <-- Xem giới thiệu, bảng giá
|     sophia.agencyos.network|
+---------------------------+
    |
    v
+---------------------------+
|  2. ĐĂNG KÝ              |  <-- Tạo tài khoản mới
|     Nhập email + mật khẩu |
+---------------------------+
    |
    v
+---------------------------+
|  3. THIẾT LẬP             |  <-- Kết nối 3 dịch vụ AI
|     Setup Wizard (4 bước) |
+---------------------------+
    |
    v
+---------------------------+
|  4. DASHBOARD             |  <-- Trung tâm điều khiển
|     Xem tổng quan         |
+---------------------------+
    |
    v
+---------------------------+
|  5. TELEGRAM BOT          |  <-- Tạo video từ điện thoại!
|     @Sophia_Bbot           |
+---------------------------+
\`\`\`

| Bước | Thời gian | Tần suất |
|---|---|---|
| Đăng ký | 2 phút | 1 lần |
| Thiết lập | 10 phút | 1 lần |
| Tạo video | 2 phút nhập + 3-5 phút chờ | Mỗi lần |

---

## 3. Quy Trình Nhanh

\`\`\`
[Đăng nhập]  >  [Chọn Mẫu]  >  [Nhập Nội Dung]  >  [Đợi 3-5p]  >  [Tải Video]
\`\`\`

---

## 4. Màu Trạng Thái

| Màu | Ý nghĩa |
|---|---|
| Vàng | Đang xử lý |
| Xanh lá | Hoàn thành |
| Đỏ | Có lỗi |

---

## 5. Hỗ Trợ

| Kênh | Liên hệ |
|---|---|
| Email | support@agencyos.network |
| Telegram | @Sophia_Bbot (\`/help\`) |
| Tư vấn gói | sales@agencyos.network |

---

## Tiếp Theo

- [Xem tất cả màn hình](/guide/screens)
- [Câu hỏi thường gặp](/guide/faq)
- [Hướng dẫn Telegram Bot](/guide/telegram)
`;

export default function HowItWorksPage() {
  return <GuideContentRenderer content={content} />;
}
