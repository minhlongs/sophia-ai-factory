# 🆘 CEO Troubleshooting & Incident Resolution Guide
# Cẩm Nang Xử Lý 10 Sự Cố Phổ Biến Nhất Dành Cho CEO

> **Target Audience / Đối Tượng:** Non-Technical Founders & Business Owners / Nhà Sáng Lập & Chủ Doanh Nghiệp Không Chuyên Kỹ Thuật  
> **Topic / Chủ Đề:** Fast, Plain-Language Solutions for the Top 10 Operational Incidents / Khắc Phục Nhanh 10 Lỗi Thường Gặp Bằng Giao Diện Web  
> **Health Center Route / Đường Dẫn:** `https://sophia.agencyos.network/settings/system-health`

---

## 🧭 The CEO Incident Philosophy: Clarity Over Confusion
## Triết Lý Xử Lý Sự Cố: Rõ Ràng, Tự Tin, Không Biển Từ Kỹ Thuật

**English 🇬🇧:**  
When something goes wrong in your video factory, you should never have to decipher cryptic computer codes, open a terminal, or guess what happened. Every error in Sophia is translated into human-readable business language with a clear explanation, an actionable remedy, and a safe one-click retry button.

**Tiếng Việt 🇻🇳:**  
Khi có sự cố xảy ra trong nhà máy video, bạn không bao giờ phải đọc những dòng mã kỹ thuật khó hiểu, không cần mở cửa sổ dòng lệnh và không phải đoán già đoán non. Mọi cảnh báo trên Sophia đều được chuyển ngữ sang ngôn ngữ kinh doanh gần gũi, chỉ rõ nguyên nhân, cách xử lý trực tiếp trên giao diện web và nút bấm thử lại an toàn.

---

## 🛠️ Resolving the Top 10 Common Incidents
## Hướng Dẫn Chi Tiết Khắc Phục 10 Vấn Đề Thường Gặp

---

### Incident 1: 🔑 AI Key Expired or Invalid (`KEY_EXPIRED_OR_INVALID`)
### Sự Cố 1: Khóa AI Hết Hạn Hoặc Dán Chưa Chính Xác

- 📌 **What Happened / Chuyện Gì Đã Xảy Ra:**  
  *EN:* The AI provider (fal.ai, ElevenLabs, or OpenRouter) rejected your key because it was typed incorrectly, missing characters, or expired.  
  *VI:* Nhà cung cấp AI từ chối khóa kết nối vì chuỗi ký tự bị dán thiếu, dán nhầm khoảng trắng hoặc khóa đã hết hạn.
- 🛠️ **What You Can Do / Cách Xử Lý:**  
  1. Open your browser and go to `/settings` ➔ **"API Keys"**.
  2. Find the provider card showing the red `INVALID` badge.
  3. Click **"Replace"**, copy the key freshly from the provider's website, and paste it into the box.
  4. Click **"Save & Test"** until the badge turns green (`ACTIVE`).
- 🔄 **Try Again / Thử Lại:**  
  Return to `/operations`, locate the paused video, and click **"Retry Video"**.

---

### Incident 2: 💳 AI Provider Balance Empty (`QUOTA_EXHAUSTED`)
### Sự Cố 2: Số Dư Tại Tài Khoản AI Nhà Cung Cấp Đã Hết

- 📌 **What Happened / Chuyện Gì Đã Xảy Ra:**  
  *EN:* Your account balance on fal.ai, ElevenLabs, or OpenRouter reached $0.00, causing them to pause API calls.  
  *VI:* Số dư tài khoản trả trước của bạn tại fal.ai, ElevenLabs hoặc OpenRouter đã về 0đ khiến dịch vụ tạm ngưng.
- 🛠️ **What You Can Do / Cách Xử Lý:**  
  1. Log into your provider website (e.g., fal.ai/billing or openrouter.ai/credits).
  2. Add a small top-up ($5.00 to $10.00 is usually enough for weeks of video creation).
  3. Go to Sophia's `/settings/system-health` and click **"Refresh Status"**.
- 🔄 **Try Again / Thử Lại:**  
  Click **"Retry Video"** in your Operations Center. The job will pick up where it left off without consuming extra Sophia MCU.

---

### Incident 3: ⏱️ Provider Rate Limit or Busy (`PROVIDER_RATE_LIMIT`)
### Sự Cố 3: Nhà Cung Cấp Đang Quá Tải Hoặc Gửi Quá Nhanh

- 📌 **What Happened / Chuyện Gì Đã Xảy Ra:**  
  *EN:* The AI provider is experiencing heavy global traffic and temporarily requested a short pause.  
  *VI:* Máy chủ của nhà cung cấp AI đang tiếp nhận quá nhiều yêu cầu trên toàn cầu và cần thời gian xử lý.
- 🛠️ **What You Can Do / Cách Xử Lý:**  
  *EN:* No action needed! Sophia's intelligent queue has an automatic back-off system that waits 30 seconds and retries seamlessly.  
  *VI:* Bạn không cần làm gì cả! Hệ thống hàng đợi của Sophia sẽ tự động chờ khoảng 30 giây và tiếp tục chạy mượt mà.

---

### Incident 4: ❄️ Video Generation Freezes Past 3 Minutes (`RENDER_TIMEOUT`)
### Sự Cố 4: Quá Trình Dựng Video Bị Treo Quá 3 Phút

- 📌 **What Happened / Chuyện Gì Đã Xảy Ra:**  
  *EN:* A cloud network hiccup interrupted the communication between the rendering engine and cloud storage.  
  *VI:* Kết nối mạng đám mây bị gián đoạn giữa bộ dựng video và kho lưu trữ tệp.
- 🛠️ **What You Can Do / Cách Xử Lý:**  
  1. Go to `/operations` and click on the affected job card.
  2. Click **"Cancel & Restart"**.
  3. Sophia will clear the stuck temporary cache and re-dispatch the job. Your MCU credits are protected and will not be deducted twice.

---

### Incident 5: 🛡️ AI Content Safety Trigger (`SAFETY_FILTER_FLAGGED`)
### Sự Cố 5: Nội Dung Bị Bộ Lọc An Toàn Của AI Chặn Lại

- 📌 **What Happened / Chuyện Gì Đã Xảy Ra:**  
  *EN:* The AI scriptwriter or image engine detected a sensitive word (violence, trademarked brand names, political claims) and refused to process it.  
  *VI:* Nhà cung cấp AI nhận diện một từ nhạy cảm (bạo lực, tên thương hiệu lớn hoặc nội dung cấm) trong kịch bản.
- 🛠️ **What You Can Do / Cách Xử Lý:**  
  1. Open the video review screen.
  2. Replace sensitive words with neutral synonyms (e.g. replace "kill the competition" with "outperform rival brands").
  3. Click **"Re-generate Script"**.

---

### Incident 6: 🔤 Subtitles Misaligned or Covering Key Visuals
### Sự Cố 6: Phụ Đề Bị Lệch Dòng Hoặc Che Mất Nội Dung Hình Ảnh

- 📌 **What Happened / Chuyện Gì Đã Xảy Ra:**  
  *EN:* Subtitle position conflicts with the visual elements of a particular scene.  
  *VI:* Vị trí chữ chạy phụ đề bị trùng vào chi tiết quan trọng trong bức ảnh.
- 🛠️ **What You Can Do / Cách Xử Lý:**  
  1. In the video edit panel, look for **"Subtitle Position"**.
  2. Change position from *Center* to *Bottom-Third* or *Top-Third*.
  3. Click **"Quick Re-composite"** (takes only 15 seconds).

---

### Incident 7: 🔇 Voice Narration Audio Missing or Distorted
### Sự Cố 7: Video Không Có Tiếng Hoặc Giọng Đọc Bị Giật

- 📌 **What Happened / Chuyện Gì Đã Xảy Ra:**  
  *EN:* Voiceover synthesis failed during audio track muxing.  
  *VI:* Quá trình ghép tệp âm thanh vào khung hình bị lỗi nhẹ do mất gói tin.
- 🛠️ **What You Can Do / Cách Xử Lý:**  
  1. In `/dashboard/missions`, click **"Voice Settings"**.
  2. Preview the voice model sample using the speaker icon.
  3. If the voice works, click **"Re-render Audio Track"**.

---

### Incident 8: 📱 Telegram Bot Stops Sending Video Previews
### Sự Cố 8: Bot Telegram Ngưng Gửi Thông Báo Video Về Điện Thoại

- 📌 **What Happened / Chuyện Gì Đã Xảy Ra:**  
  *EN:* The pairing token between your Telegram user ID and Sophia expired or was unlinked.  
  *VI:* Mã liên kết giữa tài khoản Telegram và hệ thống Sophia bị ngắt kết nối.
- 🛠️ **What You Can Do / Cách Xử Lý:**  
  1. Open Telegram and search for `@Sophia_Bbot`.
  2. Send `/start` then `/pair`.
  3. Copy the 6-digit code and enter it in Sophia under `/settings` ➔ "Telegram Integration".

---

### Incident 9: 🌐 Social Upload Fails (YouTube or TikTok Token Expired)
### Sự Cố 9: Lỗi Tải Video Lên Kênh Mạng Xã Hội

- 📌 **What Happened / Chuyện Gì Đã Xảy Ra:**  
  *EN:* Google or TikTok security policies require accounts to refresh their authorization tokens periodically (every 30 to 60 days).  
  *VI:* Chính sách bảo mật của YouTube/TikTok yêu cầu làm mới quyền kết nối định kỳ sau 30-60 ngày.
- 🛠️ **What You Can Do / Cách Xử Lý:**  
  1. Go to `/settings` ➔ **"Social Integrations"**.
  2. Click **"Reconnect YouTube"** or **"Reconnect TikTok"**.
  3. Approve the login prompt in your browser window. Once green, click **"Retry Publish"** in the Operations Center.

---

### Incident 10: 🪙 Crypto Payment Sent But MCU Balance Not Updated
### Sự Cố 10: Đã Chuyển Tiền Crypto Nhưng Chưa Thấy Cộng Điểm MCU

- 📌 **What Happened / Chuyện Gì Đã Xảy Ra:**  
  *EN:* The blockchain transaction is waiting for sufficient block confirmations (usually takes 1 to 5 minutes on USDT-TRC20, or up to 20 minutes on Bitcoin).  
  *VI:* Giao dịch trên mạng lưới blockchain đang chờ đủ số lượt xác thực khối (khoảng 1-5 phút với USDT hoặc 15-20 phút với Bitcoin).
- 🛠️ **What You Can Do / Cách Xử Lý:**  
  1. Check your crypto wallet to confirm the transfer status is marked as "Completed".
  2. Refresh the `/settings/usage` page after 3 minutes.
  3. If not updated after 15 minutes, click **"Check Transaction Status"** on your invoice, or submit a support ticket with your transaction hash (TxID).

---

## 📦 How to Download a Sanitized Diagnostic Bundle & Submit a Ticket
## Cách Tải Báo Cáo Chẩn Đoán An Toàn & Gửi Yêu Cầu Hỗ Trợ

**English 🇬🇧:**
If you ever need human help from the Sophia support engineering team:
1. Navigate to `/operations` or `/settings/system-health`.
2. Click the button labeled **"Download Diagnostic Report"**.
3. Sophia generates a safe, sanitized diagnostic file (`diagnostic-report-xxx.json`).
   - *Security Guarantee:* This file contains system version, provider connection status, and error codes. It **NEVER** includes your passwords, raw API keys, private video scripts, or customer personal information.
4. Click **"Contact Support"** to open the integrated support modal.
5. Enter your issue summary, select urgency (Normal, High, or Urgent), attach the diagnostic report, and click **"Submit Ticket"**.
6. Our support team will review your report and respond directly within your dashboard.

**Tiếng Việt 🇻🇳:**
Khi bạn cần sự trợ giúp trực tiếp từ đội ngũ chuyên gia của Sophia:
1. Truy cập vào mục `/operations` hoặc `/settings/system-health`.
2. Nhấp vào nút **"Tải Báo Cáo Chẩn Đoán"**.
3. Hệ thống sẽ tự động tạo một tệp chẩn đoán an toàn (`diagnostic-report-xxx.json`).
   - *Cam Kết Bảo Mật:* Tệp này chỉ chứa thông tin phiên bản phần mềm, trạng thái kết nối và mã lỗi. Tuyệt đối **KHÔNG BAO GIỜ** chứa mật khẩu, mã khóa API gốc hay kịch bản video riêng tư của bạn.
4. Nhấn nút **"Gửi Hỗ Trợ"** để mở cửa sổ yêu cầu trợ giúp.
5. Điền tóm tắt vấn đề, chọn mức độ ưu tiên ("Bình Thường", "Cao", hoặc "Khẩn Cấp"), đính kèm tệp chẩn đoán và bấm **"Gửi Yêu Cầu"**.
6. Đội ngũ hỗ trợ sẽ phân tích và phản hồi trực tiếp ngay trên bảng điều khiển của bạn.
