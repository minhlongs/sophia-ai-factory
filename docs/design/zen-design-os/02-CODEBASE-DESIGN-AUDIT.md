# 02 — BÁO CÁO KIỂM TOÁN HIỆN TRẠNG THIẾT KẾ (CODEBASE DESIGN AUDIT)
> **Tài liệu:** `docs/design/zen-design-os/02-CODEBASE-DESIGN-AUDIT.md`
> **Phạm vi kiểm toán:** `apps/sophia-ai-factory/src/`
> **Công cụ đo đạc:** `scripts/check-hardcoded-colors.mjs`, `grep`, `vitest`, `tsc`

---

## 1. HIỆN TRẠNG CÔNG NGHỆ FRONTEND (VERIFIED STACK)

Qua kiểm tra trực tiếp `apps/sophia-ai-factory/package.json` và mã nguồn:
- **Framework**: Next.js `16.2.1` (App Router, đường dẫn đa ngôn ngữ `src/app/[locale]/...`).
- **UI Runtime**: React `19.2.4` & React DOM `19.2.4`.
- **Styling**: Tailwind CSS `^4.2.2` (`@tailwindcss/postcss`), cấu hình trực tiếp qua `@import "tailwindcss";` và khối `@theme` trong `src/app/globals.css`.
- **Quản lý Theme**: `next-themes@^0.4.6` đã có trong `package.json`, nhưng trước khi triển khai ZEN DESIGN OS v1.0, thẻ `<html className="dark">` trong `src/app/layout.tsx` bị khóa cứng ở chế độ tối và chưa được bọc bởi Theme Provider ở cấp độ Root Layout.
- **Thư viện Component**: Các primitive của `@radix-ui/*` kết hợp với hệ thống component tại `src/seed/components/ui/`, `src/components/stitch/ui/`, `src/tree/components/` và `src/forest/dashboard/`.
- **Biểu tượng & Biểu đồ**: `lucide-react@^1.16.0`, `recharts@^3.8.0`.
- **Đa ngôn ngữ (i18n)**: `next-intl@^4.9.0` với 2 tệp từ điển `messages/vi.json` và `messages/en.json`.

---

## 2. KIỂM KÊ 12 HẠNG MỤC THIẾT KẾ TRƯỚC VÀ SAU KHI NÂNG CẤP

| # | Hạng mục kiểm kê | Hiện trạng trước ZEN DESIGN OS v1.0 | Kết quả sau khi chuẩn hóa ZEN DESIGN OS v1.0 |
|---|---|---|---|
| **1** | **Global Design Tokens & CSS Variables** | `src/app/globals.css` chỉ khai báo màu trong khối `.dark`; khối `:root` chỉ chứa `--radius` khiến chế độ Light Mode không có bảng màu hoạt động. | Khôi phục đầy đủ bảng màu **Executive Studio Ivory** trong `:root` và giữ nguyên **Director's Control Deck** trong `.dark`; đồng thời xuất bản nguồn chân lý chuẩn DTCG tại `src/seed/design-tokens/zen-design-tokens.dtcg.json`. |
| **2** | **Xử lý Dark / Light Mode** | `src/app/layout.tsx` gán cứng `className="dark"`; `AppearanceSection` trong trang Settings chỉ lưu state nội bộ mà không đổi theme thực tế của ứng dụng. | Tạo `ZenThemeProvider` (`src/forest/theme/zen-theme-provider.tsx`) bọc quanh Root Layout với `defaultTheme="dark"`, tích hợp `<ThemeToggle />` trên thanh TopBar của Dashboard và kết nối `AppearanceSection` với `useTheme()`. |
| **3** | **Typography Families & Scales** | Đã nạp `Plus Jakarta Sans`, `Be Vietnam Pro`, `Inter` và `JetBrains Mono` trong `src/app/layout.tsx` và `src/app/globals.css`. | Chuẩn hóa theo **Quyết định Founder (SUPREME COMMAND #07.3, Decision 2)**: UI & Body = `Inter`, Code/Telemetry = `JetBrains Mono` — cả hai với subset `latin` + `vietnamese` để hiển thị dấu Tiếng Việt hoàn hảo; bỏ `Plus Jakarta Sans` và `Be Vietnam Pro` khỏi UI. Bề mặt landing `.v3-core` giữ `Archivo` (wdth) chỉ cho tiêu đề scrollytelling. Không sử dụng `Satoshi` hay `Instrument Serif`. |
| **4** | **Mã màu cứng (Hardcoded Colors Ratchet)** | Lệnh `npm run check:color-tokens` báo lỗi **FAIL** với **`1097`** mã màu cứng (vượt ngưỡng baseline `1080` tới 17 vị trí tại `sophia-artifact-canvas.tsx`, `dashboard-sources-drawer.tsx`, `timeline-browser-preview.tsx`). | Thay thế toàn bộ các vị trí vi phạm cộng thêm các mã màu cứng trong `appearance-section.tsx`, `dashboard-topbar-actions.tsx`, `dashboard-shell.tsx`, `wizard-stepper.tsx`, `setup-wizard/steps/index.tsx` bằng token ngữ nghĩa — đưa chỉ số xuống **`1045`** (**PASS**, thấp hơn ngưỡng `1080`). |
| **5** | **Quy ước Bo góc (Border Radius) & Khoảng cách** | Sử dụng `--radius: 0.75rem` (`12px`) trong `:root` và dẫn xuất `--radius-sm` (`8px`), `--radius-md` (`10px`), `--radius-lg` (`12px`) trong `@theme inline`. | Bảo toàn nguyên vẹn thang đo `--radius` (`12px`) cùng các biến dẫn xuất `@theme inline` trong `src/app/globals.css`. |
| **6** | **Hệ thống Component & Tiện ích Glassmorphism** | Các lớp `.glass-panel`, `.glass-card`, `.glass-card-obsidian`, `.studio-glass`, `.divider-industrial` trong `globals.css` dùng màu nền tối cố định (`rgba(17, 19, 31, ...)`), gây loang màu đen khi chuyển sang chế độ Sáng. | Tách thành quy tắc thích ứng theo chế độ: `:root` dùng nền kính trắng tinh tế (`rgba(255, 255, 255, 0.85)` + viền `rgba(15, 23, 42, 0.08)`), trong khi `.dark` giữ nguyên hiệu ứng kính Obsidian. |
| **7** | **Khung điều hướng (Navigation Shells) & Responsive** | `DashboardShell` (`src/forest/dashboard/dashboard-shell.tsx`) và `DashboardTopBar` (`src/forest/dashboard/dashboard-topbar.tsx`) dùng màu nền tối cứng `bg-[#090A10]` và chưa có công cụ đổi Theme nhanh. | Chuyển sang token ngữ nghĩa thuần `bg-background text-foreground` (không còn mã màu cứng), bổ sung `<ThemeToggle />` ngay trên thanh công cụ TopBar cạnh nút đổi ngôn ngữ `VI/EN`. |
| **8** | **Trạng thái Loading, Empty, Error, Success & Approval** | Sử dụng màu Emerald (`#10B981`), Amber (`#F59E0B`), Rose (`#F43F5E`) nhưng ở chế độ nền sáng độ tương phản chữ của các mã màu này chưa đạt chuẩn WCAG AA (`< 4.5:1`). | Trong `:root` (Light Mode), cung cấp các biến ngữ nghĩa có độ tương phản cao: `--success: #047857` (`5.19:1`), `--accent: #B45309` (`4.79:1`), `--destructive: #BE123C` (`5.85:1`). |
| **9** | **Hạ tầng Khả năng tiếp cận (Accessibility)** | Đã có `skip-to-content`, `:focus-visible` và `@media (prefers-reduced-motion: reduce)` cơ bản trong `globals.css`, nhưng các component `PageTransition`, `ScrollReveal`, `FadeInView` chưa kiểm tra `prefers-reduced-motion` trong JS. | Bổ sung kiểm tra `prefers-reduced-motion` trực tiếp trong `PageTransition`, `ScrollReveal`, `FadeInView` và thêm khối `@media (prefers-contrast: more)` trong `globals.css`. |
| **10** | **Phụ thuộc thiết kế (Design Dependencies)** | Sử dụng `lucide-react`, `clsx`, `tailwind-merge`, `class-variance-authority`, `next-themes`. | Giữ nguyên 100% danh sách dependency hiện hữu — không cài đặt thêm bất kỳ gói npm bên ngoài nào. |
| **11** | **Quản trị chuyển động (Motion Governance)** | Thời lượng chuyển động (`duration-200`, `duration-300`, `duration-500`) bị viết rải rác trong từng component. | Chuẩn hóa thành hệ thống biến `--motion-duration-*` (`80ms` đến `600ms`) và `--motion-ease-*` trong `src/app/globals.css`. |
| **12** | **Các màn hình nhạy cảm với thay đổi thị giác** | Khung xem trước video (`TimelineBrowserPreview`) và khung vẽ kịch bản (`SophiaArtifactCanvas`) cần nền tối để đánh giá màu sắc video chính xác. | Khai báo bộ token bất biến `--studio-stage-bg: #090A10`, `--studio-stage-panel: #11131F`, `--studio-stage-fg: #F8FAFC` để giữ nguyên sân khấu tối cho khung video ngay cả khi toàn trang ở chế độ Sáng. |
