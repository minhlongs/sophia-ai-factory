# Sophia AI Factory — Client Handover SOP
# Quy Trình Bàn Giao Khách Hàng (Bilingual / Song Ngữ: VI - EN)

> **Mục tiêu / Purpose:** Hướng dẫn CEO và đội ngũ vận hành tự kích hoạt, cấu hình khóa API (BYOK) và quản lý tài khoản trên nền tảng Sophia AI Factory.
> Operator and client self-service onboarding guide for Sophia AI Factory.

---

## 1. Truy Cập Nền Tảng / Platform Access

| Hạng mục / Item | Liên kết & Giá trị / Value | Ghi chú / Note |
|---|---|---|
| **Production URL** | https://sophia.agencyos.network | Hệ thống chính thức / Live environment |
| **Trang chủ / Landing** | https://sophia.agencyos.network/landing | Giới thiệu giải pháp / Solution overview |
| **Đăng ký / Sign Up** | https://sophia.agencyos.network/signup | Tạo tài khoản mới / New account creation |
| **Đăng nhập / Login** | https://sophia.agencyos.network/login | Cổng đăng nhập / Client portal login |
| **Kiểm tra trạng thái / API Health** | https://sophia.agencyos.network/api/health | Giám sát vận hành / System health check |
| **Tài liệu API / API Docs** | https://sophia.agencyos.network/docs/api | Tài liệu tích hợp / Integration specs |

---

## 2. Quy Trình Tự Thiết Lập / Client Self-Service Setup (BYOK)

> 🔒 **Nguyên tắc bảo mật / Security Doctrine:** Nền tảng **KHÔNG** lưu trữ khóa API riêng tư của khách hàng trên cơ sở dữ liệu dạng văn bản thô. Khách hàng hoàn toàn làm chủ và quản lý API key của chính mình (BYOK - Bring Your Own Keys).
> The platform does NOT store unencrypted client API keys. Clients manage their own keys with zero vendor lock-in.

### 📝 Bước 1: Tạo Tài Khoản / Step 1: Create Account
1. **VI:** Truy cập https://sophia.agencyos.network/signup
   **EN:** Visit https://sophia.agencyos.network/signup
2. **VI:** Nhập tên doanh nghiệp, địa chỉ email và mật khẩu.
   **EN:** Enter company name, email, and password.
3. **VI:** Xác thực email để kích hoạt quyền truy cập Workspace.
   **EN:** Verify email address to activate Workspace access.

### 🔑 Bước 2: Nhập Khóa API Nhà Cung Cấp / Step 2: Add Provider Keys
**VI:** Đi tới mục `Cài đặt > Khóa API (Settings > API Keys)` và điền các khóa tương ứng:  
**EN:** Navigate to `Settings > API Keys` and enter the required provider credentials:

| Khóa API / API Key | Nơi lấy khóa / Where to get | Mục đích sử dụng / Purpose |
|---|---|---|
| `OPENROUTER_API_KEY` | https://openrouter.ai/settings/keys | Sinh kịch bản & prompt video / Script & prompt generation |
| `ELEVENLABS_API_KEY` | https://elevenlabs.io/app/settings/api-keys | Tạo giọng đọc AI chất lượng cao / Voice synthesis |
| `DID_API_KEY` | https://studio.d-id.com/account-settings | Tạo video đại diện kỹ thuật số / Digital avatar generation |
| `HEYGEN_API_KEY` | https://app.heygen.com/settings/api | Tạo video đại diện ảo bổ trợ / Avatar video generation |
| `MUAPI_API_KEY` | https://muapi.ai/ | Nhà cung cấp media bổ trợ (tùy chọn) / Optional media provider |
| `RESEND_API_KEY` | https://resend.com/api-keys | Gửi email thương hiệu riêng (tùy chọn, mặc định dùng hạ tầng hệ thống) / Custom email delivery (optional workspace override, falls back to platform default) |

---

## 3. Chọn Gói Dịch Vụ & Thanh Toán / Subscription & Payment Tiers

| Gói / Plan | Tier nội bộ / Internal Tier | Giá / Price | Hạn mức / Quota | Phù hợp nhất cho / Best For |
|---|---|---|---|---|
| **Starter** | `BASIC` | $199/tháng ($199/mo) | Theo dõi trên Dashboard | Doanh nghiệp nhỏ bắt đầu thử nghiệm video AI / Small businesses starting AI video |
| **Growth** | `PREMIUM` | $399/tháng ($399/mo) | Theo dõi trên Dashboard | Đội ngũ sản xuất video đều đặn hàng tuần / Growing teams scaling weekly video production |
| **Premium** | `ENTERPRISE` | $799/tháng ($799/mo) | Theo dõi trên Dashboard | Đại lý & doanh nghiệp cần tự động hóa và API cao cấp / Agencies and enterprises needing automation/API |
| **Master** | `MASTER` | $4,999 trả 1 lần ($4,999 one-time) | Tùy biến theo triển khai | Bàn giao trọn gói mã nguồn & nhượng quyền thương hiệu / White-label source code handover |

💳 **Cổng thanh toán hỗ trợ / Supported Payment Methods:**
- **Quốc tế / International:** NOWPayments (USDT crypto).
- **Việt Nam / Domestic:** PayOS (VietQR / chuyển khoản ngân hàng tự động).
- ⚠️ **Lưu ý / Notice:** Không sử dụng Polar hoặc PayPal cho việc thanh toán dịch vụ Sophia AI Factory (Polar and PayPal are strictly banned for Sophia billing).

---

## 4. Bắt Đầu Vận Hành / Step 4: Core Workflows

**VI:** Các tính năng cốt lõi đã sẵn sàng:
1. Tạo chiến dịch video từ câu lệnh (prompt) hoặc kịch bản mẫu.
2. Tự động sinh kịch bản, lồng tiếng AI, video người dẫn ảo và phụ đề tự động.
3. Theo dõi hạn mức sử dụng (MCU), tiến độ render và lịch sử xuất file trên Dashboard.
4. Tải video chất lượng cao hoặc xuất bản trực tiếp lên các kênh phân phối.
5. Kết nối Telegram Bot `@Sophia_Bbot` để nhận thông báo và điều khiển chiến dịch.

**EN:** Core workflows available out of the box:
1. Create video campaigns from natural prompts or reusable templates.
2. Automatically generate scripts, AI voiceover, digital avatar videos, and subtitles.
3. Track MCU credit usage, render status, and export history in the dashboard.
4. Download high-definition videos or publish to marketing channels.
5. Connect Telegram Bot `@Sophia_Bbot` for mobile monitoring and campaign triggers.

---

## 5. Kiến Trúc Bảo Mật Khóa API / Zero Plaintext API Key Storage Architecture

```
Trình duyệt khách hàng / Client Browser 
       → Cloudflare Workers (sophia.agencyos.network)
                    ↓ [Mã hóa AES-GCM-256 / AES-GCM-256 Encryption]
       Cloudflare D1 Database (Khóa BYOK đã mã hóa, Metadata tài khoản & đo lường MCU / Encrypted BYOK keys, account metadata & MCU metrics)
                    ↓ [Giải mã tạm thời trong bộ nhớ runtime / Decrypted in-memory at runtime]
       Gọi trực tiếp API nhà cung cấp / Direct provider API calls
       (OpenRouter, ElevenLabs, D-ID, HeyGen, MuAPI, v.v.)
```

- **VI:** Nền tảng chỉ lưu trữ khóa API đã được mã hóa bảo mật (AES-GCM-256), thông tin tài khoản, hạn mức MCU đã dùng và nhật ký vận hành cần thiết. Tuyệt đối **KHÔNG** lưu trữ khóa API dạng văn bản thô (plaintext) hay nội dung video nhạy cảm trên hệ thống lưu trữ tĩnh.
- **EN:** Platform stores only securely encrypted API keys (AES-GCM-256), account metadata, MCU usage metrics, and necessary operational logs. Unencrypted (plaintext) API keys and sensitive raw video assets are never stored on platform persistence.

---

## 6. Hỗ Trợ Kỹ Thuật & Vận Hành / Support & Operations

- 📡 **Trạng thái dịch vụ / Status:** https://sophia.agencyos.network/status
- 📚 **Tài liệu hướng dẫn / Docs:** https://sophia.agencyos.network/docs
- ✉️ **Email hỗ trợ / Support:** support@mekongmind.com
- 🤖 **Telegram Bot:** `@Sophia_Bbot`

---

## 7. Quản Lý Gói Cước & Hóa Đơn / Billing Management

**VI:** Khách hàng có thể tự quản lý gói dịch vụ tại: https://sophia.agencyos.network/billing
- Xem chi tiết hạn mức MCU đã tiêu thụ trong kỳ.
- Nâng cấp hoặc hạ cấp gói dịch vụ bất kỳ lúc nào.
- Tải hóa đơn thanh toán tự động.
- Hủy gói cước khi không còn nhu cầu sử dụng.

**EN:** Manage subscription and invoices anytime at: https://sophia.agencyos.network/billing
- View real-time MCU credit consumption.
- Upgrade or downgrade subscription tiers.
- Download automated payment invoices.
- Cancel subscription renewal at will.
