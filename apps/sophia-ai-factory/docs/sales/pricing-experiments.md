# Ma Trận Thử Nghiệm Giá & Mô Hình Chuyển Đổi (Pricing Experiments Matrix)

> **Căn cứ xác thực:** Hạn mức và giá cước chuẩn được trích xuất trực tiếp từ mã nguồn nền tảng (`UNIFIED_TIERS` & `TIER_CONFIGS`). Tuyệt đối không thay đổi giá niêm yết mà chỉ thử nghiệm cơ chế ưu đãi và đóng gói giá trị.

---

## 1. Bảng Giá Niêm Yết Chuẩn (Source of Truth)

| Gói Cước | Tên Hiển Thị | Giá Tháng | MCU/Tháng | Giá Trọn Năm (Tiết kiệm 17%) | Kênh YouTube Hỗ Trợ |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **BASIC** | Starter | **$199/tháng** | 1,000 MCU | $1,990/năm | 1 kênh |
| **PREMIUM** | Growth | **$399/tháng** | 5,000 MCU | $3,990/năm | 3 kênh *(Khuyên dùng)* |
| **ENTERPRISE** | Premium | **$799/tháng** | 20,000 MCU | $7,990/năm | 10 kênh |
| **MASTER** | Master | **$4,999 trọn đời** | 100,000 MCU | N/A | Không giới hạn |

---

## 2. Các Thử Nghiệm Tăng Tỷ Lệ Chuyển Đổi (Conversion Rate Optimization)

### Thử nghiệm A: Đóng gói "Setup Hộ 1-1 Trong 24 Giờ" (Dành cho gói PREMIUM)
- **Ý tưởng:** Với các CEO không rành công nghệ, rào cản lớn nhất là việc tạo tài khoản API (ElevenLabs, fal.ai).
- **Cơ chế:** Khi đăng ký gói PREMIUM theo năm ($3,990), tặng kèm gói "White-glove Onboarding Call 30 phút" qua Zoom để thiết lập toàn bộ khóa API và tạo chiến dịch đầu tiên.
- **Kỳ vọng:** Tăng tỷ lệ chuyển đổi từ gói tháng sang gói năm lên 35%.

### Thử nghiệm B: Hoàn MCU Nếu Không Đạt Mục Tiêu Xuất Bản (Dành cho gói BASIC)
- **Ý tưởng:** Giảm thiểu rủi ro cho khách hàng mới gia nhập.
- **Cơ chế:** Nếu trong 14 ngày đầu tiên người dùng không thể render thành công 3 video do lỗi hệ thống, tặng thêm 500 MCU miễn phí.
- **Kỳ vọng:** Tăng tỷ lệ kích hoạt (activation rate) từ 60% lên 85%.

### Thử nghiệm C: Thanh toán bằng USDT Chiết Khấu Thêm 5%
- **Ý tưởng:** Tối ưu hóa dòng tiền qua cổng NOWPayments, giảm phí trung gian thẻ tín dụng.
- **Cơ chế:** Khách hàng thanh toán phí năm bằng USDT được cộng thêm 10% MCU vào tài khoản.
