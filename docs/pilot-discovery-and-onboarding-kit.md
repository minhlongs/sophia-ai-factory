# Pilot Discovery and Onboarding Kit / Bộ Công Cụ Khám Phá & Triển Khai Pilot

> **Status:** Active | **Baseline:** 0 paying customers / $0 MRR (as of 2026-10-17) | **Compliance:** Vietnam PDPD 13/2023/NĐ-CP

---

## 1. Customer Discovery Interviews (Priority Task #1)

### Hướng dẫn phỏng vấn / Interview Guide (Agency & SMB 3–20 nhân sự tại Việt Nam)

1. **Vấn đề sản xuất nội dung / Content Bottleneck:** Anh/chị mất bao nhiêu giờ mỗi tuần để làm video ngắn (TikTok, Reels, Shorts) cho khách hàng?
2. **Chi phí hiện tại / Current Cost:** Đội ngũ hiện tại gồm mấy người phụ trách dựng hình và viết kịch bản? Chi phí thuê agency ngoài là bao nhiêu?
3. **Mối quan ngại bảo mật API / BYOK Security:** Anh/chị có sẵn lòng tự nhập khóa API riêng (OpenRouter, ElevenLabs, D-ID) để bảo mật tuyệt đối dữ liệu khách hàng không?
4. **Mô hình triển khai / Deployment Preference:** Anh/chị ưu tiên tự cài đặt miễn phí mã nguồn mở bản Community (`Apache-2.0`) trên server riêng hay thuê bao Managed Cloud bảo mật sẵn sàng?

---

### Objection Matrix (Bảng Xử Lý Từ Chối)

| Khách hàng thắc mắc / Objection | Bản Tự Cài Đặt (Community Core - Apache-2.0) | Bản Sophia Managed Cloud ($199–$799/tháng) | Bản Master Handover ($4,999 RAAS) |
| :--- | :--- | :--- | :--- |
| **"Tôi sợ lộ API Key"** | Khách tự quản lý 100% trên server riêng; không ai ngoài bạn thấy khóa. | Mã hóa AES-256-GCM tại biên; tuyệt đối bảo mật. | Bàn giao toàn bộ source & quyền kiểm soát phần cứng độc quyền. |
| **"Chi phí quá cao"** | Miễn phí vĩnh viễn (`Apache-2.0`); tự lo hạ tầng Cloudflare/Vercel. | Tiết kiệm 80% so với thuê nhân sự dựng video thủ công full-time. | Sở hữu trọn đời mô hình kinh doanh RaaS độc lập không tốn phí duy trì. |
| **"Tôi không biết kỹ thuật"** | Cần kỹ sư biết Docker, Node.js và Git để vận hành. | Setup Wizard 1-click trực quan, không cần biết lập trình. | Đội ngũ kỹ thuật Sophia cài đặt tận nơi và bàn giao chìa khóa trao tay. |

---

### Biên bản đồng thuận dữ liệu cá nhân (Nghị định 13/2023/NĐ-CP)
Trước khi ghi âm hoặc trích dẫn ý kiến, khách hàng cần xác nhận:
> *"Tôi đồng ý cho Sophia AI Factory ghi nhận ý kiến đóng góp và số liệu vận hành thử nghiệm dưới dạng ẩn danh nhằm mục đích cải tiến sản phẩm, tuân thủ nghiêm ngặt Luật An Ninh Mạng và Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân."*

---

## 2. First Paid Customer Pilot Onboarding (Priority Task #3)

### Quy trình 6 bước bàn giao Pilot Ngày 1 / Day-1 Pilot Onboarding Protocol

1. **Đăng ký tài khoản / Registration:** Truy cập cổng chính thức, đăng ký tài khoản doanh nghiệp bằng email công ty.
2. **Thanh toán minh bạch / Verified Payment:** Thanh toán qua cổng chính thức **NOWPayments (USDT)** hoặc **PayOS (Việt Nam)** *(Nghiêm cấm sử dụng Polar hoặc PayPal)*.
3. **Kích hoạt tự động / Automated Tier Activation:** Hệ thống D1 tự động ghi nhận giao dịch và kích hoạt cấp độ tài khoản (`BASIC` / `PREMIUM` / `ENTERPRISE`) trong vòng 60 giây.
4. **Cấu hình BYOK Setup Wizard:** Nhập khóa cá nhân OpenRouter, ElevenLabs, D-ID qua Setup Wizard an toàn (mã hóa chuẩn AES-256-GCM).
5. **Kiểm tra Video đầu tiên & Telegram Bot:** Tạo video AI tự động đầu tiên và kết nối `@Sophia_Bbot` để nhận thông báo trạng thái qua Telegram.
6. **Đăng đa kênh & Di chuyển cấu hình:** Lên lịch đăng video qua `/dashboard/social-publisher` hoặc xuất/nhập cấu hình không gián đoạn qua `/api/open-core/portability`.

---

## 3. Financial & Operational Truth

- **Baseline MRR:** `$0 MRR` (`0` khách hàng trả phí tính đến `2026-10-17`).
- **Billing Provider:** NOWPayments (USDT) & PayOS (VN domestic).
- **Core License:** Dual-license (`Apache-2.0` Community Core + Commercial Managed Cloud).
