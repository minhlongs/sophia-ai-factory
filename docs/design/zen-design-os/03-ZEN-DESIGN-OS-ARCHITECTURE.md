# 03 — KIẾN TRÚC HỆ ĐIỀU HÀNH THIẾT KẾ (ZEN DESIGN OS v1.0 ARCHITECTURE)
> **Tài liệu:** `docs/design/zen-design-os/03-ZEN-DESIGN-OS-ARCHITECTURE.md`
> **Kiến trúc tuân thủ:** Sophia 4-Layer Clean Architecture (`seed → tree → forest → land`)

---

## 1. TRIẾT LÝ THIẾT KẾ CỐT LÕI (PRODUCT DESIGN PHILOSOPHY)

**ZEN DESIGN OS v1.0** được định hình bởi 6 trụ cột:
1. **PREMIUM (Cao cấp)**: Bề mặt phân lớp rõ ràng, chữ viết sắc nét (`Inter` + `JetBrains Mono`), không dùng các mảng màu lòe loẹt hoặc hiệu ứng rẻ tiền.
2. **QUIET (Tĩnh tại)**: Ưu tiên sự rõ ràng của thông tin vận hành; chuyển động chỉ xuất hiện khi có sự thay đổi trạng thái thực sự.
3. **EXPRESSIVE (Biểu cảm có kiểm soát)**: Áp dụng đường cong gia tốc chuẩn Material 3 Expressive (`cubic-bezier(0.16, 1, 0.3, 1)`) và hệ thống tín hiệu thị giác đặc trưng của đạo diễn (`.radar`, `.film-strip`, `.camera-rec`).
4. **AI-NATIVE (Bản địa AI)**: Hiển thị trạng thái cộng tác liên tục của đội ngũ AI Agent thông qua thanh HUD gọn gàng, thẻ xác minh độ trễ API (`ms`) và khung vẽ kịch bản trực quan.
5. **HIGH-TRUST (Độ tin cậy cao)**: Hỗ trợ chế độ Sáng **Executive Studio Ivory** với độ tương phản chữ `18.19:1` cho các tác vụ tài chính, cấu hình khóa bảo mật `AES-256-GCM` và kiểm duyệt nội dung.
6. **ACCESSIBLE (Tiếp cận toàn diện)**: Đạt chuẩn WCAG 2.2 AA về độ tương phản, điều hướng bàn phím, nhãn ARIA và tôn trọng chế độ giảm chuyển động (`prefers-reduced-motion`).

---

## 2. SƠ ĐỒ PHÂN TẦNG KIẾN TRÚC (4-LAYER CLEAN ARCHITECTURE MAPPING)

Toàn bộ các thành phần của **ZEN DESIGN OS v1.0** tuân thủ nghiêm ngặt quy tắc phụ thuộc một chiều `seed → tree → forest → land` của Sophia AI Factory:

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ TẦNG APP / ROUTES (src/app/[locale]/* & src/components/*)                  │
│ - src/app/layout.tsx (Root Layout bọc ZenThemeProvider)                    │
│ - src/app/globals.css (Nguồn chân lý CSS Runtime: :root & .dark)           │
│ - Pilot 1: /[locale]/setup (canonical; /[locale]/setup-wizard 307 → setup) │
│ - Pilot 2: /[locale]/dashboard                                             │
│ - Pilot 3: /[locale]/dashboard/niche-studio                                │
│ - Settings: src/components/settings/settings-appearance-theme.tsx          │
└───────────────────────────────┬────────────────────────────────────────────┘
                                │ imports
                                ▼
┌────────────────────────────────────────────────────────────────────────────┐
│ TẦNG FOREST (src/forest/* — Hạ tầng điều phối & Khung giao diện)           │
│ - src/forest/theme/zen-theme-provider.tsx (Quản lý trạng thái Dark/Light)  │
│ - src/forest/components/theme-toggle.tsx (Nút chuyển đổi Theme Accessible) │
│ - src/forest/dashboard/dashboard-shell.tsx (Khung bố cục Dashboard)        │
│ - src/forest/dashboard/dashboard-topbar-actions.tsx (Thanh công cụ TopBar) │
│ - src/forest/components/settings/sections/appearance-section.tsx           │
└───────────────────────────────┬────────────────────────────────────────────┘
                                │ imports
                                ▼
┌────────────────────────────────────────────────────────────────────────────┐
│ TẦNG TREE (src/tree/* — Thành phần nghiệp vụ tái sử dụng)                  │
│ - src/tree/components/setup-wizard/wizard-stepper.tsx                      │
│ - src/tree/components/setup-wizard/steps/index.tsx                         │
│ - src/tree/components/setup-wizard/api-key-input.tsx                       │
│ - src/tree/components/setup-wizard/byok-doctrine-banner.tsx                │
└───────────────────────────────┬────────────────────────────────────────────┘
                                │ imports
                                ▼
┌────────────────────────────────────────────────────────────────────────────┐
│ TẦNG SEED (src/seed/* — Nguyên bản nền tảng, không phụ thuộc tầng trên)    │
│ - src/seed/design-tokens/zen-design-tokens.dtcg.json (Chuẩn DTCG 2025.10)  │
│ - src/seed/design-tokens/index.ts (Typed Token Accessor & WCAG Verifier)   │
│ - src/seed/components/ui/page-transition.tsx (Zen Motion PageTransition)   │
│ - src/seed/components/ui/scroll-reveal.tsx (Zen Motion ScrollReveal)       │
│ - src/seed/components/ui/fade-in-view.tsx (Zen Motion FadeInView)          │
│ - src/seed/components/ui/animated-counter-with-framer-motion.tsx (Counter) │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. KIẾN TRÚC PROGRESSIVE DUAL-THEME & DEDICATED DARK STAGE

1. **Mặc định an toàn (`defaultTheme="dark"`)**:
   - Khi người dùng truy cập lần đầu tiên, `ZenThemeProvider` giữ nguyên giao diện **Director's Control Deck (`#090A10`)** để đảm bảo 100% tính liên tục của thương hiệu Sophia và không gây chớp sáng (FOUC).
2. **Chuyển đổi tức thì sang Chế độ Sáng (`Executive Studio Ivory`)**:
   - Khi CEO nhấn nút `<ThemeToggle />` trên thanh TopBar hoặc chọn thẻ **Light** trong trang Cài đặt (`SettingsAppearanceThemeSection` tại `/[locale]/dashboard/settings` hoặc `AppearanceSection`), `next-themes` cập nhật thuộc tính class trên thẻ `<html>`, kích hoạt ngay lập tức bộ biến `:root` (`--background: #F8F9FC`, `--card: #FFFFFF`, `--primary: #4338CA`) mà không cần tải lại trang.
3. **Sân khấu tối chuyên dụng cho Video (`Dedicated Dark Stage`)**:
   - Các thành phần dựng phim và xem trước video (`TimelineBrowserPreview`, vùng canvas video trong `SophiaArtifactCanvas`) sử dụng biến `--studio-stage-bg: #090A10` để khung hình video luôn có độ tương phản chuẩn điện ảnh bất kể giao diện xung quanh đang ở chế độ Sáng hay Tối.
