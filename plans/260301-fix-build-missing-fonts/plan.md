# Plan: Fix Build — Missing Geist Font Files

**Mission:** `fix_mekong_cli_fix_build_1772364275684`
**Priority:** HIGH
**Date:** 2026-03-01
**Status:** PLAN READY — chờ phê duyệt

---

## Phân Tích Lỗi

### Error Log
```
sophia-proposal:build: Font file not found: Can't resolve './fonts/GeistMonoVF.woff'
sophia-proposal:build: Font file not found: Can't resolve './fonts/GeistVF.woff'
```

### Root Cause
- `app/layout.tsx` (L6-16) dùng `next/font/local` import 2 file `.woff` local
- Thư mục `app/fonts/` tồn tại nhưng **RỖNG** — không có file font nào
- Build Turbopack fail khi resolve `./fonts/GeistVF.woff` và `./fonts/GeistMonoVF.woff`

### Impact
- `sophia-proposal#build` fail → toàn bộ monorepo `npm run build` fail (exit 1)
- 24/42 tasks successful, blocked bởi 1 package này

---

## Giải Pháp: Chuyển sang Google Fonts (KHUYẾN NGHỊ)

**Lý do chọn:** Các app khác trong monorepo (84tea, anima119) đều dùng Google Fonts thành công. Chuẩn hóa pattern.

### Files cần sửa (2 files — dưới giới hạn 5)

| # | File | Thao tác |
|---|------|----------|
| 1 | `apps/sophia-proposal/app/layout.tsx` | Sửa font import: `next/font/local` → `next/font/google` |
| 2 | `apps/sophia-proposal/app/fonts/` | Xóa thư mục rỗng |

### Phase 1: Sửa layout.tsx

**Hiện tại (BROKEN):**
```tsx
import localFont from "next/font/local";

const inter = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-inter",
  weight: "100 900",
});

const spaceGrotesk = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-space",
  weight: "100 900",
});
```

**Sau khi fix:**
```tsx
import { Inter, Space_Grotesk } from "next/font/google";

const inter = Inter({
  subsets: ["latin", "vietnamese"],
  display: "swap",
  variable: "--font-inter",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin", "vietnamese"],
  display: "swap",
  variable: "--font-space",
});
```

**Giữ nguyên:** CSS variable names (`--font-inter`, `--font-space`), className usage, phần còn lại của layout.

### Phase 2: Cleanup

- `rm -rf apps/sophia-proposal/app/fonts/` — xóa thư mục rỗng

---

## Checklist Verification

- [ ] Sửa `layout.tsx`: local → Google Fonts
- [ ] Xóa `app/fonts/` (thư mục rỗng)
- [ ] `cd apps/sophia-proposal && pnpm run build` → exit 0
- [ ] `npm run build` (monorepo root) → sophia-proposal pass
- [ ] CSS variables `--font-inter` và `--font-space` vẫn hoạt động

## Risk Assessment

| Risk | Mức độ | Mitigation |
|------|--------|------------|
| Font rendering khác biệt | THẤP | Inter + Space Grotesk = tương đương Geist về style |
| CSS variable name conflict | KHÔNG | Giữ nguyên tên variable |
| Build time tăng | KHÔNG | Google Fonts tự optimize bởi Next.js |

## Giải Pháp Thay Thế (không khuyến nghị)

**Option B:** Download GeistVF.woff + GeistMonoVF.woff từ Vercel, đặt vào `app/fonts/`. Nhưng không chuẩn hóa với pattern monorepo.

---

*DỪNG TẠI ĐÂY — Chờ phê duyệt trước khi implement.*
