# Phase 01: Chuẩn Bị & Cấu Hình Môi Trường

## 📌 Tổng quan
- **Ngày bắt đầu:** 2026-05-30
- **Độ ưu tiên:** Cao
- **Trạng thái:** ✅ Đã hoàn thành

## 🎯 Mục tiêu
1. Đảm bảo cấu hình Playwright đã sẵn sàng cho kiểm thử cục bộ và từ xa.
2. Kiểm tra sự sẵn sàng của thư viện `@axe-core/playwright` cho kiểm thử Accessibility (A11y).
3. Đảm bảo môi trường live `https://sophia.agencyos.network` phản hồi tốt để làm mục tiêu chạy các kịch bản test UX Usability.

## 🛠️ Các bước thực hiện
- [x] Đọc cấu hình `playwright.config.ts` để hiểu các thông số workers và viewport.
- [x] Phân tích fixtures: [a11y-test.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/tests/e2e/_fixtures/a11y-test.ts) và [visual-test.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/tests/e2e/_fixtures/visual-test.ts).
- [x] Chạy thử bộ test responsive cục bộ hoặc trên live.

## 💾 Lưu ý kỹ thuật
- Chạy trên live cần cấu hình `PLAYWRIGHT_TEST_BASE_URL=https://sophia.agencyos.network`.
- Giới hạn workers khi test trên live ở mức 1-2 để tránh spam traffic hoặc bị Cloudflare rate limit.
