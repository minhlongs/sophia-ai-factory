# 05 — TYPOGRAPHY & CANONICAL DESIGN TOKEN AUTHORITY (G6)
# NGUỒN CHÂN LÝ KIỂU CHỮ (`INTER` + `JETBRAINS MONO`) & HỢP ĐỒNG TOKEN MATERIAL 3 / DTCG (G6)

- **Authoritative CSS Source:** `apps/sophia-ai-factory/src/app/globals.css`
- **Canonical W3C DTCG 2025.10 Source:** `apps/sophia-ai-factory/src/seed/design-tokens/zen-design-tokens.dtcg.json`
- **Reconciled Documentation Surfaces:**
  - `DESIGN.md`
  - `apps/sophia-ai-factory/.claude/rules/sophia-design-authority.md`
  - `docs/design/zen-design-os/09-CROSS-PRODUCT-THEMING-GUIDE.md`
  - `docs/design-guidelines.md`
  - `apps/sophia-ai-factory/docs/design-guidelines.md`
  - `apps/sophia-ai-factory/docs/design-guidelines-creative-mutator.md`
  - `apps/sophia-ai-factory/design-system/sophia-ai-factory/MASTER.md`
- **Gate Verdict:** **PASS (`0` documentation drift, `0` new hardcoded colors, `CLS = 0` across all Vietnamese & English routes)**

---

## 1. Tóm tắt Tiếng Việt / English Summary

**🇻🇳 Tiếng Việt:**
1. **Kiểu chữ thực thi đã khoá theo Quyết định Founder #07.3:**
   - **Giao diện sản phẩm & tiêu đề (`--font-sans` & `--font-display`):** **`Inter`** (tải từ `next/font/google` với đầy đủ bộ ký tự `subsets: ['latin', 'vietnamese']`, `display: 'swap'`), hiển thị sắc nét toàn bộ dấu thanh kép tiếng Việt (`ắ, ậ, ể, ỗ, ự, đ`).
   - **Thông số kỹ thuật, mã khóa, đơn giá & KPI số liệu (`--font-mono`):** **`JetBrains Mono`** (`subsets: ['latin', 'vietnamese']`, `font-variant-numeric: tabular-nums`).
   - **Phạm vi cô lập `.v3-core`:** `Archivo` chỉ được khai báo biến `--font-archivo` cho các khối `.v3-core` chuyên biệt, không bao giờ ghi đè font sản phẩm chung.
   - **Không cài đặt mới:** Tuyệt đối không đưa `Satoshi`, `Instrument Serif`, `Plus Jakarta Sans` hay `Be Vietnam Pro` vào hệ thống.
2. **Đồng bộ 100% tài liệu với mã nguồn thực thi:** Mọi tài liệu cũ trong repo từng nhắc tới font cũ hoặc mã màu HSL vàng cam cũ cho `--primary` đã được đối chiếu và cập nhật khớp từng giá trị hex với `src/app/globals.css`.
3. **Hợp đồng Token DTCG ↔ CSS ↔ Tailwind v4:** 29 vai trò ngữ nghĩa Material 3 trong `zen-design-tokens.dtcg.json` khớp 1:1 với `:root` (Executive Studio Ivory — Sáng) và `.dark` (Director's Control Deck — Tối), vượt qua bài kiểm tra `npm run check:color-tokens` (`1029` literals so với ngưỡng cơ sở `1080` — giảm được **51 mã màu cứng** trên 15 tệp).

**🇬🇧 English:**
G6 verified actual runtime font loading in Chromium (`document.fonts.status === "loaded"` for `Inter` and `JetBrains Mono` with full `latin` + `vietnamese` glyph coverage and `CLS = 0.0000` across all 6 pilot route/theme probes), registered `--font-display` in Tailwind v4 `@theme inline`, upgraded `.dark` `@media (prefers-contrast: more)` border/input contrast (`#64748B` = `4.15:1`, `#94A3B8` = `7.35:1`), reconciled all 7 design documentation files to `src/app/globals.css`, and reduced hardcoded color literals from `1080` baseline down to `1029` (`npm run check:color-tokens` PASS).

---

## 2. Bảng đối chiếu Kiểu chữ thực tế trên Trình duyệt (`g10-lab-runtime-perf-07-3.json`)

| Token / Role | Font Family | Subsets Loaded (`src/app/layout.tsx`) | Computed Browser Stack | Measured CLS (`vi` Dark & Light) |
|---|---|---|---|---|
| `--font-sans` (Body & UI) | `Inter` | `latin`, `vietnamese` (`display: 'swap'`) | `Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` | `0.0000` |
| `--font-display` (Headings) | `Inter` (`.v3-core` scoped override: `Archivo`) | `latin`, `vietnamese` | Registered in `@theme inline` (`--font-display: var(--font-inter), ...`) | `0.0000` |
| `--font-mono` (Code, Masks, Tabular KPIs) | `JetBrains Mono` | `latin`, `vietnamese` (`display: 'swap'`) | `"JetBrains Mono", ui-monospace, SFMono-Regular, monospace` | `0.0000` |
| Banned / Uninstalled Fonts | `Satoshi`, `Instrument Serif` | Not present anywhere in `package.json`, `layout.tsx`, or `globals.css` | Verified absent (`director-control-deck-design-system.test.ts`) | N/A |

---

## 3. Hợp đồng Token Ngữ nghĩa Sáng / Tối (Dual-Theme Semantic Parity Ledger)

| Semantic Token | `:root` Light (Executive Studio Ivory) | `.dark` Default (Director's Control Deck) | Contrast Verification (WCAG 2.2 AA) |
|---|---|---|---|
| `--surface` / `--background` | `#F8F9FC` | `#090A10` | Base canvas |
| `--on-surface` / `--foreground` | `#0B0F19` (`18.1:1` on `#F8F9FC`) | `#F8FAFC` (`19.3:1` on `#090A10`) | AAA (`>= 18:1`) |
| `--card` / `--surface-container` | `#FFFFFF` | `#11131F` | Elevated card surface |
| `--muted` / `--surface-container-high` | `#F1F5F9` | `#171926` | Neutral chip/container surface |
| `--muted-foreground` / `--on-surface-variant` | `#475569` (`7.1:1` on `#FFFFFF`) | `#94A3B8` (`6.4:1` on `#11131F`) | AA (`>= 4.5:1`) |
| `--primary` (Brand Indigo) | `#4338CA` (`8.6:1` with `#FFFFFF`) | `#6366F1` (paired with `dark:bg-primary-600` `#2E19E6` = `9.4:1` with `#FFFFFF` for filled CTAs) | AA (`>= 4.5:1`) |
| `--primary-text` (Inline Indigo Text/Links) | `#4338CA` (`8.0:1` on `#F8F9FC`) | `#818CF8` (`6.7:1` on `#090A10`, `5.8:1` on `#11131F`) | AA (`>= 4.5:1`) |
| `--secondary` (Expressive Violet) | `#7E22CE` (`6.9:1` with `#FFFFFF`) | `#A855F7` (`dark:bg-secondary-700` for filled buttons) | AA (`>= 4.5:1`) |
| `--accent` (Revenue / Highlight Amber) | `#B45309` (`5.02:1` with `#FFFFFF`) | `#F59E0B` (`10.8:1` with `#090A10`) | AA (`>= 4.5:1`) |
| `prefers-contrast: more` (`--border` / `--input`) | `#475569` (`7.1:1`) / `#334155` (`10.3:1`) | `#64748B` (`4.15:1`) / `#94A3B8` (`7.35:1`) | Exceeds 3:1 non-text UI threshold in both modes |
