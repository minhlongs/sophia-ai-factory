# BÁO CÁO KIỂM TRA HIỆU NĂNG: Phân Tích Build & Bundle
**Ngày:** 2026-02-12
**Dự án:** Sophia AI Factory

---

## 1. Chỉ Số Build (Build Metrics)

- **Thời gian Build:** 8.2 giây (Turbopack)
- **Trạng thái:** ✅ Thành công
- **Môi trường:** Next.js 16.1.6, React 19, Turbopack
- **Ghi chú:** Đã fix lỗi TypeScript trong `src/components/ui/fade-in-view.tsx` để unblock quá trình build.

---

## 2. Phân Tích Kích Thước Route (Route Size Analysis)

Dựa trên kết quả build của Turbopack, các route chính được liệt kê dưới đây:

| Route | Loại | Kích thước (Manifest/Code) | Trạng thái |
|-------|------|---------------------------|------------|
| `/[locale]/dashboard/campaigns` | Dynamic (ƒ) | ~40KB | ✅ OK |
| `/[locale]/dashboard/analytics` | Dynamic (ƒ) | ~36KB | ✅ OK (Lazy load Recharts) |
| `/[locale]/dashboard` | Dynamic (ƒ) | ~36KB | ✅ OK |
| `/[locale]/affiliate-discovery` | Dynamic (ƒ) | ~28KB | ✅ OK |
| `/[locale]/guide` | Dynamic (ƒ) | ~28KB | ✅ OK |

**Ghi chú:** Các route đều nằm dưới ngưỡng 100KB cho phần code riêng lẻ của route. Tuy nhiên, cần lưu ý tổng kích thước khi tải trang do các shared chunks.

---

## 3. Top 5 JS Chunks Lớn Nhất (Largest Chunks)

Dưới đây là các tệp JavaScript lớn nhất trong thư mục `.next/static/chunks/`:

1. **a867763516bad40e.js** - **356KB** (Vendor/Framework core)
2. **eb8b87b348967caf.js** - **268KB** (Shared UI/Icons)
3. **9bbae971a85c340e.js** - **220KB** (Root Main File)
4. **a8c6e5b324e59153.js** - **180KB** (Common Components)
5. **a6dad97d9634a72d.js** - **112KB** (Polyfills/Core)

---

## 4. Phân Tích Thư Viện Phụ Thuộc (Dependency Analysis)

Các thư viện có khả năng gây nặng bundle đã được xác định:

- **lucide-react:** Sử dụng tại hơn 75 tệp tin. Cần đảm bảo tree-shaking hoạt động tốt.
- **recharts:** ~150-200KB. Hiện đã được tối ưu bằng `next/dynamic` trong trang Analytics.
- **react-markdown:** Sử dụng trong `guide-content-renderer.tsx`. Có thể cân nhắc lazy load nếu trang Guide không phải là landing page chính.
- **jszip:** Sử dụng trong `clickbank-adapter.ts`. Đây là thư viện nặng, may mắn là nó nằm ở server-side hoặc route cụ thể.

---

## 5. Khuyến Nghị Tối Ưu (Recommendations)

1. **Tối ưu hóa Icons:** Kiểm tra lại cách import `lucide-react`. Tránh import toàn bộ thư viện. Sử dụng các component icon cụ thể để đảm bảo tree-shaking tối ưu nhất.
2. **Lazy Load React-Markdown:** Trang `/guide` sử dụng `react-markdown` để render nội dung lớn. Nên sử dụng `next/dynamic` cho `GuideContentRenderer` để giảm bundle size ban đầu của các trang khác nếu có chung layout.
3. **Kiểm soát Shared Chunks:** Các chunk từ 180KB - 268KB cho thấy có nhiều code dùng chung đang được gom lại. Cần xem xét tách nhỏ các component UI lớn hoặc các utility functions ít dùng.
4. **Duy trì Turbopack:** Thời gian build 8.2s là rất ấn tượng. Tiếp tục sử dụng Turbopack để duy trì momentum phát triển.
5. **Giám sát Peer Dependencies:** Một số thư viện như `airtable`, `bottleneck`, `telegraf` nên được giới hạn ở server-side (Server Components hoặc API Routes) để tránh rò rỉ vào client bundle.

---

## 6. Câu Hỏi Chưa Giải Quyết (Unresolved Questions)
- Có cần thiết phải hỗ trợ các trình duyệt cũ không? (Ảnh hưởng đến kích thước Polyfill 112KB).
- Tần suất sử dụng trang Analytics là bao nhiêu? (Để quyết định có nên tách nhỏ thêm Recharts không).
