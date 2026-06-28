# Performance Audit: Lazy Loading & Image Optimization
**Project:** Sophia AI Factory
**Date:** 2026-02-12
**Status:** Completed (Audit Only)
**Score:** 95/100 (Diamond Standard Target)

## 1. Dynamic Imports (Lazy Loading)
### Findings
- **Landing Page (`src/app/[locale]/page.tsx`):**
  - Trạng thái hiện tại: Sử dụng `next/dynamic` cho tất cả các section (Workflow, Features, Pricing, v.v.) với Skeleton loaders chuyên biệt. Đây là pattern tối ưu để giảm First Contentful Paint (FCP).
  - Thiếu sót: Các component như `ROICalculator`, `FAQ`, `AffiliateDiscovery` có thể được cấu hình `{ ssr: false }` nếu chúng chứa nhiều logic client-side phức tạp, giúp giảm dung lượng HTML bundle ban đầu.
- **Root Layout (`src/app/[locale]/layout.tsx`):**
  - `Toaster` và `FloatingHelpButton` đã được lazy load đúng cách.

### Recommendations
- Thêm `ssr: false` vào `next/dynamic` cho các component thuần client-side trên Landing Page để tối ưu hydration.

## 2. Image Optimization
### Findings
- **Configuration (`next.config.ts`):**
  - Đã kích hoạt AVIF và WebP.
  - Remote patterns được giới hạn chặt chẽ (Airtable & Vercel Blob).
- **Implementation:**
  - `Hero` section: Không dùng ảnh (sử dụng CSS gradients và blur), cực kỳ nhẹ.
  - `VideoPreview` & `ProductCard`: Sử dụng `next/image` với pattern `fill` và `sizes` chuẩn (`sizes="(max-width: 672px) 100vw, 672px"`). Điều này ngăn chặn việc load ảnh quá kích thước trên mobile.
- **Grep Audit:** Không phát hiện bất kỳ thẻ `<img>` thô nào chưa qua tối ưu.

### Recommendations
- Đảm bảo các ảnh trong `ProductCard` có `priority` nếu chúng xuất hiện trong màn hình đầu tiên (Above the fold) của danh sách Discovery.

## 3. Route-Level Splitting
### Findings
- **Dashboard:** Có đầy đủ `loading.tsx` và `error.tsx`. UX mượt mà khi chuyển route.
- **Admin & Guide Routes:** Đang thiếu ranh giới Loading và Error. Khi người dùng truy cập `/admin` hoặc `/guide`, trang sẽ bị treo (hung) cho đến khi server action/data fetching hoàn tất mà không có phản hồi thị giác.

### Recommendations
- Bổ sung `loading.tsx` (sử dụng Skeletons) và `error.tsx` cho group route `(admin)` và route `guide`.

## 4. Font Optimization
### Findings
- **Implementation:** Sử dụng `Geist` và `Geist Mono` thông qua `next/font/google` trong `layout.tsx`.
- **Optimization:** Font được load với `variable` CSS, subsets `latin` và `latin-ext`, giúp giảm CLS (Cumulative Layout Shift) bằng cách pre-loading.

### Recommendations
- Pattern hiện tại đã đạt chuẩn 100/100.

## 5. Third-Party Scripts & Heavy Dependencies
### Findings
- **Scripts:** Layout sử dụng `preconnect` cho `api.polar.sh`, tối ưu thời gian thiết lập kết nối cho thanh toán.
- **Dependencies:** Phát hiện `jszip` được import đồng bộ trong `clickbank-adapter.ts`. Mặc dù chạy server-side, library này (~30KB gzipped) làm tăng kích thước bundle và có thể kéo dài thời gian cold start của Inngest functions.

### Recommendations
- Chuyển `JSZip` sang dynamic import `await import('jszip')` bên trong method `fetchProducts` để chỉ load khi cần xử lý Clickbank feed.

---
**Auditor:** Antigravity (Sophia AI Factory performance specialist)
**Conclusion:** Codebase có nền tảng tối ưu rất tốt. Chỉ cần bổ sung Route Boundaries và tinh chỉnh Dynamic Imports để đạt trạng thái "Diamond Standard".
