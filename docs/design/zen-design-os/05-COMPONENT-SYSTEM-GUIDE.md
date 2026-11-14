# 05 — HƯỚNG DẪN HỆ THỐNG COMPONENT (COMPONENT SYSTEM GUIDE)
> **Tài liệu:** `docs/design/zen-design-os/05-COMPONENT-SYSTEM-GUIDE.md`
> **Phạm vi:** Các component nền tảng (`seed`), nghiệp vụ (`tree`) và khung điều phối (`forest`) trong ZEN DESIGN OS v1.0.

---

## 1. QUẢN LÝ CHẾ ĐỘ SÁNG / TỐI (`ZenThemeProvider` & `ThemeToggle`)

### 1.1. `ZenThemeProvider` (`src/forest/theme/zen-theme-provider.tsx`)
Được tích hợp tại `src/app/layout.tsx`, cung cấp ngữ cảnh theme cho toàn bộ ứng dụng mà không phá vỡ cấu trúc Server Component của Next.js 16:
- **Thuộc tính điều khiển**: `attribute="class"` trên thẻ `<html>`.
- **Chế độ mặc định**: `defaultTheme="dark"` (**Director's Control Deck**) cho người dùng lần đầu truy cập (`localStorage['sophia-zen-theme']` rỗng sẽ giữ `dark`, không tự bị ép theo hệ điều hành).
- **Danh sách chế độ & đồng bộ hệ thống**: `themes={['dark', 'light']}` kết hợp `enableSystem` (`true`) để khi người dùng chủ động chọn **System** trong Settings, giá trị `'system'` được lưu bền vững vào `localStorage['sophia-zen-theme']` và tự động đồng bộ `prefers-color-scheme` xuyên suốt mọi route.
- **Chống chớp giao diện & bảo vệ CSP/Rocket Loader**: `disableTransitionOnChange` (`true`), `scriptProps={{ 'data-cfasync': 'false' }}`, chuyển tiếp `nonce={nonce}` trên `<script>` khởi tạo và `suppressHydrationWarning` trên thẻ `<html>`.

### 1.2. `ThemeToggle` (`src/forest/components/theme-toggle.tsx`)
Nút chuyển đổi nhanh giữa chế độ **Tối (Director's Control Deck)** và **Sáng (Executive Studio Ivory)** nằm ngay trên thanh TopBar của Dashboard (`src/forest/dashboard/dashboard-topbar-actions.tsx`):
- Có đầy đủ thuộc tính tiếp cận: `aria-label`, `aria-pressed`, `title`, và `data-testid="theme-toggle"`.
- Trước khi client mount xong (`mounted === false`), hiển thị khung giữ chỗ có cùng kích thước để tránh dịch chuyển bố cục (`CLS = 0`).

### 1.3. `AppearanceSection` (`src/forest/components/settings/sections/appearance-section.tsx`)
Trang cài đặt giao diện cho phép người dùng chọn giữa **Light**, **Dark** và **System**; cập nhật `settings.theme` trong form đồng thời gọi trực tiếp `setTheme('light' | 'dark' | 'system')` của `ZenThemeProvider` để lưu bền vững vào `sophia-zen-theme` và duy trì lắng nghe `matchMedia` ở tầng gốc ngay cả khi rời trang `/settings`.

---

## 2. CÁC NGUYÊN BẢN CHUYỂN ĐỘNG (`ZEN MOTION PRIMITIVES`)

Tất cả các component chuyển động trong `src/seed/components/ui/` đều đọc trực tiếp biến CSS `--motion-duration-*` và `--motion-ease-emphasized`, khởi tạo trạng thái SSR/hydration đồng nhất để tránh lỗi hydration mismatch trên React 19, đồng thời kết hợp quy tắc CSS `@media (prefers-reduced-motion: reduce)` trên `[data-zen-motion]` / `[data-zen-motion-stagger] > *` trong `src/app/globals.css`:

| Component | Đường dẫn | Cách sử dụng chuẩn | Hành vi khi bật `prefers-reduced-motion` |
|---|---|---|---|
| **`PageTransition`** | `src/seed/components/ui/page-transition.tsx` | Bọc quanh nội dung màn hình hoặc bước chuyển tiếp (`translateY(12px)`, `var(--motion-duration-deliberate, 400ms)`). | Hiển thị ngay từ byte SSR đầu tiên qua CSS `@media` và đặt `transition: none`, `opacity: 1`, `transform: none` ngay khi mount. |
| **`ScrollReveal`** | `src/seed/components/ui/scroll-reveal.tsx` | Bọc quanh các khối nội dung dài; dùng `IntersectionObserver` với `translateY(2rem)` (`translateY(1.5rem)` khi bật `staggerDelay`) và `var(--motion-duration-cinematic, 600ms)`. | Bỏ qua `IntersectionObserver`, hiển thị toàn bộ nội dung ngay từ đầu với `transition: none` (kể cả các phần tử con `staggerDelay`). |
| **`FadeInView`** | `src/seed/components/ui/fade-in-view.tsx` | Tạo hiệu ứng xuất hiện nhẹ theo hướng chọn trước (`distance` mặc định `20px`, `duration` mặc định `400ms`, `delay` truyền qua CSS transition; quy ước ngân sách caller `<= 180ms` cho cụm thẻ KPI theo `ZEN-MOTION-ADOPTION-MATRIX.md`). | Bỏ qua `IntersectionObserver`, đặt `isVisible = true` và `transition: none` tức thì. |

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
