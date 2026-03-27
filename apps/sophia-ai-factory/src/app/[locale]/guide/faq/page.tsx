import { GuideContentRenderer } from "@/components/guide/guide-content-renderer";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Câu Hỏi Thường Gặp — Hướng Dẫn Sophia AI Factory",
  description: "Giải đáp những câu hỏi thường gặp nhất về Sophia AI Video Factory",
};

const content = `# Câu Hỏi Thường Gặp

> Giải đáp những câu hỏi thường gặp nhất về Sophia AI Video Factory

---

## 1. Tổng Quan

### Sophia AI Video Factory là gì?

Sophia là nền tảng giúp bạn tạo video tự động bằng trí tuệ nhân tạo (AI). Bạn chỉ cần nhập nội dung, Sophia sẽ tự viết kịch bản, tạo giọng nói, và tạo video hoàn chỉnh — bạn không cần biết làm video.

---

### Tôi cần biết lập trình không?

Không. Sophia được thiết kế cho người không biết kỹ thuật. Mọi thứ đều có hướng dẫn từng bước.

---

### Sophia tạo video như thế nào?

1. Bạn nhập nội dung (chủ đề video)
2. AI viết kịch bản tự động (qua OpenRouter)
3. AI tạo giọng nói tự nhiên (qua ElevenLabs)
4. AI tạo video với người trình bày ảo (qua HeyGen)
5. Video hoàn chỉnh được gửi cho bạn

---

### Mất bao lâu?

2-5 phút cho video ngắn (dưới 3 phút). Video dài hơn có thể mất 10-15 phút.

---

## 2. API Keys

### API Key có mất phí không?

Các dịch vụ đều có gói miễn phí để bắt đầu. Khi sử dụng nhiều, bạn cần nâng cấp gói của từng dịch vụ.

---

### API Key có an toàn không?

Có. API Keys được mã hóa và lưu trữ an toàn. Chúng tôi không chia sẻ key của bạn với bất kỳ ai.

---

## 3. Chiến Dịch

### Tôi có thể tạo bao nhiêu video?

| Gói | Giới hạn |
|---|---|
| BASIC | 20 video/tháng |
| PREMIUM | 100 video/tháng |
| ENTERPRISE | Không giới hạn |

---

### Chiến dịch bị kẹt ở trạng thái Processing?

1. Đợi thêm 10 phút
2. Nhấn **"Làm Mới"** trang Dashboard
3. Nếu vẫn còn kẹt sau 15 phút, nhấn **"Chạy Lại"** (Retry)
4. Liên hệ hỗ trợ qua Telegram @Sophia_Bbot

---

## 4. Telegram Bot

### Bot không trả lời?

1. Kiểm tra tên bot: \`@Sophia_Bbot\` (chữ B viết hoa)
2. Đảm bảo bạn đã nhấn **"START"**
3. Thử gửi lệnh \`/help\`
4. Đợi 30 giây rồi thử lại

---

## 5. Thanh Toán

### Hóa đơn được gửi ở đâu?

Hóa đơn tự động gửi qua email sau mỗi lần thanh toán. Bạn có thể tải hóa đơn từ Dashboard mục "Lịch Sử Thanh Toán."

---

## 6. Hỗ Trợ

| Phương thức | Chi tiết |
|---|---|
| Telegram Bot | @Sophia_Bbot (\`/help\`) |
| Email | support@agencyos.network |
| Hỗ trợ ưu tiên | PREMIUM và ENTERPRISE |
| Hỗ trợ 24/7 | Chỉ gói ENTERPRISE |

---

## 7. Quyền Sở Hữu Dữ Liệu

- Bạn sở hữu 100% nội dung do Sophia tạo ra
- Video được xuất bản trực tiếp lên kênh YouTube/TikTok CỦA BẠN
- API keys được mã hóa và lưu trữ an toàn — chỉ BẠN mới truy cập được
- Database chỉ lưu: email, gói đăng ký, cài đặt chiến dịch
- KHÔNG lưu: video, kịch bản, giọng nói, nội dung đã tạo
- Bạn có thể xóa tài khoản và dữ liệu bất kỳ lúc nào
`;

export default function FAQGuidePage() {
  return <GuideContentRenderer content={content} />;
}
