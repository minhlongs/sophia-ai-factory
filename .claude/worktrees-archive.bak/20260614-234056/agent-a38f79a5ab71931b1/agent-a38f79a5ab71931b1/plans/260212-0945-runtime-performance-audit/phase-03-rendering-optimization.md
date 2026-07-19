# Phase 3: Tối ưu hóa Rendering & Assets

**Context Links**
- Parent Plan: [plan.md](./plan.md)
- Build Report: [tester-260212-0821-build-bundle-analysis.md](../reports/tester-260212-0821-build-bundle-analysis.md)

**Overview**
- Date: 2026-02-12
- Priority: P1
- Status: pending
- Review Status: unreviewed

**Key Insights**
- `react-markdown` và `lucide-react` là các thư viện nặng cần được tối ưu.
- Ảnh có thể chưa được tối ưu hóa kích thước đúng cách.

**Requirements**
- Kiểm tra việc sử dụng `next/image` (priority, quality, sizes).
- Xác minh `next/dynamic` hoạt động đúng cho Recharts.

**Architecture**
- Tối ưu hóa tại tầng Component và Configuration.

**Related Code Files**
- `next.config.ts`
- `src/components/ui/`
- `src/app/[locale]/guide/`

**Implementation Steps**
1. Áp dụng `next/dynamic` cho `GuideContentRenderer`.
2. Kiểm tra lại việc import icons từ `lucide-react`.
3. Kiểm tra các thuộc tính `priority` cho ảnh Hero/LCP.

**Todo List**
- [ ] Optimize Icon imports
- [ ] Lazy load Markdown in Guide
- [ ] Review Image optimization

**Success Criteria**
- Giảm kích thước bundle ban đầu của trang Guide.
- LCP giảm ít nhất 10%.

**Risk Assessment**
- Thay đổi cấu trúc component có thể gây lỗi hiển thị nếu không test kỹ.

**Security Considerations**
- N/A

**Next Steps**
- Phase 4: Tổng hợp báo cáo cuối cùng.
