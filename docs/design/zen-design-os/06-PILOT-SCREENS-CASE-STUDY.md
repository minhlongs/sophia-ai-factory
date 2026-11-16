# 06 — PHÂN TÍCH CHI TIẾT 3 MÀN HÌNH PILOT (PILOT SCREENS CASE STUDY)
> **Tài liệu:** `docs/design/zen-design-os/06-PILOT-SCREENS-CASE-STUDY.md`
> **Phạm vi:** 3 màn hình Pilot đã được Founder khóa trong Gate 1

---

## 1. PILOT 1: SETUP WIZARD — BYOK ONBOARDING (`/[locale]/setup`)

### 1.1. Tệp nguồn liên quan
- Route Entry: `src/app/[locale]/setup/page.tsx` (canonical; `src/app/[locale]/setup-wizard/page.tsx` và middleware chuyển hướng `307` từ `/[locale]/setup-wizard` về `/[locale]/setup`)
- Orchestrator: `src/tree/components/setup-wizard/steps/index.tsx`
- Stepper: `src/tree/components/setup-wizard/wizard-stepper.tsx`
- BYOK Input & Security Banner: `src/tree/components/setup-wizard/api-key-input.tsx`, `src/tree/components/setup-wizard/byok-doctrine-banner.tsx`

### 1.2. Cải tiến UX & Thị giác trong ZEN DESIGN OS v1.0
- **Thanh tiến trình 6 bước (`WizardStepper`)**:
  - Chuyển đổi từ màu tối cố định sang hệ thống token ngữ nghĩa (`bg-card`, `border-border`, `bg-primary`, `text-primary-foreground`, `ring-primary/20`).
  - Bước đã hoàn thành hiển thị màu xanh lục bảo (`bg-emerald-600 dark:bg-emerald-700`) kèm biểu tượng Checkmark sắc nét; bước hiện tại nổi bật với vòng sáng `ring-4 ring-primary/20` (`dark:bg-primary-600`) và số thứ tự in bằng font `JetBrains Mono`.
  - Hỗ trợ hiển thị rút gọn thông minh trên màn hình di động (`320px–639px`): `Step X of 6: [Tên bước]`.
- **Khung biểu mẫu chính (`SetupWizardPage`)**:
  - Sử dụng nền `bg-background text-foreground` và khung thẻ `bg-card border border-border rounded-2xl shadow-xs`, giúp các CEO làm việc ban ngày ở chế độ Sáng (**Executive Studio Ivory**) đọc rõ từng hướng dẫn lấy API key mà không bị mỏi mắt.

### 1.3. Bảo toàn Luồng Bảo Vệ (Protected Flow Verification)
- Giữ nguyên 100% logic kiểm tra khóa (`verifyKey`), cảnh báo lỗi (`status[k] === 'invalid'`), thu hồi khóa (`handleRevokeProvider`) và cơ chế `FAIL-CLOSED` khi lưu cấu hình.
- Toàn bộ bài kiểm thử đơn vị và tích hợp trong `src/tree/components/setup-wizard/__tests__/` đều vượt qua (`PASS`).

---

## 2. PILOT 2: DASHBOARD COMMAND CENTER (`/[locale]/dashboard`)

### 2.1. Tệp nguồn liên quan
- Route Entry & Layout: `src/app/[locale]/dashboard/layout.tsx`, `src/app/[locale]/dashboard/page.tsx`
- Shell & Navigation: `src/forest/dashboard/dashboard-shell.tsx`, `src/forest/dashboard/dashboard-topbar.tsx`, `src/forest/dashboard/dashboard-topbar-actions.tsx`
- Screen View & Drawer: `src/components/stitch/screens/dashboard/dashboard-page.tsx`, `src/components/stitch/screens/dashboard/dashboard-sources-drawer.tsx`

### 2.2. Cải tiến UX & Thị giác trong ZEN DESIGN OS v1.0
- **Thanh công cụ TopBar (`DashboardTopBarActions`)**:
  - Tích hợp nút chuyển đổi giao diện `<ThemeToggle />` ngay cạnh bộ chuyển đổi ngôn ngữ `VI / EN` và chuông thông báo.
  - Chuẩn hóa toàn bộ nút bấm và huy hiệu hồ sơ người dùng (`userRole`, `userInitials`) sang token ngữ nghĩa (`bg-card`, `border-border`, `text-foreground`, `bg-primary/10`, `text-primary-text`).
- **Ngăn kéo Nguồn dữ liệu (`DashboardSourcesDrawer`)**:
  - Thay thế toàn bộ các mã màu hex cứng (`#090A10`, `#11131F`, `#F8FAFC`) bằng hệ thống token thích ứng (`bg-card`, `bg-muted`, `text-foreground`, `border-border`), giúp ngăn kéo hiển thị đồng bộ ở cả chế độ Sáng và Tối.

---

## 3. PILOT 3: NICHE STUDIO — AI CREATIVE WORKSPACE (`/[locale]/dashboard/niche-studio`)

### 3.1. Tệp nguồn liên quan
- Route Entry: `src/app/[locale]/dashboard/niche-studio/page.tsx`
- Studio Canvas: `src/components/niche-studio/sophia-artifact-canvas.tsx`
- Video Preview Stage: `src/components/video/timeline-browser-preview.tsx`

### 3.2. Cải tiến UX & Thị giác trong ZEN DESIGN OS v1.0
- **Khung vẽ Kịch bản & Phân cảnh (`SophiaArtifactCanvas`)**:
  - Chuyển đổi khung bao ngoài sang `bg-card border-border` kết hợp vùng artboard tối và thanh công cụ kiểm tra `SophiaArtifactCanvasInspector` (`bg-muted/40`), cho phép người dùng đọc kịch bản và bình luận ghim dễ dàng ở cả chế độ Sáng và Tối.
- **Sân khấu Xem trước Video (`TimelineBrowserPreview`)**:
  - Áp dụng kiến trúc **Dedicated Dark Stage**: vùng khung hình video sử dụng `var(--studio-stage-bg)` (`#090A10`) trong khi thẻ bao ngoài và thanh điều khiển bên cạnh thích ứng với `bg-card`, `bg-muted` và `border-border`. Nhờ đó, màu sắc và phụ đề trên video luôn giữ được độ tương phản chuẩn điện ảnh ngay cả khi người dùng bật chế độ Sáng.
