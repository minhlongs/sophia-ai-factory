# Phase 01: Scripts Cài Đặt Cục Bộ

## 📌 Tổng quan
- **Ngày bắt đầu:** 2026-05-30
- **Độ ưu tiên:** Cao
- **Trạng thái:** ✅ Hoàn thành

## 🎯 Mục tiêu
Cung cấp giải pháp setup "tận răng" cho khách hàng (CEO Media) tự cài đặt toàn bộ môi trường và CheetahClaws engine trên máy M1 Max cục bộ chỉ với một dòng lệnh.

## 🛠️ Chi Tiết Triển Khai
- [x] Tạo file script cài đặt tự động [install-m1.sh](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/scripts/install-m1.sh).
- [x] Kiểm tra và tự động cài đặt Node.js, Python3 qua Homebrew nếu thiếu.
- [x] Cài đặt FFmpeg và global `@remotion/cli` phục vụ render video bằng GPU của M1 Max.
- [x] Cấu hình tự động kết nối API Key và lưu file môi trường `.env` tại máy local khách hàng.
- [x] Phân quyền thực thi `chmod +x` cho file installer.
