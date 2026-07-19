---
title: "Runtime Performance Audit"
description: "Kiểm tra chỉ số Core Web Vitals (LCP, CLS, INP) và hiệu năng thực tế của Sophia AI Factory."
status: pending
priority: P1
effort: 4h
branch: main
tags: [performance, lighthouse, core-web-vitals]
created: 2026-02-12
---

# Runtime Performance Audit Plan

Kế hoạch kiểm tra chi tiết các chỉ số Core Web Vitals và hiệu năng runtime của ứng dụng Sophia AI Factory nhằm đảm bảo trải nghiệm người dùng mượt mà nhất.

## Các Giai đoạn (Phases)

- [ ] **Phase 1: Đo lường Baseline (Lighthouse & Web Vitals)**
  - Trạng thái: `pending`
  - Mô tả: Thu thập số liệu hiệu năng ban đầu cho các trang chính.
  - File: [phase-01-baseline-measurement.md](./phase-01-baseline-measurement.md)

- [ ] **Phase 2: Phân tích Hiệu năng Tương tác (INP)**
  - Trạng thái: `pending`
  - Mô tả: Kiểm tra độ phản hồi khi người dùng thao tác trên Dashboard.
  - File: [phase-02-interaction-analysis.md](./phase-02-interaction-analysis.md)

- [ ] **Phase 3: Tối ưu hóa Rendering & Assets**
  - Trạng thái: `pending`
  - Mô tả: Kiểm tra và tối ưu hóa việc tải tài nguyên (Images, Dynamic Imports).
  - File: [phase-03-rendering-optimization.md](./phase-03-rendering-optimization.md)

- [ ] **Phase 4: Tổng hợp Báo cáo & Khuyến nghị**
  - Trạng thái: `pending`
  - Mô tả: Viết báo cáo tổng kết và đề xuất giải pháp kỹ thuật.
  - File: [phase-04-final-report.md](./phase-04-final-report.md)

## Dependencies
- Phải hoàn thành Build & Bundle Analysis (Task #1) để hiểu rõ cấu trúc chunk.
- Cần môi trường production hoặc production-like (localhost với build thực tế).

## Key Metrics
- **LCP (Largest Contentful Paint):** < 2.5s
- **CLS (Cumulative Layout Shift):** < 0.1
- **INP (Interaction to Next Paint):** < 200ms
- **TBT (Total Blocking Time):** < 300ms
