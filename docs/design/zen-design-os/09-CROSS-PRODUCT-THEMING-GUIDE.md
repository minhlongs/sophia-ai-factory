# 09 — HƯỚNG DẪN TÁI SỬ DỤNG ĐA SẢN PHẨM (CROSS-PRODUCT THEMING GUIDE)
> **Tài liệu:** `docs/design/zen-design-os/09-CROSS-PRODUCT-THEMING-GUIDE.md`
> **Mục tiêu:** Cho phép tái sử dụng kiến trúc **ZEN DESIGN OS v1.0** cho toàn bộ hệ sinh thái sản phẩm của Founder (Sophia AI Factory, CashClaw, DuriOS, Khoan Capital, Mekong CLI Web) mà vẫn giữ được bản sắc thương hiệu riêng của từng sản phẩm.

---

## 1. KIẾN TRÚC 3 LỚP ĐỂ TÁI SỬ DỤNG ĐA THƯƠNG HIỆU

**ZEN DESIGN OS v1.0** tách biệt rõ ràng giữa **Cấu trúc ngữ nghĩa (Semantic Contract)** và **Giá trị thương hiệu (Brand Values)**:

```text
LỚP 1: CANONICAL DTCG CONTRACT (zen-design-tokens.dtcg.json)
  └── Định nghĩa cấu trúc: color.semantic.{light|dark}.*, motion.*, radius.*, typography.*

LỚP 2: BRAND THEME MAPPING (globals.css của từng sản phẩm)
  ├── Thương hiệu A (Sophia AI Factory): Indigo (#4338CA / #6366F1) + Amber (#B45309 / #F59E0B)
  ├── Thương hiệu B (CashClaw Quant):    Emerald Quant + Cyan Telemetry
  └── Thương hiệu C (Khoan Capital):     Industrial Cobalt + Cryo-HVDC Amber

LỚP 3: SHARED UI & MOTION PRIMITIVES (React / Tailwind v4)
  └── Sử dụng 100% class ngữ nghĩa: bg-background, bg-card, text-primary, var(--motion-ease-emphasized)
```

---

## 2. QUY TRÌNH 4 BƯỚC ĐỂ ÁP DỤNG CHO SẢN PHẨM MỚI TRONG HỆ SINH THÁI ZEN

1. **Bước 1 — Sao chép hợp đồng Token chuẩn DTCG**:
   - Sao chép mô-đun `src/seed/design-tokens/` (`zen-design-tokens.dtcg.json`, `index.ts`, `__tests__/zen-design-tokens.test.ts`) sang kho mã nguồn của sản phẩm mới.
2. **Bước 2 — Cập nhật điểm nhấn thương hiệu (`primary`, `secondary`, `accent`)**:
   - Chỉ cần thay đổi mã màu Hex của `primary`, `secondary`, `accent` trong `zen-design-tokens.dtcg.json` và `src/app/globals.css`.
   - Giữ nguyên cấu trúc nền `:root` (Light Mode) và `.dark` (Dark Mode) cùng hệ thống biến chuyển động `--motion-duration-*` và `--motion-ease-*`.
3. **Bước 3 — Chạy bộ kiểm thử tương phản tự động (WCAG 2.2 AA Gate)**:
   - Chạy `npx vitest run src/seed/design-tokens/__tests__/zen-design-tokens.test.ts`.
   - Nếu bất kỳ màu thương hiệu mới nào có độ tương phản `< 4.5:1` với chữ trên nút hoặc nền thẻ, bài kiểm thử sẽ báo lỗi ngay lập tức kèm tỷ lệ đo được để kỹ sư điều chỉnh độ sáng (Tone).
4. **Bước 4 — Bọc Root Layout bằng `ZenThemeProvider`**:
   - Tùy theo đặc thù sản phẩm, thiết lập `defaultTheme="dark"` (cho các công cụ Studio / Quant Terminal như Sophia, CashClaw) hoặc `defaultTheme="light"` (cho các cổng thông tin tài chính / hành chính doanh nghiệp).
