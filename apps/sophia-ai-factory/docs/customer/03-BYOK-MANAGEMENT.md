# 🔑 Bring Your Own Key (BYOK) Management Guide
# Hướng Dẫn Quản Lý Khóa API Cá Nhân (BYOK) Dành Cho CEO

> **Target Audience / Đối Tượng:** Non-Technical Founders & Business Owners / Nhà Sáng Lập & Chủ Doanh Nghiệp Không Chuyên Kỹ Thuật  
> **Topic / Chủ Đề:** Acquiring, Connecting, Masking, and Rotating AI Provider Keys / Hướng Dẫn Mua, Kết Nối, Che Khóa & Thay Đổi Khóa AI  
> **Supported Providers / Nhà Cung Cấp Hỗ Trợ:** fal.ai, ElevenLabs, OpenRouter, HeyGen, D-ID  
> **Settings Route / Đường Dẫn:** `https://sophia.agencyos.network/settings`

---

## 💡 What is BYOK and Why Does It Benefit You?
## Cơ Chế BYOK Là Gì Và Mang Lại Lợi Ích Gì Cho Bạn?

**English 🇬🇧:**  
**BYOK** stands for **"Bring Your Own Key"**. In traditional SaaS platforms, vendors mark up AI costs by 300% to 500%. In Sophia AI Factory, we charge zero markup on AI computing:
1. **100% Asset & Account Ownership:** Your generation history and voice models belong to you directly on the AI provider platforms.
2. **Wholesale Pricing:** You pay exact creator wholesale rates ($0.02 per image, $0.01 per voiceover) directly to the providers.
3. **Zero Lock-In:** You can rotate, pause, or transfer your keys at any time.
4. **Bank-Grade Encryption:** Sophia stores your keys using military-grade **AES-GCM-256 encryption** with strict multi-tenant isolation. No engineer or third party can ever view your raw keys.

**Tiếng Việt 🇻🇳:**  
**BYOK** là viết tắt của **"Bring Your Own Key" (Tự Quản Lý Khóa Của Bạn)**. Trong các nền tảng truyền thống, chi phí AI thường bị đội giá từ 300% đến 500%. Tại Sophia AI Factory, chúng tôi cam kết không phụ thu bất kỳ khoản chênh lệch nào:
1. **Sở Hữu Trọn Vẹn Tài Sản & Dữ Liệu:** Lịch sử tạo video và mẫu giọng đọc thuộc về chính tài khoản của bạn tại nhà cung cấp AI.
2. **Chi Phí Giá Gốc:** Bạn chỉ trả đúng chi phí gốc (khoảng 500đ cho mỗi bức ảnh siêu thực, 300đ cho một đoạn thuyết minh) trực tiếp cho nhà cung cấp.
3. **Không Bị Ràng Buộc:** Bạn có toàn quyền bật, tắt, thay mới hoặc xóa bỏ khóa bất cứ khi nào.
4. **Mã Hóa Chuẩn Quân Đội:** Sophia bảo vệ khóa của bạn bằng công nghệ **mã hóa AES-GCM-256** với phân vùng cách ly tuyệt đối giữa các khách hàng. Không một kỹ sư hay bên thứ ba nào có thể xem được khóa gốc của bạn.

---

## 🚦 The 7 Safe BYOK Statuses
## 7 Trạng Thái Khóa An Toàn Của Hệ Thống

**English 🇬🇧:**  
When you connect an API key in Sophia, our health checker probes the provider and displays one of 7 clear statuses:

| Status Badge | Meaning | What You Need To Do |
|---|---|---|
| 🟢 **ACTIVE** | Key is valid, healthy, and has sufficient credits. | Everything is ready. You can generate videos! |
| 🟡 **VALIDATING** | Sophia is currently testing the connection (takes 1-3s). | Wait a few seconds for the green checkmark. |
| ⚪ **NOT_CONFIGURED** | No key has been entered for this provider yet. | Optional or required depending on the feature. |
| 🔴 **INVALID** | The key was rejected by the provider (typo or expired). | Double-check and re-paste your key. |
| ⛔ **REVOKED** | The key was cancelled on the provider's dashboard. | Generate a fresh key on the provider site. |
| ⚠️ **PROVIDER_UNAVAILABLE** | The provider service is currently down or experiencing lag. | Check provider status or try again in a few minutes. |
| ❓ **UNKNOWN** | Network timeout during validation check. | Click "Test Connection" to re-verify. |

**Tiếng Việt 🇻🇳:**  
Khi bạn kết nối khóa API vào Sophia, hệ thống kiểm tra tự động sẽ hiển thị 1 trong 7 trạng thái rõ ràng:

| Huy Hiệu Trạng Thái | Ý Nghĩa Thực Tế | Thao Tác Cần Thực Hiện |
|---|---|---|
| 🟢 **HOẠT ĐỘNG (ACTIVE)** | Khóa chính xác, kết nối tốt và tài khoản còn số dư. | Mọi thứ hoàn hảo. Bạn có thể xuất bản video ngay! |
| 🟡 **ĐANG KIỂM TRA** | Hệ thống đang gửi tín hiệu thử nghiệm (mất 1-3 giây). | Chờ vài giây để nhận thông báo thành công. |
| ⚪ **CHƯA CẤU HÌNH** | Chưa nhập khóa cho nhà cung cấp dịch vụ này. | Tùy chọn nhập thêm nếu cần tính năng chuyên biệt. |
| 🔴 **KHÔNG HỢP LỆ** | Khóa bị từ chối (do dán nhầm hoặc thiếu ký tự). | Kiểm tra kỹ và dán lại chính xác chuỗi ký tự. |
| ⛔ **ĐÃ THU HỒI (REVOKED)** | Khóa đã bị xóa hoặc hủy kích hoạt tại trang gốc. | Đăng nhập nhà cung cấp để tạo một khóa mới. |
| ⚠️ **NHÀ CUNG CẤP LỖI** | Máy chủ nhà cung cấp AI đang bảo trì hoặc quá tải. | Chờ vài phút rồi kiểm tra lại. |
| ❓ **CHƯA XÁC ĐỊNH** | Mất kết nối mạng tạm thời trong lúc kiểm tra. | Nhấn nút "Kiểm Tra Lại" để kết nối lại. |

---

## 🛠️ Step-by-Step Provider Setup Guides
## Hướng Dẫn Chi Tiết Cách Lấy Khóa Từng Nhà Cung Cấp

---

### 1. 🎨 fal.ai — Cinematic Image & Visual Generation
### 1. 🎨 fal.ai — Tạo Hình Ảnh Điện Ảnh & Phân Cảnh Chân Thực

**Role in Sophia:** Renders ultra-realistic visual scenes and thumbnails using cutting-edge Flux and SD models.  
**Vai trò trong Sophia:** Vẽ hình ảnh phân cảnh siêu thực và ảnh bìa thu hút người xem.

**English 🇬🇧:**
1. Visit [https://fal.ai](https://fal.ai) and click **"Sign In"** (you can use your GitHub or Google account).
2. Click on your profile avatar in the top right corner and select **"Billing"**.
3. Add a payment card and deposit a small starting balance ($5.00 to $10.00 is plenty for hundreds of images).
4. Navigate to **"Keys"** in the left menu.
5. Click **"Add Key"**, name it `"Sophia Factory"`, and click **"Create"**.
6. Copy the generated key (starts with a UUID or alphanumeric sequence).
7. Return to Sophia (`/settings`), find **fal.ai**, paste the key, and click **"Test & Save"**.

**Tiếng Việt 🇻🇳:**
1. Truy cập [https://fal.ai](https://fal.ai) và chọn **"Sign In"** (đăng nhập bằng Google rất nhanh chóng).
2. Nhấp vào ảnh đại diện góc trên cùng bên phải và chọn mục **"Billing" (Nạp Tiền)**.
3. Thêm thẻ thanh toán quốc tế (Visa/Mastercard) và nạp thử $5 đến $10 (đủ để tạo hàng trăm hình ảnh sắc nét).
4. Chọn mục **"Keys" (Khóa API)** ở thanh menu bên trái.
5. Nhấn nút **"Add Key"**, đặt tên gợi nhớ như `"Sophia Factory"` và nhấn **"Create"**.
6. Sao chép đoạn mã khóa vừa hiển thị.
7. Quay lại trang cài đặt Sophia (`/settings`), tìm dòng **fal.ai**, dán mã vào và bấm **"Kiểm Tra & Lưu"**.

---

### 2. 🎙️ ElevenLabs — Human-Like Emotional Voiceover
### 2. 🎙️ ElevenLabs — Lồng Tiếng Siêu Thực Đa Cảm Xúc

**Role in Sophia:** Synthesizes crystal-clear voice narration in Vietnamese, English, and 29+ languages.  
**Vai trò trong Sophia:** Lồng tiếng truyền cảm, chuẩn ngữ điệu tự nhiên cho video với hơn 29 ngôn ngữ.

**English 🇬🇧:**
1. Visit [https://elevenlabs.io](https://elevenlabs.io) and create an account.
2. Select a subscription tier (the Starter plan at $5/month provides ample characters for automated channels).
3. Click on your profile picture in the bottom left corner and select **"Profile + API key"**.
4. Click the eye icon to reveal your API key, then click **"Copy"**.
5. Return to Sophia (`/settings`), find **ElevenLabs**, paste your key, and click **"Test & Save"**.

**Tiếng Việt 🇻🇳:**
1. Truy cập [https://elevenlabs.io](https://elevenlabs.io) và đăng ký tài khoản.
2. Chọn gói sử dụng phù hợp (gói Starter chỉ $5/tháng đã cung cấp lượng ký tự dồi dào cho kênh video).
3. Bấm vào ảnh hồ sơ ở góc dưới bên trái màn hình, chọn **"Profile + API key"**.
4. Nhấn vào biểu tượng con mắt để xem toàn bộ mã khóa, sau đó nhấn **"Copy"**.
5. Quay lại cài đặt Sophia (`/settings`), tìm dòng **ElevenLabs**, dán khóa vào và nhấn **"Kiểm Tra & Lưu"**.

---

### 3. 🧠 OpenRouter — Intelligent Scriptwriting & Hook Creation
### 3. 🧠 OpenRouter — Soạn Kịch Bản & Ý Tưởng Hút Người Xem

**Role in Sophia:** The brain behind your viral scripts. Connects to Claude 3.5 Sonnet, GPT-4o, and DeepSeek.  
**Vai trò trong Sophia:** Bộ não sáng tạo kịch bản, tự động viết lời mở đầu giật gân và nội dung hấp dẫn.

**English 🇬🇧:**
1. Visit [https://openrouter.ai](https://openrouter.ai) and sign in.
2. Go to the **"Credits"** section and top up $5.00 via card or crypto.
3. Navigate to **"Keys"** in the navigation bar.
4. Click **"Create Key"**, give it the name `"Sophia-Scripts"`, and click **"Create"**.
5. Copy the key (starts with `sk-or-v1-...`).
6. Paste into Sophia under **OpenRouter** and click **"Test & Save"**.

**Tiếng Việt 🇻🇳:**
1. Truy cập [https://openrouter.ai](https://openrouter.ai) và đăng nhập.
2. Vào mục **"Credits"** và nạp một khoản nhỏ khoảng $5 bằng thẻ hoặc tiền mã hóa.
3. Chọn mục **"Keys" (Khóa)** trên thanh điều hướng.
4. Nhấn **"Create Key"**, đặt tên `"Sophia-Scripts"` và nhấn xác nhận.
5. Sao chép chuỗi ký tự hiển thị (thường bắt đầu bằng `sk-or-v1-...`).
6. Dán vào mục **OpenRouter** trên Sophia và nhấn **"Kiểm Tra & Lưu"**.

---

### 4. 👤 HeyGen & D-ID — Realistic Talking Head Avatars
### 4. 👤 HeyGen & D-ID — Nhân Vật Ảo Diễn Thuyết Sinh Động

**Role in Sophia:** Creates realistic human spokespersons presenting your products or news bulletins.  
**Vai trò trong Sophia:** Xuất bản video có MC hoặc người mẫu ảo nói chuyện chân thực theo kịch bản.

**English 🇬🇧:**
- **HeyGen:** Sign in at [https://heygen.com](https://heygen.com) ➔ Settings ➔ Space Settings ➔ API ➔ Generate Token.
- **D-ID:** Sign in at [https://studio.d-id.com](https://studio.d-id.com) ➔ Settings ➔ API Keys ➔ Create New Key.
- Paste your chosen avatar key into Sophia to unlock talking-avatar video templates.

**Tiếng Việt 🇻🇳:**
- **HeyGen:** Đăng nhập tại [https://heygen.com](https://heygen.com) ➔ Vào Cài Đặt Không Gian ➔ Mục API ➔ Tạo Mã Token.
- **D-ID:** Đăng nhập tại [https://studio.d-id.com](https://studio.d-id.com) ➔ Cài Đặt ➔ Khóa API ➔ Tạo Khóa Mới.
- Dán khóa tương ứng vào Sophia để kích hoạt các mẫu video có người ảo xuất hiện thuyết trình.

---

## 🔄 How to Rotate or Revoke Keys Safely
## Cách Thay Đổi Hoặc Xóa Khóa An Toàn

**English 🇬🇧:**
If you ever suspect a key was compromised or you want to rotate it as part of your company's security protocol:
1. Navigate to `/settings` ➔ **"API Keys"**.
2. Locate the provider you wish to update.
3. **To Replace:** Simply click the **"Replace"** button, paste your new key, and click **"Save & Verify"**. Sophia will overwrite the old encrypted record immediately.
4. **To Delete:** Click the **"Revoke"** or trash can icon. Sophia instantly shreds the encrypted key from the database.

**Tiếng Việt 🇻🇳:**
Nếu bạn nghi ngờ mã khóa bị lộ hoặc muốn định kỳ thay đổi khóa bảo mật theo quy định công ty:
1. Truy cập vào `/settings` ➔ Mục **"Khóa API"**.
2. Tìm nhà cung cấp bạn muốn cập nhật.
3. **Để Thay Khóa Mới:** Chỉ cần nhấn nút **"Thay Đổi"**, dán mã mới vào và bấm **"Lưu & Xác Thực"**. Sophia sẽ ghi đè khóa mới đã được mã hóa an toàn ngay lập tức.
4. **Để Xóa Bỏ:** Nhấn vào biểu tượng **"Hủy Bỏ / Xóa Khóa"**. Hệ thống sẽ ngay lập tức xóa vĩnh viễn khóa khỏi cơ sở dữ liệu.
