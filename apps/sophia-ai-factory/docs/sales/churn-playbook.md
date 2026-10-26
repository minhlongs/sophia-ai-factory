# Cẩm Nang Giữ Chân Khách Hàng & Ngăn Ngừa Rời Bỏ (Churn Prevention Playbook)

> **Mục tiêu:** Giảm tỷ lệ rời bỏ (churn rate) của khách hàng doanh nghiệp xuống dưới 3%/tháng thông qua phát hiện sớm và can thiệp tự động.

---

## 1. Các Tín Hiệu Báo Động Sớm (Early Churn Indicators)

1. **Không hoàn tất Setup Wizard sau 48 giờ:** Khách hàng đã thanh toán nhưng chưa điền khóa API BYOK (OpenRouter, ElevenLabs).
2. **Mức tiêu thụ MCU dưới 10% trong 14 ngày đầu:** Khách hàng chưa chạy chiến dịch tự động nào.
3. **Không có lượt nhấp shortlink `/r/code`:** Video được xuất bản nhưng chưa gắn link tiếp thị liên kết.

---

## 2. Quy Trình Can Thiệp Tự Động 3 Cấp Độ

| Cấp Độ | Thời Điểm Kích Hoạt | Kênh Tác Động | Nội Dung Hỗ Trợ |
| :--- | :--- | :--- | :--- |
| **Cấp 1 (Nhắc nhở nhẹ)** | Giờ thứ 48 sau đăng ký chưa nhập khóa API | Telegram Bot `@Sophia_Bbot` & Email | Gửi video hướng dẫn 2 phút cách lấy khóa API nhanh nhất. |
| **Cấp 2 (Kích hoạt mẫu)** | Ngày thứ 7 chưa tạo video đầu tiên | Thông báo trong Dashboard & Email | Đề xuất 3 mẫu kịch bản (SOP) có tỷ lệ chuyển đổi cao nhất theo ngành. |
| **Cấp 3 (Giải cứu tài khoản)** | Ngày thứ 21 mức dùng MCU = 0 | Liên hệ trực tiếp từ đội ngũ CS | Tặng thêm 15 ngày sử dụng hoặc hỗ trợ cài đặt chiến dịch đầu tiên miễn phí. |

---

## 3. Chính Sách Đóng Băng Tạm Thời (Pause Instead of Cancel)

Khi khách hàng bấm nút "Hủy gói cước":
- Thay vì hủy ngay lập tức và mất toàn bộ cấu hình kênh, hệ thống đề xuất **"Tạm dừng tài khoản 30 ngày miễn phí" (Pause Subscription)**.
- Giữ nguyên toàn bộ dữ liệu kịch bản, shortlink `/r/code` và lịch sử hoa hồng để khách hàng dễ dàng quay lại khi sẵn sàng.
