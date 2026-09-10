# 🛡️ Security, Privacy & Cryptographic Safety Guide
# Hướng Dẫn Bảo Mật, Quyền Riêng Tư & Mã Hóa Dữ Liệu Dành Cho CEO

> **Target Audience / Đối Tượng:** Non-Technical Founders, CEOs & Legal Officers / Nhà Sáng Lập, CEO & Cố Vấn Pháp Lý Không Chuyên Kỹ Thuật  
> **Topic / Chủ Đề:** Military-Grade AES-GCM-256 Encryption, Multi-Tenant Isolation, Zero Model Training & Operator Access Control / Mã Hóa Chuẩn Quân Đội, Cách Ly Đa Thuê Bao, Cam Kết Không Huấn Luyện AI & Kiểm Soát Quyền Truy Cập  
> **Security Settings Route / Đường Dẫn:** `https://sophia.agencyos.network/settings`

---

## 🏛️ Executive Summary: Your Data is Your Sovereign Castle
## Tuyên Bố Bảo Mật: Dữ Liệu Của Bạn Là Lãnh Địa Bất Khả Xâm Phạm

**English 🇬🇧:**  
In the age of artificial intelligence, data privacy and intellectual property are your company's most valuable assets. Sophia AI Factory is engineered from the ground up on the principle of **Zero-Trust Sovereign Ownership**. We believe your creative ideas, marketing scripts, customer audiences, and AI credentials belong strictly to you—never to us, and never to public AI models.

**Tiếng Việt 🇻🇳:**  
Trong kỷ nguyên trí tuệ nhân tạo, quyền riêng tư dữ liệu và sở hữu trí tuệ là tài sản quý giá nhất của doanh nghiệp. Sophia AI Factory được xây dựng dựa trên nguyên tắc **Chủ Quyền Dữ Liệu Tuyệt Đối (Zero-Trust)**. Chúng tôi cam kết rằng mọi ý tưởng kịch bản, chiến dịch truyền thông, tệp khách hàng và khóa bảo mật AI đều thuộc quyền sở hữu duy nhất của bạn—không bao giờ thuộc về chúng tôi, và không bao giờ bị sử dụng để huấn luyện mô hình AI công cộng.

---

## 🔒 Military-Grade AES-GCM-256 Encryption
## Công Nghệ Mã Hóa Chuẩn Quân Đội AES-GCM-256

**English 🇬🇧:**  
How does Sophia protect your sensitive AI provider keys (fal.ai, ElevenLabs, OpenRouter, HeyGen)?
1. **Immediate In-Memory Encryption:** The exact millisecond you click "Save" in the Setup Wizard or Settings, your key is transformed into an unreadable scrambled cryptographic string using **AES-GCM-256** (the same encryption standard mandated by international banking networks and defense agencies).
2. **Dedicated Encryption Salt:** Every tenant workspace has unique cryptographic initialization vectors. Even if two clients had the same key, their encrypted database records look completely different.
3. **Strict Display Masking:** On your web screen, keys are permanently masked to reveal only the last 4 characters (`••••••••••••9876`). The full key is **NEVER** transmitted back to your browser once saved.
4. **Zero Terminal/Log Leakage:** Our automated code gates forbid any logging of API keys or authentication headers. Even platform database administrators cannot read your raw keys.

**Tiếng Việt 🇻🇳:**  
Sophia bảo vệ các mã khóa AI của bạn (fal.ai, ElevenLabs, OpenRouter, HeyGen) như thế nào?
1. **Mã Hóa Tức Thì Trong Bộ Nhớ:** Ngay tại thời điểm bạn nhấn nút "Lưu" trên giao diện web, mã khóa của bạn ngay lập tức được biến đổi thành chuỗi ký tự ngẫu nhiên bằng thuật toán **AES-GCM-256** (chuẩn mã hóa cao nhất được áp dụng tại các ngân hàng quốc tế và cơ quan quốc phòng).
2. **Khóa Mã Hóa Độc Bản:** Mỗi tài khoản doanh nghiệp sở hữu một vectơ mã hóa độc lập. Dù có hai khách hàng nhập cùng một khóa, dữ liệu lưu trữ trong hệ thống vẫn hoàn toàn khác biệt.
3. **Ẩn Khóa Tuyệt Đối Trên Màn Hình:** Trên giao diện web, mã khóa luôn được che khuất và chỉ hiển thị 4 số cuối (`••••••••••••9876`). Hệ thống **KHÔNG BAO GIỜ** gửi ngược toàn bộ mã khóa về trình duyệt web.
4. **Cam Kết Không Lưu Vết:** Máy chủ được thiết lập tự động để không bao giờ ghi lại mã khóa vào tệp nhật ký. Ngay cả chuyên gia quản trị cơ sở dữ liệu cũng không thể đọc được chuỗi khóa gốc của bạn.

---

## 🧱 100% Multi-Tenant Isolation: Complete Data Separation
## Cách Ly Phân Tầng Tuyệt Đối: Bảo Vệ Không Gian Độc Lập

**English 🇬🇧:**  
Sophia is built with hardened multi-tenant boundaries:
- **Database Partitioning:** Every query executed by the platform is strictly scoped by your unique tenant ID (`WHERE user_id = ?`). A client from Company A can never query, see, or accidentally receive scripts, video files, or invoices belonging to Company B.
- **Isolated Storage Buckets:** All rendered video files, custom voice samples, and brand logos are stored in private Cloudflare R2 cloud storage vaults with time-limited cryptographic download links that expire automatically.

**Tiếng Việt 🇻🇳:**  
Sophia thiết lập hàng rào ngăn cách dữ liệu tuyệt đối giữa các khách hàng:
- **Phân Vùng Cơ Sở Dữ Liệu:** Mọi câu lệnh trích xuất dữ liệu trên hệ thống đều bắt buộc phải gắn liền với mã định danh tài khoản của bạn. Khách hàng của Công ty A tuyệt đối không thể nhìn thấy, truy cập hay nhận nhầm kịch bản, video hoặc hóa đơn của Công ty B.
- **Kho Lưu Trữ Tệp Riêng Biệt:** Mọi tệp video, mẫu giọng đọc và logo thương hiệu đều được lưu trữ trong két dữ liệu đám mây Cloudflare R2 riêng tư với đường liên kết tải về có giới hạn thời gian tự hủy.

---

## 🚫 The Zero-Training Guarantee
## Cam Kết Vàng: Tuyệt Đối Không Huấn Luyện AI Trên Dữ Liệu Khách Hàng

**English 🇬🇧:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      OUR ZERO-TRAINING PLEDGE                               │
│                                                                             │
│  ❌ We NEVER sell your video ideas or scripts to data brokers.              │
│  ❌ We NEVER feed your voice clones into open-source AI models.             │
│  ❌ We NEVER use your marketing performance data for other clients.         │
│  ✅ All AI generation calls use zero-retention enterprise API endpoints.    │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Tiếng Việt 🇻🇳:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                   CAM KẾT BẢO VỆ DỮ LIỆU TỪ SOPHIA                          │
│                                                                             │
│  ❌ KHÔNG BAO GIỜ bán ý tưởng hay kịch bản video cho bên thứ ba.           │
│  ❌ KHÔNG BAO GIỜ dùng giọng nói độc quyền để huấn luyện mô hình mở.        │
│  ❌ KHÔNG BAO GIỜ chia sẻ dữ liệu hiệu quả kinh doanh của bạn.             │
│  ✅ Mọi yêu cầu tạo video đều đi qua các cổng doanh nghiệp không lưu vết.  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔑 Operator Access Delegation: You Hold the Keys
## Ủy Quyền Hỗ Trợ Kỹ Thuật: Bạn Là Người Quyết Định Duy Nhất

**English 🇬🇧:**  
Unlike legacy SaaS platforms where internal support agents have unrestricted master access to your account:
- By default, Sophia platform operators and support staff have **ZERO access** to your private workspace.
- If you encounter a complex bug and ask our team for help, you can navigate to `/settings` and toggle **"Allow Sophia Support Read-Only Access (24h)"**.
- This grants our engineers a strictly monitored, read-only diagnostic window to inspect the error.
- **Auto-Revocation:** At the 24-hour mark, access expires automatically. You can also revoke it instantly at any time with a single click.

**Tiếng Việt 🇻🇳:**  
Khác biệt hoàn toàn với các phần mềm truyền thống nơi nhân viên kỹ thuật có thể tùy ý đăng nhập vào tài khoản của bạn:
- Ở chế độ mặc định, toàn bộ nhân viên và kỹ sư Sophia **HOÀN TOÀN KHÔNG CÓ QUYỀN** xem dữ liệu trong workspace của bạn.
- Khi bạn gặp sự cố kỹ thuật phức tạp và muốn đội ngũ hỗ trợ kiểm tra, bạn chỉ cần vào `/settings` và bật công tắc **"Ủy Quyền Hỗ Trợ Đọc Dữ Liệu Tạm Thời (24 Giờ)"**.
- Tính năng này chỉ cấp quyền xem thông tin lỗi phục vụ chẩn đoán trong một khoảng thời gian nhất định.
- **Tự Động Hủy Quyền:** Đúng sau 24 giờ, quyền truy cập sẽ tự động đóng lại. Bạn cũng có thể chủ động tắt ngay lập tức bất cứ khi nào chỉ bằng một nút bấm.

---

## 🗑️ Cryptographic Data Shredding on Exit
## Tiêu Hủy Dữ Liệu Vĩnh Viễn Khi Rời Nền Tảng

**English 🇬🇧:**  
If you ever decide to close your Sophia account, we uphold your Right to be Forgotten:
- Clicking "Close Account & Delete Data" initiates a cryptographic shredding sequence.
- All stored API keys in `user_api_keys` are immediately overwritten and permanently erased.
- All video files, voiceover tracks, and project transcripts are purged from cloud storage.
- No orphan backups or ghost records remain.

**Tiếng Việt 🇻🇳:**  
Nếu bạn có kế hoạch ngưng sử dụng Sophia trong tương lai, chúng tôi tôn trọng tuyệt đối Quyền Được Lãng Quên của bạn:
- Khi chọn "Đóng Tài Khoản & Xóa Dữ Liệu", hệ thống sẽ kích hoạt quy trình tiêu hủy an toàn.
- Toàn bộ mã khóa API được mã hóa trong hệ thống sẽ bị ghi đè và xóa bỏ vĩnh viễn.
- Toàn bộ tệp video, âm thanh lồng tiếng và kịch bản lưu trên đám mây sẽ được xóa sạch.
- Không còn bất kỳ bản sao lưu ngầm nào được giữ lại.
