# Phase 2: Interaction Analysis (INP)

**Context Links**
- Parent Plan: [plan.md](./plan.md)

**Overview**
- Date: 2026-02-12
- Priority: P2
- Status: pending
- Review Status: unreviewed

**Key Insights**
- Các trang Dashboard có nhiều Client Component phức tạp.
- Cần kiểm tra xem React 19 Concurrent rendering có giúp ích không.

**Requirements**
- Đo lường INP (Interaction to Next Paint).
- Kiểm tra Long Tasks (>50ms) trong main thread.

**Architecture**
- Sử dụng Performance Tab trong DevTools (thông qua agent-browser).

**Related Code Files**
- `src/components/ui/fade-in-view.tsx`
- Các thành phần navigation.

**Implementation Steps**
1. Mô phỏng thao tác người dùng: click menu, chuyển tab.
2. Ghi lại thời gian phản hồi của UI.
3. Xác định các script gây block main thread.

**Todo List**
- [ ] Measure interaction delay on Sidebar
- [ ] Measure tab switching in Analytics
- [ ] Identify long running JS tasks

**Success Criteria**
- INP < 200ms cho mọi tương tác cơ bản.

**Risk Assessment**
- Khó đo lường chính xác INP chỉ bằng automation agent mà không có user thật.

**Security Considerations**
- N/A

**Next Steps**
- Phase 3: Tối ưu hóa rendering.
