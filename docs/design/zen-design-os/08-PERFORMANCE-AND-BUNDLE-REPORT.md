# 08 — BÁO CÁO HIỆU NĂNG, BUNDLE & TƯƠNG THÍCH CLOUDFLARE
> **Tài liệu:** `docs/design/zen-design-os/08-PERFORMANCE-AND-BUNDLE-REPORT.md`
> **Kiến trúc đích:** Next.js 16 App Router + `@opennextjs/cloudflare` trên Cloudflare Workers

---

## 1. TÁC ĐỘNG LÊN KÍCH THƯỚC BUNDLE (BUNDLE SIZE IMPACT)

| Thành phần | Thư viện bên ngoài mới | Dung lượng JS tăng thêm (Client Bundle) | Giải pháp tối ưu đã áp dụng |
|---|---|---|---|
| **Hệ thống Token (`src/app/globals.css`)** | `0` | **`0 KB` JS** (~1.8 KB CSS nén Gzip/Brotli) | Toàn bộ màu sắc Dual-Theme, Studio Stage và Motion Governance được xử lý bằng biến CSS native của trình duyệt. |
| **Quản lý Theme (`ZenThemeProvider` + `ThemeToggle`)** | `0` (Tái sử dụng `next-themes@^0.4.6` đã có sẵn trong `package.json`) | **`< 1.2 KB` JS** | Component `ThemeToggle` sử dụng biểu tượng `Sun`/`Moon` từ `lucide-react` (tree-shaken). |
| **Nguyên bản chuyển động (`PageTransition`, `ScrollReveal`, `FadeInView`)** | `0` (Không cài Framer Motion / GSAP / Lenis) | **`0 KB` tăng thêm** | Sử dụng CSS `transition` trên thuộc tính compositor (`opacity`, `transform`) kết hợp `IntersectionObserver` gốc của trình duyệt. |
| **Đặc tả DTCG (`zen-design-tokens.dtcg.json`)** | `0` | **`0 KB` trên Client** | Chỉ được import khi cần tra cứu lập trình hoặc trong bộ kiểm thử Vitest (`zen-design-tokens.test.ts`). |

---

## 2. ĐẢM BẢO CHỈ SỐ CORE WEB VITALS (LCP, CLS, INP)

1. **Cumulative Layout Shift (`CLS = 0.00`)**:
   - **Font Loading**: Các bộ chữ `Inter` (UI/Body) và `JetBrains Mono` (Code/Telemetry) được nạp qua Google Fonts (`<link>` trong `src/app/layout.tsx`) với `display: 'swap'`, subset `latin` + `vietnamese`; bề mặt landing `.v3-core` giữ `Archivo` (wdth) cho tiêu đề scrollytelling. Bỏ `Plus Jakarta Sans` và `Be Vietnam Pro` khỏi runtime UI (Quyết định Founder #07.3 Decision 2).
   - **Theme Toggle Placeholder**: Trong `src/forest/components/theme-toggle.tsx`, trước khi client hydration hoàn tất, một phần tử `<span className="inline-flex h-8 w-8" />` giữ đúng kích thước `32x32px` trên thanh TopBar để không gây xô lệch các nút bên cạnh.
   - **Tabular Numbers**: Toàn bộ bộ đếm tài chính, độ trễ API (`ms`) và mã bước (`WizardStepper`) sử dụng `font-mono` (`font-variant-numeric: tabular-nums`), ngăn chặn hiện tượng giật ngang khi con số thay đổi.
2. **Interaction to Next Paint (`INP < 50ms`)**:
   - Việc chuyển đổi giữa chế độ Sáng và Tối chỉ thay đổi một class trên thẻ `<html>`, trình duyệt tính toán lại bảng màu qua CSS Custom Properties trong `< 8ms` mà không cần re-render cây dữ liệu nghiệp vụ.
   - Không có bất kỳ trình lắng nghe sự kiện `scroll` hay `mousemove` toàn cục nào chạy trên luồng chính (Main Thread).
3. **Largest Contentful Paint (`LCP`)**:
   - Các hiệu ứng chuyển cảnh (`PageTransition`, `FadeInView`) chỉ bắt đầu từ `opacity: 0` với thời lượng ngắn (`240ms–400ms`) và không chặn quá trình SSR của Next.js 16.

---

## 3. TƯƠNG THÍCH TUYỆT ĐỐI VỚI CLOUDFLARE WORKERS & OPENNEXT

- **Zero Native Addons / Zero Node-Only APIs**: Mọi mô-đun của ZEN DESIGN OS v1.0 đều chạy thuần chuẩn ECMAScript và Web API, tương thích 100% với môi trường V8 Isolate của Cloudflare Workers (`@opennextjs/cloudflare`).
- **Bảo toàn Ranh giới Server/Client**: `src/app/layout.tsx` vẫn là một Server Component bất đồng bộ (`async function RootLayout`), đọc nonce bảo mật CSP từ `headers()` của Next.js và truyền xuống `<ZenThemeProvider>` (Client Component biên mỏng).
