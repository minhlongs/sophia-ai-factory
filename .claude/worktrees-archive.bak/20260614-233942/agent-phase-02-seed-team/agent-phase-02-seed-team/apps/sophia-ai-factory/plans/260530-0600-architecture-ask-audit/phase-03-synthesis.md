# Báo Cáo Tổng Hợp Kiến Trúc Hệ Thống: Sophia AI Factory

Báo cáo này tổng hợp kết quả đánh giá từ 4 vai trò cố vấn chuyên môn (Systems Designer, Technology Strategist, Scalability Consultant, Risk Analyst) dựa trên mã nguồn hiện tại của dự án Sophia AI Factory tại thư mục `/Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory`.

---

## 1. Đánh Giá Tổng Quan Kiến Trúc & Sự Đồng Bộ

Hệ thống hoạt động trên mô hình kiến trúc **4 Tầng Mekong** (`land` → `forest` → `tree` → `seed`) với quy tắc phụ thuộc một chiều được kiểm tra tự động bằng ESLint thông qua [eslint.config.mjs](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/eslint.config.mjs).

### Sự kết hợp công nghệ (Tech Stack Synergy):
*   **Next.js 16 + Cloudflare Workers (Edge layer):** Đảm bảo zero-cold start và độ trễ cực thấp bằng cách đồng vị trí (co-locate) Edge runtime với Cloudflare D1 (SQLite) và R2 (Object Storage). Quá trình deploy được thực hiện thông qua `@opennextjs/cloudflare`.
*   **Inngest Event Pipeline + n8n Visual Automation (Execution layer):**
    *   **Inngest:** Đảm nhận các tác vụ xử lý AI tuần tự phức tạp (Wan 2.1 + Fish Speech) với cơ chế retry và type-safety chặt chẽ.
    *   **n8n:** Dùng để xây dựng nhanh các kịch bản (script generator) và render video. Tuy nhiên, việc n8n tích hợp với Airtable CMS tạo ra điểm nghẽn nghiêm trọng do Airtable bị giới hạn rate-limit (5 requests/sec).

---

## 2. Các Rủi Ro Bảo Mật & Rủi Ro Vận Hành Ưu Tiên Cao

Dưới góc nhìn của Risk Analyst và Scalability Consultant, hệ thống có các rủi ro lớn sau:

### A. Rủi ro Lưu trữ BYOK Credentials trên D1:
*   **Universal Compromise (SPOF):** Tất cả API keys của người dùng (OpenRouter, Anthropic, ElevenLabs, D-ID, Muapi) được mã hóa bằng AES-GCM-256 sử dụng một key duy nhất là `BYOK_MASTER_KEY`. Nếu key này bị rò rỉ, toàn bộ thông tin khóa của khách hàng sẽ bị lộ.
*   **Không hỗ trợ xoay vòng khóa (No Key Rotation):** Xoay vòng `BYOK_MASTER_KEY` sẽ làm hỏng tất cả khóa của người dùng hiện tại do thiếu cơ chế tự động giải mã và mã hóa lại với key mới.
*   **Thiếu SQLite Row-Level Security (RLS):** D1 không hỗ trợ RLS. Sự cô lập giữa các tenant hoàn toàn phụ thuộc vào bộ lọc ở tầng ứng dụng (`WHERE tenant_id = ?`). Các bảng thiếu `org_id` hoặc các truy vấn bị sót bộ lọc có nguy cơ rò rỉ khóa chéo tenant.

### B. Lỗ hổng Xác thực Webhook (NOWPayments, PayOS, HeyGen):
*   **Timing Leak:** Hàm so sánh signature `timingSafeEqual` trong [signature.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/lib/webhooks/signature.ts) trả về `false` ngay lập tức nếu độ dài chuỗi khác nhau, để lộ thông tin độ dài signature qua thời gian phản hồi.
*   **Thiếu Replay Window Check:** Inbound webhooks không được kiểm tra timestamp hoặc độ lệch thời gian (skew time), khiến hệ thống dễ bị tấn công phát lại (replay attacks). Chỉ dựa vào kiểm tra trạng thái `processed` trong bảng `payment_events`.
*   **Lỗ hổng HeyGen Webhook:** Bản sửa lỗi ngăn chặn việc chỉnh sửa video chéo tenant thông qua giả mạo webhook (HeyGen B2) chưa được deploy lên production do vẫn nằm trong dirty tree (commit `d68b4d96`).

### C. Rủi ro Vận hành và Giám sát:
*   **RPO 24h không đảm bảo:** Cron backup `/api/cron/d1-backup` không được đăng ký tự động trên bất kỳ trình chạy cron ngoài nào. Backup D1 hoàn toàn phụ thuộc vào thao tác chạy thủ công của vận hành viên.
*   **Circular Dependency trong Giám sát:** Chỉ số sức khỏe của agent được ghi trực tiếp vào D1 (`signals_events`, `error_log`) và truy vấn qua `/api/health/agents`. Nếu D1 gặp sự cố hoặc khóa ghi (write lock), hệ thống giám sát cũng sẽ mất hoàn toàn khả năng theo dõi.

---

## 3. Khuyến Nghị Tối Ưu Chiến Lược

Để loại bỏ các điểm nghẽn kỹ thuật và nâng cao độ an toàn cho hệ thống, chúng tôi đề xuất các giải pháp sau:

### 1. Áp Dụng Queue-First Pattern cho n8n Webhook:
*   *Vấn đề:* Hiện tại Next.js gọi trực tiếp webhook n8n một cách đồng bộ. Khi n8n quá tải hoặc downtime, hệ thống sẽ bị nghẽn.
*   *Khuyến nghị:* Viết yêu cầu công việc vào một bảng hàng đợi `job_outbox` trong D1 trước, sau đó dùng một Inngest worker để gửi bất đồng bộ sang n8n với cơ chế hàng đợi tự động retry.

### 2. Loại Bỏ Airtable CMS, Hợp Nhất Dữ Liệu về D1:
*   *Vấn đề:* Airtable giới hạn 5 req/sec gây tắc nghẽn khi quy mô người dùng tăng.
*   *Khuyến nghị:* Di chuyển toàn bộ dữ liệu CMS về D1/R2, n8n sẽ thực hiện đọc/ghi dữ liệu thông qua các Next.js API nội bộ để tránh rate-limit.

### 3. Đảo Ngược Hướng Phụ Thuộc Inngest-to-Billing (Decoupling):
*   *Vấn đề:* Inngest worker gọi trực tiếp các dịch vụ billing tại tầng `land/` vi phạm Mekong 4-Layer.
*   *Khuyến nghị:* Inngest chỉ phát tín hiệu (emit event) `PAYOUT_READY` vào bảng `signals_events` của D1, sau đó một cron chạy ở tầng `land/` sẽ quét bảng này và xử lý thanh toán/hoa hồng.

### 4. Khắc phục TOCTOU bằng Atomic Update:
*   *Vấn đề:* Việc đọc quota rồi mới cập nhật dễ gây ra race condition, khiến tài khoản vượt quá giới hạn.
*   *Khuyến nghị:* Chuyển sang thực hiện đếm quota bằng một câu lệnh SQL duy nhất:
    ```sql
    UPDATE video_usage_monthly SET count = count + 1 WHERE user_id = ? AND count < limit RETURNING count
    ```

### 5. Tối Ưu R2 Storage Lifecycle:
*   *Vấn đề:* Bucket `sophia-videos` không có chính sách tự động xóa, gây phình to dung lượng lưu trữ R2 vô hạn.
*   *Khuyến nghị:* 
    *   Thiết lập quy trình tự động xóa các video cũ hơn 90 ngày (ngoại trừ các tài khoản cấp VIP/ENTERPRISE/MASTER).
    *   Tạo bảng `video_retention_overrides` trong D1 để đánh dấu các video quan trọng cần lưu trữ vĩnh viễn.

---

## 4. Kế Hoạch Thử Nghiệm Xác Thực (Validating Points)

Trước khi chuyển giao toàn bộ, cần xây dựng các kịch bản kiểm thử tự động sau:
1.  **Race Condition Test:** Viết một script chạy đồng thời 50 request kiểm tra quota để kiểm chứng lỗi TOCTOU trên D1.
2.  **Timing Attack Verification:** Thực hiện đo độ trễ phản hồi của webhook khi nhập signature sai độ dài để xác minh mức độ ảnh hưởng của lỗi rò rỉ thời gian.
3.  **HeyGen Webhook Multi-Tenant Test:** Chạy test suite giả lập webhook HeyGen với `org_id` khác nhau để đảm bảo dữ liệu video không bị sửa đổi chéo.

---

## 5. Câu Hỏi Chưa Giải Quyết (Unresolved Questions)

1.  *Mức Độ Giới Hạn Ghi của D1:* SQLite ghi tuần tự. Khi số lượng user đồng thời (Inngest event check-ins) vượt quá 10K/phút, D1 write lock contention sẽ gây trễ bao nhiêu ms và làm thế nào để phân mảnh (shard) hoặc chuyển đổi sang Supabase/PostgreSQL hiệu quả nhất?
2.  *Quản Lý Key Rotation cho BYOK:* Phương án tối ưu để lưu trữ phiên bản key cũ và mới chạy song song khi thực hiện xoay vòng `BYOK_MASTER_KEY` mà không làm gián đoạn API của khách hàng?
3.  *n8n Log Masking:* Làm thế nào để lọc bỏ các khóa API bí mật (BYOK) khỏi logs của n8n khi chúng được truyền động tịnh tiến qua các nodes của workflow?
