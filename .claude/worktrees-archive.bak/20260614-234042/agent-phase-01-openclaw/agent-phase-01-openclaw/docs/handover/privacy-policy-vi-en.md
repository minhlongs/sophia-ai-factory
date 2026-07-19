---
title: Privacy Policy
language: vi-en
last_updated: 2026-04-29
---

# Privacy Policy (Chính Sách Bảo Mật Dữ Liệu)

---

## VI: Chính Sách Bảo Mật Dữ Liệu Sophia AI Factory

**Ngày hiệu lực:** 29/04/2026

### 1. Dữ Liệu Nào Được Thu Thập?

Sophia AI Factory thu thập:

**Dữ liệu cá nhân:**
- Email, tên công ty
- Password (mã hóa)
- Số điện thoại (tùy chọn)

**Dữ liệu hoạt động:**
- Video prompts bạn tạo
- Video được tạo ra (metadata + URL R2)
- API key stats (không lưu key thật, chỉ lưu "đã dùng")

**Dữ liệu kỹ thuật:**
- IP address, browser type
- Timestamps của hành động
- Error logs từ Sentry

### 2. BYOK — Khóa API Của Bạn

⚠️ **QUAN TRỌNG:** Bạn cung cấp API keys của riêng bạn (OpenRouter, ElevenLabs, D-ID, Midjourney, etc.).

- **Mã hóa:** Tất cả keys được mã hóa khi lưu trữ (AES-256)
- **Truy cập:** Chỉ máy chủ Sophia có quyền truy cập để gọi API thứ ba
- **Bạn sở hữu:** Không có ai khác truy cập được, kể cả Sophia team
- **Xóa:** Khi xóa account, tất cả keys bị xóa vĩnh viễn

### 3. Dữ Liệu Video — Lưu Trữ & Xóa

- **Nơi lưu:** Cloudflare R2 (storage bên ngoài)
- **Thời hạn:** Video links tạm thời (HeyGen 7 ngày), video cuối cùng lưu R2 vĩnh viễn
- **Quyền truy cập:** Chỉ bạn + Sophia admin (để debug)
- **Xóa video:** Email support@mekongmind.com để xóa video cũ

### 4. Cookie & Tracking

Sophia AI Factory sử dụng:

- **Session cookies:** Giữ bạn đăng nhập
- **Analytics (không định danh):** Số lượng video tạo, tier usage (Sentry)
- **Google Analytics:** Chỉ URL được truy cập (bình thường), không personal data

Bạn có thể tắt cookies trong browser settings, nhưng dịch vụ sẽ giảm công năng.

### 5. Nhà Cung Cấp Thứ Ba

Sophia AI Factory sử dụng các service bên ngoài:

| Provider | Dùng Cho | Dữ Liệu Gửi | Bảo Mật |
|----------|----------|-----------|---------|
| **HeyGen** | Avatar video | Prompts + voice | Encrypted, 7-day auto-delete |
| **ElevenLabs** | Tổng hợp giọng | Text to speak | Encrypted, temp URLs |
| **MuAPI** | Ảnh/âm nhạc | Prompts | Encrypted, no storage |
| **OpenRouter** | LLM prompts | Text prompts | No storage, api-only |
| **Resend** | Email | Email address | GDPR-compliant EU |
| **Sentry** | Error logs | Error messages (no personal data) | GDPR-compliant, US-based |
| **Cloudflare R2** | Video storage | Video metadata + files | Encrypted, global edge |

⚠️ **Lưu ý:** Mỗi provider có chính sách bảo mật riêng. Xem privacy policy của họ.

### 6. Quyền Của Bạn (GDPR + Vietnam Data Law)

Bạn có quyền:

- ✅ **Truy cập:** Xem tất cả dữ liệu của mình → Email support@mekongmind.com
- ✅ **Sửa:** Cập nhật email, tên, thông tin → Dashboard hoặc email
- ✅ **Xóa (Right to be Forgotten):** Xóa account + tất cả dữ liệu → Yêu cầu email (xử lý 30 ngày)
- ✅ **Xuất dữ liệu:** Tải xuống tất cả video, metadata → Email support
- ✅ **Từ chối marketing:** Unsubscribe emails → Link ở cuối mỗi email

### 7. Bảo Mật & Mã Hóa

- ✅ HTTPS/TLS cho tất cả connections
- ✅ Passwords hashed (bcrypt)
- ✅ API keys AES-256 encrypted at rest
- ✅ JWT tokens có expiry 24 giờ
- ❌ Sophia KHÔNG bao giờ yêu cầu API keys qua email

### 8. Lưu Giữ Dữ Liệu

- **Account hoạt động:** Lưu giữ 100% dữ liệu
- **Account xóa:** Xóa tất cả sau 30 ngày grace period
- **Backup:** Giữ lại 1 backup hằng ngày cho 7 ngày (để phục hồi)
- **Logs:** Lưu 90 ngày (debug/compliance)

### 9. Thay Đổi Chính Sách

Sophia AI Factory có thể cập nhật chính sách này. Email thông báo sẽ gửi 14 ngày trước. Tiếp tục sử dụng = đồng ý.

### 10. Liên Hệ

**Data Protection Officer:**
- Email: support@mekongmind.com
- Telegram: @Sophia_Bbot
- Địa chỉ: Hanoi, Vietnam (Mekong Mind)

**GDPR/EU Users:**
Nếu bạn ở EU và có thắc mắc GDPR, email support. Chúng tôi tuân thủ GDPR.

---

## EN: Privacy Policy

**Effective Date:** April 29, 2026

### 1. What Data Do We Collect?

Sophia AI Factory collects:

**Personal Data:**
- Email, company name
- Password (encrypted)
- Phone number (optional)

**Activity Data:**
- Video prompts you create
- Generated videos (metadata + R2 URLs)
- API key usage stats (not actual keys, just "used")

**Technical Data:**
- IP address, browser type
- Timestamps of actions
- Error logs from Sentry

### 2. BYOK — Your API Keys

⚠️ **IMPORTANT:** You provide your own API keys (OpenRouter, ElevenLabs, D-ID, Midjourney, etc.).

- **Encryption:** All keys encrypted at rest (AES-256)
- **Access:** Only Sophia servers access keys to call third-party APIs
- **Ownership:** No one else can access them, including Sophia team
- **Deletion:** When you delete account, all keys permanently deleted

### 3. Video Data — Storage & Deletion

- **Where stored:** Cloudflare R2 (external storage)
- **Duration:** Temporary HeyGen links (7-day auto-delete), final videos stored R2 permanently
- **Access:** Only you + Sophia admin (for debugging)
- **Delete videos:** Email support@mekongmind.com to delete old videos

### 4. Cookies & Tracking

Sophia AI Factory uses:

- **Session cookies:** Keep you logged in
- **Analytics (non-identifying):** Video count, tier usage (Sentry)
- **Google Analytics:** Only visited URLs (standard), no personal data

You can disable cookies in browser settings, but Service features degrade.

### 5. Third-Party Providers

Sophia AI Factory uses external services:

| Provider | Purpose | Data Sent | Security |
|----------|---------|-----------|----------|
| **HeyGen** | Avatar video | Prompts + voice | Encrypted, 7-day auto-delete |
| **ElevenLabs** | Voice synthesis | Text to speak | Encrypted, temp URLs |
| **MuAPI** | Images/music | Prompts | Encrypted, no storage |
| **OpenRouter** | LLM prompts | Text prompts | No storage, api-only |
| **Resend** | Email service | Email address | GDPR-compliant EU |
| **Sentry** | Error logs | Error messages (no personal) | GDPR-compliant, US-based |
| **Cloudflare R2** | Video storage | Video metadata + files | Encrypted, global edge |

⚠️ **Note:** Each provider has its own privacy policy. Review theirs.

### 6. Your Rights (GDPR + Vietnam Data Law)

You have the right to:

- ✅ **Access:** View all your data → Email support@mekongmind.com
- ✅ **Correct:** Update email, name, info → Dashboard or email
- ✅ **Delete (Right to be Forgotten):** Delete account + all data → Email request (30-day processing)
- ✅ **Export:** Download all videos, metadata → Email support
- ✅ **Opt-out:** Unsubscribe from marketing emails → Link in each email

### 7. Security & Encryption

- ✅ HTTPS/TLS for all connections
- ✅ Passwords hashed (bcrypt)
- ✅ API keys AES-256 encrypted at rest
- ✅ JWT tokens expire in 24 hours
- ❌ Sophia NEVER requests API keys via email

### 8. Data Retention

- **Active account:** Keep 100% of data
- **Deleted account:** Remove all after 30-day grace period
- **Backups:** Keep 1 daily backup for 7 days (recovery)
- **Logs:** Keep 90 days (debug/compliance)

### 9. Policy Changes

Sophia AI Factory may update this policy. 14-day email notice will be sent. Continued use = agreement.

### 10. Contact

**Data Protection Officer:**
- Email: support@mekongmind.com
- Telegram: @Sophia_Bbot
- Address: Hanoi, Vietnam (Mekong Mind)

**GDPR/EU Users:**
If you're in EU with GDPR concerns, email support. We comply with GDPR.

---

**Last Updated:** April 29, 2026
