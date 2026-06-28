# Troubleshooting Guide / Hướng Dẫn Xử Lý Sự Cố

This guide provides troubleshooting solutions for both developers and operators running the Sophia AI Factory platform.

---

## Mục Lục / Table of Contents

1. [Dashboard không tải được / Dashboard not loading](#1-dashboard-khong-tai-duoc--dashboard-not-loading)
2. [Chiến dịch bị lỗi / Campaign failed](#2-chien-dich-bi-loi--campaign-failed)
3. [Bot không trả lời / Bot not responding](#3-bot-khong-tra-loi--bot-not-responding)
4. [Video bị timeout / Video generation timeout](#4-video-bi-timeout--video-generation-timeout)
5. [Không đăng nhập được / Cannot log in](#5-khong-dang-nhap-duoc--cannot-log-in)
6. [API Key bị lỗi / API Key errors](#6-api-key-bi-loi--api-key-errors)
7. [Video không có âm thanh / Video has no audio](#7-video-khong-co-am-thanh--video-has-no-audio)
8. [Không nhận được email / Not receiving emails](#8-khong-nhan-duoc-email--not-receiving-emails)
9. [Thanh toán thất bại / Payment failed](#9-thanh-toan-that-bai--payment-failed)
10. [Chiến dịch bị kẹt / Campaign stuck](#10-chien-dich-bi-ket--campaign-stuck)
11. [Lỗi lệch cấu hình Cron / Cron Configuration Drift Issues](#11-loi-lech-cau-hinh-cron--cron-configuration-drift-issues)
12. [Lỗi kết nối Service vệ tinh / Sidecar Connection Errors](#12-loi-ket-noi-service-ve-tinh--sidecar-connection-errors)

---

## 1. Dashboard không tải được / Dashboard not loading

### Triệu chứng / Symptoms
- Trang web hiện màu trắng hoặc đen.
- Vòng xoay tải liên tục không ngắt.
- Thông báo lỗi "Không thể kết nối".

### Cách khắc phục / How to fix
1. Kiểm tra địa chỉ web: Đảm bảo nhập đúng `https://sophia.agencyos.network`
2. Kiểm tra kết nối internet.
3. Làm mới trang bằng tổ hợp phím **Ctrl + Shift + R** (Windows) hoặc **Cmd + Shift + R** (Mac).
4. Xoá cache trình duyệt và thử lại.

---

## 2. Chiến dịch bị lỗi / Campaign failed

### Triệu chứng / Symptoms
- Trạng thái chiến dịch hiện **"Lỗi"** màu đỏ.
- Video không được tạo.

### Cách khắc phục / How to fix
1. Nhấn vào tên chiến dịch để xem chi tiết lỗi.
2. Đọc thông báo lỗi:
   - Nếu ghi "API Key invalid" -> kiểm tra lại API key trong Settings.
   - Nếu ghi "Quota exceeded" -> nạp thêm tiền vào tài khoản OpenRouter/ElevenLabs/HeyGen.
   - Nếu ghi "Content error" -> chỉnh sửa nội dung và thử lại.
3. Nhấn nút **"Chạy Lại"** (Retry) bên cạnh chiến dịch.

---

## 3. Bot không trả lời / Bot not responding

### Triệu chứng / Symptoms
- Gửi lệnh nhưng bot không phản hồi hoặc báo lỗi.

### Cách khắc phục / How to fix
1. Đảm bảo nhắn tin với đúng bot: `@Sophia_Bbot` (chữ "B" viết hoa).
2. Nếu chưa từng sử dụng bot, nhấn nút **"START"** ở cuối màn hình.
3. Thử gửi lệnh `/help` để xem bot có hoạt động bình thường không.

---

## 4. Video bị timeout / Video generation timeout

### Triệu chứng / Symptoms
- Chiến dịch ở trạng thái "Đang xử lý" quá 15 phút.

### Cách khắc phục / How to fix
1. Đợi thêm 10 phút vì HeyGen có thể cần nhiều thời gian xử lý video dài.
2. Nhấn **"Làm Mới"** trang Dashboard.
3. Nếu vẫn "Đang xử lý" sau 20 phút, nhấn nút **"Chạy Lại"** (Retry).

---

## 5. Không đăng nhập được / Cannot log in

### Triệu chứng / Symptoms
- Thông báo "Email hoặc mật khẩu sai" xuất hiện.
- Nhấn đăng nhập nhưng trang không chuyển hướng.

### Cách khắc phục / How to fix
1. Kiểm tra xem có khoảng trắng thừa hay không.
2. Nhấn **"Quên Mật Khẩu"** để nhận link reset email.
3. Kiểm tra mục Spam/Junk trong hộp thư nếu không thấy email phản hồi từ hệ thống.

---

## 6. API Key bị lỗi / API Key errors

### Triệu chứng / Symptoms
- Thông báo "Invalid API Key" khi tạo chiến dịch.

### Cách khắc phục / How to fix
1. Vào **Dashboard > Settings > API Keys**.
2. Xoá key cũ và sao chép chính xác key mới từ các dashboard tương ứng (OpenRouter, ElevenLabs, HeyGen).
3. Nhấn **"Lưu"** và thử lại.

---

## 7. Video không có âm thanh / Video has no audio

### Triệu chứng / Symptoms
- Video phát bình thường nhưng không nghe thấy tiếng.

### Cách khắc phục / How to fix
1. Kiểm tra tài khoản ElevenLabs xem có bị hết hạn mức (quota) hay không.
2. Đảm bảo giọng nói đã chọn hỗ trợ đúng ngôn ngữ của kịch bản video.

---

## 8. Không nhận được email / Not receiving emails

### Triệu chứng / Symptoms
- Không nhận được email xác nhận đăng ký hoặc email reset mật khẩu.

### Cách khắc phục / How to fix
1. Kiểm tra mục **Spam** hoặc **Junk** trong hòm thư cá nhân.
2. Tìm email gửi từ địa chỉ `noreply@sophia.agency`.
3. Thêm địa chỉ gửi này vào danh sách người nhận an toàn (whitelist).

---

## 9. Thanh toán thất bại / Payment failed

### Triệu chứng / Symptoms
- Thông báo lỗi thanh toán xuất hiện, không thể kích hoạt gói cước.

### Cách khắc phục / How to fix
1. NOWPayments hỗ trợ USDT/crypto; PayOS hỗ trợ chuyển khoản VietQR trong nước.
2. Nếu dùng NOWPayments, xác nhận bạn gửi đúng số tiền và đúng mạng blockchain.
3. Nếu dùng PayOS, tạo lại mã thanh toán mới nếu mã cũ đã hết hạn.

---

## 10. Chiến dịch bị kẹt / Campaign stuck

### Triệu chứng / Symptoms
- Chiến dịch đứng im ở trạng thái "Processing" quá 30 phút.

### Cách khắc phục / How to fix
1. Nhấn nút **"Hủy"** chiến dịch cũ.
2. Tạo chiến dịch mới với cùng nội dung để chạy lại.

---

## 11. Lỗi lệch cấu hình Cron / Cron Configuration Drift Issues

### Triệu chứng / Symptoms
- Các tác vụ chạy tự động như `heartbeat` hoặc `llm-cache-purge` không chạy định kỳ.
- Logs Cloudflare báo lỗi: `No handler for cron pattern`.

### Cách khắc phục / How to fix
1. Mở file `apps/sophia-ai-factory/scripts/inject-scheduled-handler.mjs`.
2. Kiểm tra danh sách `CRON_ROUTES` và map pattern bị thiếu vào endpoint API tương ứng.
3. Biên dịch lại và redeploy ứng dụng.

---

## 12. Lỗi kết nối Service vệ tinh / Sidecar Connection Errors

### Triệu chứng / Symptoms
- Video tạo ra trả về file MP4 giả lập (stub file).
- Logs báo lỗi: `FastAPI rendering service unavailable` hoặc `withBreaker circuit open`.

### Cách khắc phục / How to fix
1. Kiểm tra trạng thái service Render Video (MoviePy) qua CLI:
   `fly status -a sophia-moviepy-render`
2. Đồng bộ hoá biến môi trường `INTERNAL_API_SECRET` giữa worker chính và sidecar.
