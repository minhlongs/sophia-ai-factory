# Phase 02: Thực Thi Bộ Kiểm Thử & Chụp Ảnh Đối Sánh

## 📌 Tổng quan
- **Ngày bắt đầu:** 2026-05-30
- **Độ ưu tiên:** Cao
- **Trạng thái:** ✅ Đã hoàn thành

## 🎯 Mục tiêu
1. Thực thi các bài test Responsive Layout để phát hiện lỗi tràn màn hình ngang (layout overflow).
2. Thực thi các bài test Accessibility (A11y) sử dụng Axe để phát hiện vi phạm tiêu chuẩn WCAG 2.1 AA.
3. Chạy bài test UX Usability (`ux-usability-260519.spec.ts`) để mô phỏng hành vi của người dùng thật và chụp ảnh giao diện các trang dashboard.
4. Chụp ảnh đối sánh Visual Regression để đảm bảo sự ổn định của UI.

## 🛠️ Kế hoạch thực thi
1. **Chạy test Responsive:** ✅ Đã chạy thành công
   ```bash
   PLAYWRIGHT_TEST_BASE_URL=https://sophia.agencyos.network npx playwright test tests/e2e/responsive-viewports.spec.ts
   ```
2. **Chạy test Usability & lấy screenshots:** ✅ Đã chạy thành công
   ```bash
   PLAYWRIGHT_TEST_BASE_URL=https://sophia.agencyos.network npx playwright test tests/e2e/ux-usability-260519.spec.ts --workers=1
   ```
3. **Chạy test A11y & Visual Regression:** ✅ Đã chạy thành công (đã sửa và cập nhật baseline snapshots)
   ```bash
   PLAYWRIGHT_TEST_BASE_URL=https://sophia.agencyos.network npx playwright test tests/e2e/dashboard-overview.spec.ts tests/e2e/dashboard-settings.spec.ts
   ```

## ⚠️ Rủi ro & Giải pháp
- **Rủi ro:** Cloudflare chặn bot hoặc rate limit do lượng request lớn từ Playwright.
- **Giải pháp:** Chạy tuần tự (`--workers=1`), không mở trình duyệt đầu (headless), và thêm khoảng trễ nếu cần.
