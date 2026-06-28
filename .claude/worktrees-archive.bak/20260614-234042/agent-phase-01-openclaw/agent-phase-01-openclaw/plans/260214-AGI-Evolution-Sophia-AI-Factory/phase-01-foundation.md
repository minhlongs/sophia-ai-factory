# Giai đoạn 1: Nền tảng (Foundation)

**Mục tiêu:** Thiết lập các cấu trúc dữ liệu cốt lõi và cơ sở dữ liệu để hỗ trợ hệ thống Hybrid AGI.

## 1. Yêu cầu

- **Database:**
  - Bảng `agi_memory`: Lưu trữ ngữ nghĩa (Semantic Storage) với vector embeddings.
  - Bảng `agi_events`: Lưu trữ telemetry và sự kiện của hệ thống AGI.
  - Bảng `agi_agents`: Quản lý trạng thái và cấu hình của các agents (Script, Voice, Visual).
- **Codebase (TypeScript):**
  - Định nghĩa `AgiEvent` type.
  - Định nghĩa `AgiMemory` interface.
  - Định nghĩa `AgentProfile` và `AgentState` types.

## 2. Kế hoạch thực hiện

1.  **Cập nhật Schema Database:**
    -   File mục tiêu: `apps/sophia-ai-factory/docs/database-schema.sql` (hoặc tạo mới nếu chưa có).
    -   Thêm extension `vector`.
    -   Tạo bảng `agi_memory`, `agi_events`, `agi_agents` với RLS policies.

2.  **Định nghĩa Core Types:**
    -   File mục tiêu: `apps/sophia-ai-factory/src/lib/agi/types.ts`.
    -   Định nghĩa các interfaces cho Meta-Agent và Tactical Teams.

3.  **Cập nhật Roadmap:**
    -   File mục tiêu: `apps/sophia-ai-factory/docs/project-roadmap.md`.
    -   Đánh dấu Phase 1 đang thực hiện.

## 3. Danh sách file cần sửa (Max 5)

1.  `apps/sophia-ai-factory/src/lib/agi/types.ts` (New)
2.  `apps/sophia-ai-factory/docs/database-schema.sql` (Update/New)
3.  `apps/sophia-ai-factory/docs/project-roadmap.md` (Update)
4.  `apps/sophia-ai-factory/src/lib/agi/core.ts` (New - helper functions nếu cần)

## 4. Kiểm thử
- Verify schema SQL chạy thành công (mô phỏng).
- Verify TypeScript types compile không lỗi.
