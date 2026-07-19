# Phase 1: Core Flow & Auth Tests

- **Date:** 2026-05-30
- **Priority:** High
- **Status:** Pending

## Overview
Phase này tập trung kiểm thử các luồng cơ bản không phụ thuộc vào các tính năng nâng cao (như thanh toán, video). Nó kiểm tra xem luồng đăng nhập/đăng ký có hoạt động tốt không, các trang tĩnh và tài liệu hướng dẫn có hiển thị đúng cấu trúc không.

## Files to Run
1. `tests/e2e/auth-flow.spec.ts`
2. `tests/e2e/dashboard.spec.ts`
3. `tests/e2e/responsive-viewports.spec.ts`
4. `tests/e2e/smoke.spec.ts`
5. `tests/e2e/guide-pages.spec.ts`
6. `tests/e2e/dashboard-overview.spec.ts`
7. `tests/e2e/dashboard-settings.spec.ts`
8. `tests/e2e/dashboard-api-keys.spec.ts`

## Execution Command
```bash
PORT=3001 PLAYWRIGHT_TEST_BASE_URL=http://localhost:3001 npx playwright test tests/e2e/auth-flow.spec.ts tests/e2e/dashboard.spec.ts tests/e2e/responsive-viewports.spec.ts tests/e2e/smoke.spec.ts tests/e2e/guide-pages.spec.ts tests/e2e/dashboard-overview.spec.ts tests/e2e/dashboard-settings.spec.ts tests/e2e/dashboard-api-keys.spec.ts
```

## Success Criteria
- Tất cả các test cases trong 8 file spec trên phải PASS 100%.
- Không xảy ra lỗi 404 hoặc lỗi kết nối.
