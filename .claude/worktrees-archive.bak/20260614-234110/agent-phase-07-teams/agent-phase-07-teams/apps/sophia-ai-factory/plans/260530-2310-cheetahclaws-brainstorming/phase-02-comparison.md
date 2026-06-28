# Phase 02: So Sánh Đối Chiếu 5 Chiều

## 📌 Tổng quan
- **Ngày bắt đầu:** 2026-05-30
- **Độ ưu tiên:** Cao
- **Trạng thái:** ✅ Hoàn thành

## 🎯 Ma Trận So Sánh 5 Chiều Kích Cốt Lỗi

| Tiêu chí so sánh | OpenClaw + n8n | CheetahClaws (Độc lập) | Đánh giá & Ảnh hưởng |
| :--- | :--- | :--- | :--- |
| **1. Khả năng mở rộng & Chi phí** | **Edge-native (CF Workers):** Pay-as-you-go, scale vô hạn, chi phí gần như bằng 0. n8n chạy serverless/cloud. | **VPS/Local Server:** Tốn chi phí VM cố định. Cơ chế `auto_fanout` tự động spawn LLM calls làm bùng nổ chi phí token nếu không giới hạn. | **OpenClaw thắng** về chi phí hạ tầng và khả năng chịu tải biên (SaaS scale). |
| **2. Đa Tenant & Bảo mật (Multi-tenancy)** | **Zero-trust:** Bắt buộc `tenantId` ở mọi API, D1 isolation, R2 media separation, strict MCP whitelist. | **Single-tenant:** Flat model, lưu config toàn cục (`config.json`), có thể chạy shell command trực tiếp trên host. | **OpenClaw vượt trội** về tính an toàn và cách ly dữ liệu khách hàng B2B. |
| **3. Độ Tin Cậy & Vận Hành (Ops)** | **Trực quan:** n8n cung cấp bảng điều khiển trực quan, Airtable đóng vai trò CMS & nút duyệt thủ công ("Louis Approved"). | **Dựa trên mã nguồn:** Log thô, CLI-focused, khó khăn cho người dùng không am hiểu kỹ thuật để theo dõi và duyệt bài. | **Bộ đôi cũ thắng** về mặt vận hành thực tế đối với đội ngũ phi kỹ thuật. |
| **4. Dev Experience & Bảo Trì** | **Low-code:** Nhanh chóng thay đổi luồng nhưng Git diff cực kỳ khó đọc (monolithic JSON), dễ gãy do schema drift ở Airtable. | **Code-driven:** Type-safe (Zod/Pydantic), quản lý qua Git PR/branch, viết Unit Test tự động hóa hoàn toàn dễ dàng. | **CheetahClaws thắng** về khả năng quản lý code, bảo trì lâu dài và CI/CD. |
| **5. Trí tuệ Agent & Autonomy** | **Kiểm soát chặt:** Chạy theo vòng lặp có quota giới hạn số lần gọi LLM để tránh runaway loops. | **Auto-fanout:** Tự động phát hiện output lớn, chunk và map-reduce song song (tối đa 6 subagents) để tối ưu context. | **CheetahClaws thắng** về độ thông minh khi xử lý tài liệu/kịch bản cực lớn. |

---

## 🛠️ Đánh Giá Tính Khả Thi Kỹ Thuật

1. **Khả năng thay thế hoàn toàn:** **KHÔNG KHẢ THI** cho phiên bản production phân tán. CheetahClaws không thể chạy trực tiếp trên Cloudflare Workers do giới hạn bộ nhớ (128MB) và không có filesystem cục bộ. Nếu ép buộc chạy, Sophia sẽ mất đi lợi thế Edge-first.
2. **Khả năng lai hóa (Hybrid):** **RẤT KHẢ THI.** Sử dụng OpenClaw + n8n + Airtable làm giao diện và cổng điều phối đa tenant ở Edge, sau đó gọi CheetahClaws chạy trên VPS/Mac Studio riêng để xử lý song song các tác vụ nặng (Sinh kịch bản dài, Render video Remotion bằng GPU).
