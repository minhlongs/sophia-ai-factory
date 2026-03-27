import { GuideContentRenderer } from "@/components/guide/guide-content-renderer";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hướng Dẫn Bắt Đầu — Sophia AI Factory",
  description: "Hướng dẫn từng bước sử dụng Sophia AI Factory",
};

const content = `# Hướng Dẫn Bắt Đầu

> Các bước đầu tiên để sử dụng Sophia AI Factory

---

## 1. Truy Cập Dashboard

1. Mở trình duyệt web (Chrome, Safari, Firefox) trên máy tính hoặc điện thoại
2. Nhập địa chỉ website vào thanh địa chỉ: \`https://sophia.agencyos.network\`
3. Nhấn nút **"Đăng Nhập"** ở góc phải trên cùng
4. Nhập email và mật khẩu bạn đã đăng ký
5. Nhấn **"Đăng Nhập"** để vào Dashboard

> Nếu bạn chưa có tài khoản, nhấn **"Đăng Ký"** và làm theo hướng dẫn trên màn hình.

---

## 2. Thiết Lập API Keys

### API Keys là gì?

API Keys giống như "chìa khóa" để kết nối Sophia với các dịch vụ tạo video, giọng AI, và trí tuệ nhân tạo. Bạn chỉ cần nhập 1 lần duy nhất.

### Bước 2a: Lấy OpenRouter API Key

1. Mở tab mới trong trình duyệt
2. Vào trang: \`https://openrouter.ai\`
3. Nhấn **"Sign Up"** để tạo tài khoản (dùng email của bạn)
4. Sau khi đăng nhập, nhấn vào tên của bạn ở góc phải trên
5. Chọn **"Keys"** từ menu xổ xuống
6. Nhấn nút **"Create Key"**
7. Đặt tên cho key (ví dụ: "Sophia")
8. Nhấn **"Create"**
9. **Copy key** (bấm vào biểu tượng copy bên cạnh key)
10. Quay lại Sophia Dashboard, dán key vào ô **"OpenRouter API Key"**

> OpenRouter giúp Sophia sử dụng trí tuệ nhân tạo để viết kịch bản video.

### Bước 2b: Lấy ElevenLabs API Key

1. Mở tab mới trong trình duyệt
2. Vào trang: \`https://elevenlabs.io\`
3. Nhấn **"Sign Up"** để tạo tài khoản
4. Sau khi đăng nhập, nhấn vào **ảnh đại diện** của bạn ở góc phải trên
5. Chọn **"Profile + API Key"**
6. Tìm dòng chữ **"API Key"**
7. Nhấn **biểu tượng mắt** để hiển thị key
8. Nhấn **"Copy"** để sao chép key
9. Quay lại Sophia Dashboard, dán key vào ô **"ElevenLabs API Key"**

> ElevenLabs giúp Sophia tạo giọng nói AI tự nhiên cho video của bạn.

### Bước 2c: Lấy HeyGen API Key

1. Mở tab mới trong trình duyệt
2. Vào trang: \`https://heygen.com\`
3. Nhấn **"Sign Up"** để tạo tài khoản
4. Sau khi đăng nhập, nhấn vào **Settings** (biểu tượng bánh răng)
5. Chọn **"API"** từ menu bên trái
6. Nhấn **"Generate API Key"**
7. **Copy key** hiển thị trên màn hình
8. Quay lại Sophia Dashboard, dán key vào ô **"HeyGen API Key"**

> HeyGen giúp Sophia tạo video với người dẫn ảo (AI avatars).

---

## 3. Tạo Chiến Dịch Đầu Tiên

1. Trong Dashboard, nhấn nút **"+ Tạo Chiến Dịch Mới"** (màu xanh, ở giữa màn hình)
2. Nhập **Tên Chiến Dịch** (ví dụ: "Video giới thiệu sản phẩm tháng 2")
3. Chọn **Mẫu Video** (template) từ danh sách có sẵn
4. Nhập **Nội dung chính** bạn muốn trình bày trong video
5. Chọn **Giọng nói** bạn thích (nam/nữ, ngôn ngữ)
6. Nhấn **"Tạo Chiến Dịch"**
7. Đợi 2-5 phút để Sophia xử lý và tạo video

> Video sẽ tự động được lưu trong mục **"Chiến Dịch Của Tôi"** trên Dashboard.

---

## 4. Xem Và Tải Video

1. Vào mục **"Chiến Dịch Của Tôi"** trên Dashboard
2. Tìm chiến dịch bạn vừa tạo
3. Khi trạng thái hiện **"Hoàn Thành"** (màu xanh lá), nhấn vào tên chiến dịch
4. Nhấn nút **"Xem Video"** để xem trước
5. Nhấn nút **"Tải Xuống"** để lưu video về máy tính
6. Video được lưu dạng MP4, bạn có thể đăng lên YouTube, Facebook, TikTok

---

## 5. Cần Hỗ Trợ?

- Nhấn nút **"Hỗ Trợ"** ở góc dưới bên phải Dashboard
- Gửi tin nhắn qua Telegram bot: \`@Sophia_Bbot\`
- Email: support@agencyos.network
- Xem thêm: [Câu Hỏi Thường Gặp (FAQ)](/guide/faq)

---

## Bước Tiếp Theo

| Hướng dẫn | Link |
|---|---|
| Kết nối Telegram Bot | [Bot Telegram](/guide/telegram) |
| Xem hành trình người dùng | [Cách Hoạt Động](/guide/how-it-works) |
| Xem bảng giá | [Bảng Giá](/pricing) |
`;

export default function GuidePage() {
  return <GuideContentRenderer content={content} />;
}
