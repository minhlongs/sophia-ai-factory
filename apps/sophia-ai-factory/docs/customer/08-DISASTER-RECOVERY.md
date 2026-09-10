# 🌪️ Business Continuity & Disaster Recovery Guide
# Hướng Dẫn Duy Trì Hoạt Động & Khôi Phục Sự Cố Dành Cho CEO

> **Target Audience / Đối Tượng:** Non-Technical Founders & Business Continuity Planners / Nhà Sáng Lập & Quản Lý Hoạt Động Doanh Nghiệp  
> **Topic / Chủ Đề:** Handling Cloud Outages, Protecting Video Assets & 1-Click Restoration / Xử Lý Gián Đoạn Đám Mây, Bảo Vệ Tài Sản Video & Khôi Phục 1 Chạm  
> **System Health Route / Đường Dẫn:** `https://sophia.agencyos.network/settings/system-health`

---

## 🛡️ Executive Summary: Enterprise Resilience
## Tổng Quan: Khả Năng Chống Chịu Sự Cố Của Nền Tảng

**English 🇬🇧:**  
In modern digital publishing, uptime is revenue. When global cloud networks or AI providers experience downtime, your business must remain protected. Sophia AI Factory is engineered with multi-layer redundancy, distributed edge networks, and fail-safe state machines to guarantee that your creative assets, video archives, and campaign schedules are never lost during an outage.

**Tiếng Việt 🇻🇳:**  
Trong ngành kinh doanh nội dung số, thời gian hoạt động là tiền bạc. Khi các nhà mạng quốc tế hoặc nhà cung cấp AI gặp sự cố gián đoạn, hoạt động kinh doanh của bạn vẫn phải được bảo vệ an toàn. Sophia AI Factory được thiết kế với kiến trúc mạng phân tán, công nghệ sao lưu đa tầng và cơ chế tự phục hồi thông minh nhằm đảm bảo mọi kịch bản, kho lưu trữ video và lịch phát sóng của bạn không bao giờ bị mất mát.

---

## 🌐 The 3 Cloud Scenarios & What Happens
## 3 Kịch Bản Gián Đoạn Đám Mây & Cách Hệ Thống Tự Bảo Vệ

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       CLOUD RESILIENCE MATRIX                               │
│                                                                             │
│  [Scenario A] AI Provider Glitch (fal.ai, ElevenLabs, OpenRouter down)      │
│     ➔ Impact: Video creation paused; zero credit loss; auto-retry queue     │
│                                                                             │
│  [Scenario B] Internet Service Provider or Regional Cable Cut               │
│     ➔ Impact: Edge CDN routes traffic through closest working global city   │
│                                                                             │
│  [Scenario C] Browser Crash or Power Outage on Your Laptop                  │
│     ➔ Impact: Cloud continues rendering in background; video saved safe     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### Scenario A: An External AI Provider Has an Outage
### Kịch Bản A: Nhà Cung Cấp AI Bị Quá Tải Hoặc Bảo Trì

**English 🇬🇧:**
- **What Sophia Does Automatically:** If fal.ai, ElevenLabs, or OpenRouter goes offline, Sophia immediately catches the failure, freezes the mission in a safe `PAUSED` state, and prevents your MCU credits from being consumed.
- **Your Data Safety:** Your script prompt, chosen style, and completed scenes are safely preserved in the database.
- **How to Recover:** Once the provider restores service, navigate to `/operations` and click **"Resume All Paused Jobs"**. Sophia resumes rendering seamlessly without starting from scratch.

**Tiếng Việt 🇻🇳:**
- **Hệ Thống Tự Động Xử Lý:** Nếu fal.ai, ElevenLabs hoặc OpenRouter tạm dừng hoạt động, Sophia sẽ tự động nhận diện lỗi, chuyển video sang trạng thái `TẠM DỪNG AN TOÀN` và tuyệt đối không trừ điểm MCU của bạn.
- **An Toàn Dữ Liệu:** Toàn bộ nội dung kịch bản, phong cách đã chọn và các phân cảnh đã dựng xong đều được lưu trữ nguyên vẹn trên cơ sở dữ liệu.
- **Cách Khôi Phục:** Khi nhà cung cấp AI hoạt động trở lại, bạn chỉ cần vào `/operations` và bấm **"Tiếp Tục Chạy Video"**. Hệ thống sẽ dựng tiếp các phần còn lại mà không phải làm lại từ đầu.

---

### Scenario B: Global Cable Cut or Regional Internet Lag
### Kịch Bản B: Sự Cố Đứt Cáp Quang Biển Hoặc Mạng Quốc Tế Chậm

**English 🇬🇧:**
- **What Sophia Does Automatically:** Sophia is hosted across Cloudflare's global edge network spanning 300+ cities worldwide. If one international cable route degrades, traffic is automatically routed to the nearest operating edge node.
- **Your Experience:** Video downloads and streaming remain fast and accessible worldwide, even if local internet connections experience intermittent slowdowns.

**Tiếng Việt 🇻🇳:**
- **Hệ Thống Tự Động Xử Lý:** Sophia hoạt động trên hạ tầng mạng đám mây toàn cầu với hơn 300 trung tâm dữ liệu khắp thế giới. Nếu một tuyến cáp quang quốc tế gặp trục trặc, hệ thống sẽ tự động chuyển hướng truy cập qua các tuyến cáp dự phòng khác.
- **Trải Nghiệm Khách Hàng:** Quá trình xem trước và tải video về máy vẫn được duy trì ổn định, đảm bảo khán giả toàn cầu vẫn xem được nội dung mượt mà.

---

### Scenario C: Your Computer Crashes or Loses Power Mid-Render
### Kịch Bản C: Máy Tính Của Bạn Bị Sập Nguồn Hoặc Tắt Trình Duyệt

**English 🇬🇧:**
- **The Golden Rule:** Video rendering happens **entirely in the cloud**, not on your personal laptop or mobile phone.
- If your device runs out of battery, loses Wi-Fi, or crashes, the cloud continues rendering uninterrupted.
- When you turn your computer back on and log in, your completed video will be waiting for you in your dashboard!

**Tiếng Việt 🇻🇳:**
- **Nguyên Tắc Cốt Lõi:** Toàn bộ quá trình dựng video diễn ra **hoàn toàn trên máy chủ đám mây**, không phụ thuộc vào cấu hình hay pin của máy tính cá nhân.
- Nếu laptop của bạn bị sập nguồn, mất kết nối Wi-Fi hoặc tắt trình duyệt, máy chủ vẫn tiếp tục xử lý bình thường.
- Khi bạn mở máy lại và đăng nhập vào tài khoản, video hoàn chỉnh đã nằm sẵn sàng trong mục danh sách video!

---

## 💾 How to Create Your Own Business Safety Backup
## Cách Tạo Bản Sao Lưu An Toàn Cho Doanh Nghiệp

**English 🇬🇧:**
While Sophia maintains 99.999999999% cloud storage durability for your assets, every prudent CEO should maintain an independent offline archive:
1. **Download Monthly Video Master Archive:**
   - Go to `/operations` and filter by "Completed (This Month)".
   - Click **"Batch Download (ZIP)"** to save all rendered Full HD MP4 files directly to your external hard drive or corporate Google Drive / Dropbox.
2. **Export Campaign Scripts & Performance:**
   - Go to `/dashboard/missions`.
   - Click **"Export Campaigns (CSV/JSON)"** to download a spreadsheet containing all video titles, scripts, hashtags, and performance metrics.

**Tiếng Việt 🇻🇳:**
Mặc dù Sophia lưu trữ dữ liệu trên hệ thống đám mây siêu bền vững, một người lãnh đạo thông thái luôn chủ động lưu trữ bản sao dự phòng ngoại tuyến:
1. **Tải Về Trọn Bộ Video Gốc Hằng Tháng:**
   - Truy cập vào `/operations`, lọc danh sách "Đã Hoàn Tất (Tháng Này)".
   - Nhấn **"Tải Hàng Loạt (File Nén ZIP)"** để lưu toàn bộ video chuẩn Full HD về ổ cứng máy tính hoặc Google Drive / Dropbox của công ty.
2. **Xuất Bản Kê Kịch Bản & Hiệu Quả Truyền Thông:**
   - Truy cập vào mục `/dashboard/missions`.
   - Nhấn nút **"Xuất Dữ Liệu (CSV/Excel)"** để tải về bảng tính lưu trữ toàn bộ tiêu đề, kịch bản, bộ hashtag và các chỉ số đo lường.

---

## 🔄 Emergency Recovery Checklist (3 Simple Steps)
## Quy Trình 3 Bước Khôi Phục Khẩn Cấp Dành Cho CEO

| Step / Bước | Action / Thao Tác | Screen / Màn Hình | What It Achieves / Mục Đích |
|---|---|---|---|
| **1** | Check System Health / Kiểm Tra Sức Khỏe | `/settings/system-health` | Identify if any provider is down / Phát hiện dịch vụ gián đoạn |
| **2** | Test AI Keys / Kiểm Tra Lại Khóa | `/settings` ➔ API Keys | Confirm green ACTIVE status / Xác nhận kết nối đã thông |
| **3** | Resume Paused Jobs / Tiếp Tục Hàng Đợi | `/operations` | Resume all paused renders / Tiếp tục dựng các video tạm dừng |
