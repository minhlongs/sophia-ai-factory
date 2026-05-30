# Phase 03: Tích Hợp MCP Connector (OpenClaw Integration)

## 📌 Tổng quan
- **Ngày bắt đầu:** 2026-05-30
- **Độ ưu tiên:** Cao
- **Trạng thái:** ⏳ Chưa bắt đầu

## 🎯 Mục tiêu
Liên kết luồng xử lý video (video-gen pipeline) của OpenClaw Edge với cổng kết nối CheetahClaws MCP ở local, thực hiện phân tách nhiệm vụ thực thi (render video thô) và lưu trữ trực tiếp lên R2 của tenant.

## 🛠️ Các Bước Thực Hiện Tiếp Theo
- [ ] Whitelist server `cheetahclaws` trong MCP gateway (Đã hoàn tất cấu trúc tại `mcp-gateway.ts`).
- [ ] Chỉnh sửa logic `executeStep` tại `workflow-stepper` khi chạy qua stage `videoCompose`:
  * Nếu phát hiện cấu hình storage của tenant có bật `useTenantStorage === true`, hệ thống sẽ không gọi MoviePy Fly API nữa.
  * Hệ thống sẽ gọi qua MCP client `cheetahclaws` bằng phương thức `renderVideo` kèm credentials R2 của tenant.
- [ ] Cập nhật UI dashboard để CEO Media có thể xem tài liệu hướng dẫn nhanh (Zero-Config Guide) và dễ dàng điền thông tin R2 bucket.
