# Phase 1: Baseline Measurement (Lighthouse & Web Vitals)

**Context Links**
- Parent Plan: [plan.md](./plan.md)
- Task #1 Report: [tester-260212-0821-build-bundle-analysis.md](../reports/tester-260212-0821-build-bundle-analysis.md)

**Overview**
- Date: 2026-02-12
- Priority: P1
- Status: pending
- Review Status: unreviewed

**Key Insights**
- Next.js 16 with Turbopack provides fast initial loads, but shared chunks are relatively large (>200KB).
- Recharts is dynamic-imported, which should help with initial LCP.

**Requirements**
- Automated performance audit using Lighthouse or similar tool.
- Capture LCP, CLS, TBT for 3 key routes: Dashboard, Analytics, Guide.
- Desktop and Mobile (simulated) profiles.

**Architecture**
- Tooling: `agent-browser` or `chrome-devtools`.
- Execution: Run in production mode (npm run build && npm start).

**Related Code Files**
- `src/app/[locale]/dashboard/page.tsx`
- `src/app/[locale]/dashboard/analytics/page.tsx`
- `src/app/[locale]/guide/page.tsx`

**Implementation Steps**
1. Khởi động server production trên cổng 3000.
2. Sử dụng `agent-browser` để truy cập các trang và ghi lại chỉ số Web Vitals.
3. Chụp ảnh màn hình các trang để kiểm tra visual layout stability.
4. Lưu kết quả vào báo cáo sơ bộ.

**Todo List**
- [ ] Start production server
- [ ] Audit Dashboard page
- [ ] Audit Analytics page
- [ ] Audit Guide page
- [ ] Record baseline metrics

**Success Criteria**
- Có đầy đủ số liệu LCP, CLS, TBT cho 3 trang mục tiêu.
- Ảnh màn hình xác nhận trạng thái hiển thị.

**Risk Assessment**
- Server localhost có thể nhanh hơn thực tế trên cloud (Vercel).
- Mock mode AI có thể làm giảm thời gian render thực tế.

**Security Considerations**
- Không commit API keys thật nếu có sử dụng trong quá trình test.

**Next Steps**
- Chuyển sang Phase 2 để phân tích độ trễ tương tác (INP).
