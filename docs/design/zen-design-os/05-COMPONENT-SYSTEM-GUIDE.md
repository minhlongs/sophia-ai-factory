# 05 — HƯỚNG DẪN HỆ THỐNG COMPONENT (COMPONENT SYSTEM GUIDE)
> **Tài liệu:** `docs/design/zen-design-os/05-COMPONENT-SYSTEM-GUIDE.md`
> **Phạm vi:** Các component nền tảng (`seed`), nghiệp vụ (`tree`) và khung điều phối (`forest`) trong ZEN DESIGN OS v1.0.

---

## 1. QUẢN LÝ CHẾ ĐỘ SÁNG / TỐI (`ZenThemeProvider` & `ThemeToggle`)

### 1.1. `ZenThemeProvider` (`src/forest/theme/zen-theme-provider.tsx`)
Được tích hợp tại `src/app/layout.tsx`, cung cấp ngữ cảnh theme cho toàn bộ ứng dụng mà không phá vỡ cấu trúc Server Component của Next.js 16:
- **Thuộc tính điều khiển**: `attribute="class"` trên thẻ `<html>`.
- **Chế độ mặc định**: `defaultTheme="dark"` (**Director's Control Deck**).
- **Danh sách chế độ hợp lệ**: `themes={['dark', 'light']}`.
- **Chống chớp giao diện**: `disableTransitionOnChange={false}` kết hợp với `suppressHydrationWarning` trên `<html>` và `<body>`.

### 1.2. `ThemeToggle` (`src/forest/components/theme-toggle.tsx`)
Nút chuyển đổi nhanh giữa chế độ **Tối (Director's Control Deck)** và **Sáng (Executive Studio Ivory)** nằm ngay trên thanh TopBar của Dashboard (`src/forest/dashboard/dashboard-topbar-actions.tsx`):
- Có đầy đủ thuộc tính tiếp cận: `aria-label`, `aria-pressed`, `title`, và `data-testid="theme-toggle"`.
- Trước khi client mount xong (`mounted === false`), hiển thị khung giữ chỗ có cùng kích thước để tránh dịch chuyển bố cục (`CLS = 0`).

### 1.3. `AppearanceSection` (`src/forest/components/settings/sections/appearance-section.tsx`)
Trang cài đặt giao diện cho phép người dùng chọn giữa **Light**, **Dark** và **System**; gọi trực tiếp `setTheme()` từ `next-themes` và đồng bộ trạng thái hiển thị theo thời gian thực.

---

## 2. CÁC NGUYÊN BẢN CHUYỂN ĐỘNG (`ZEN MOTION PRIMITIVES`)

Tất cả các component chuyển động trong `src/seed/components/ui/` đã được nâng cấp để đọc trực tiếp biến CSS `--motion-duration-*` và `--motion-ease-emphasized`, đồng thời tự động tắt hiệu ứng khi hệ điều hành bật `prefers-reduced-motion: reduce`:

| Component | Đường dẫn | Cách sử dụng chuẩn | Hành vi khi bật `prefers-reduced-motion` |
|---|---|---|---|
| **`PageTransition`** | `src/seed/components/ui/page-transition.tsx` | Bọc quanh nội dung màn hình hoặc bước chuyển tiếp để tạo hiệu ứng xuất hiện mượt mà (`var(--motion-duration-deliberate, 400ms)`). | Hiển thị tức thì (`opacity: 1`, không dùng `translateY`). |
| **`ScrollReveal`** | `src/seed/components/ui/scroll-reveal.tsx` | Bọc quanh các khối nội dung trên trang giới thiệu/báo cáo dài; sử dụng `IntersectionObserver` với độ dịch chuyển giới hạn `16px`. | Bỏ qua `IntersectionObserver`, hiển thị toàn bộ nội dung ngay từ đầu. |
| **`FadeInView`** | `src/seed/components/ui/fade-in-view.tsx` | Tạo nhịp điệu xuất hiện tuần tự cho cụm 3–4 thẻ KPI đầu trang với `delay` tự động giới hạn tối đa `180ms`. | Bỏ qua `setTimeout` và hiển thị tức thì. |

---

## 3. QUY TẮC VIẾT LỚP CSS (STYLING RULES CHO DEVELOPER)

1. **Ưu tiên tuyệt đối Token ngữ nghĩa (Semantic Classes)**:
   - Dùng `bg-background`, `text-foreground`, `bg-card`, `text-card-foreground`, `border-border`, `text-muted-foreground`, `bg-primary`, `text-primary-foreground` thay vì gán mã màu hex trực tiếp (`bg-[#...]`).
2. **Khi nào dùng biến `--studio-stage-*`?**:
   - Chỉ sử dụng `bg-[var(--studio-stage-bg)]` cho các vùng khung hình phát video, khung vẽ kịch bản điện ảnh hoặc trình xem trước timeline cần giữ nền tối cố định ở cả hai chế độ Sáng/Tối.
3. **Sử dụng lớp kính thích ứng (`Adaptive Glass Utilities`)**:
   - Các lớp `.glass-panel`, `.glass-card`, `.glass-card-obsidian`, `.studio-glass` trong `src/app/globals.css` đã tự động thích ứng giữa nền kính trắng ngà ở chế độ Sáng và nền kính Obsidian ở chế độ Tối.
4. **Kiểm tra trước khi Commit**:
   - Luôn chạy `npm run check:color-tokens` để đảm bảo số lượng mã màu cứng không vượt quá ngưỡng cho phép (`<= 1080`).
