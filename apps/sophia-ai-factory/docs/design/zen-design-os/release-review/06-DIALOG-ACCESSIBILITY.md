# 06 — REAL BROWSER DIALOG ACCESSIBILITY REPORT (G7)
# BÁO CÁO KIỂM CHỨNG KHẢ NĂNG TIẾP CẬN HỘP THOẠI THỰC TRÊN TRÌNH DUYỆT (G7)

- **Playwright Spec:** `apps/sophia-ai-factory/tests/e2e/dialog-a11y/dialog-accessibility.spec.ts`
- **Machine-Readable Evidence:** `apps/sophia-ai-factory/docs/design/zen-design-os/release-review/evidence/dialog-a11y-07-3.json`
- **Visual Captures:** `apps/sophia-ai-factory/docs/design/zen-design-os/release-review/targeted-07.3/t05-*.png`, `t06-*.png`, `t07-*.png`
- **Execution Result:** **20 / 20 Playwright tests PASSED (24 real Chromium dialog openings measured, `0` axe WCAG 2.2 AA violations)**
- **Gate Verdict:** **PASS**

---

## 1. Tóm tắt Tiếng Việt / English Summary

**🇻🇳 Tiếng Việt:**
Trong đợt kiểm tra trước (07.2), việc bẫy tiêu điểm bàn phím (focus trapping) chưa được đo đầy đủ trên các hộp thoại thực đang mở ở các tuyến đường đã đăng nhập và ở khung nhìn siêu hẹp `320px`. Ở cổng G7 của bản 07.3, chúng tôi đã giữ nguyên 100% kiến trúc Radix `@radix-ui/react-dialog` (không thay thế bằng modal tự chế), hoàn thiện kết nối hộp thoại thực vào Dashboard và kiểm thử trực tiếp trên trình duyệt Chromium thực qua **20 bài test / 24 lần mở hộp thoại** trải rộng khắp `320px`, `375px` và `1440px`, cả hai ngôn ngữ Tiếng Việt (`vi`) & Tiếng Anh (`en`), và cả hai chế độ Tối (`dark`) & Sáng (`light`):
1. **Bảng lệnh nhanh `CmdKPalette` ngay trên tuyến sản xuất `/[locale]/dashboard`:** Mở bằng nút `⌘K` trên thanh TopBar (`1440px`) và bằng tổ hợp phím `Meta+K` từ ô tìm kiếm (`320px`). Đã sửa lỗi ARIA `aria-required-children` của `CommandSeparator` và nâng kích thước nút `⌘K` đạt chuẩn WCAG 2.5.8 (`>= 24×24px`).
2. **Ngăn kéo điều hướng di động `DashboardMobileDrawer` trên `/vi/dashboard` (`320px` & `375px`):** Bổ sung bẫy vòng lặp `Tab`/`Shift+Tab`, đóng bằng `Escape`, ẩn nền `aria-hidden="true"` trên `#main-content` + TopBar, khóa cuộn trang và trả lại tiêu điểm chính xác về nút menu hamburger khi đóng.
3. **Hộp thoại xác nhận thao tác nhạy cảm `RotationDialog` (Xoay Khóa Master BYOK) trên `320px`, `375px`, `1440px` (`vi` + `en`, `dark` + `light`):** Kiểm chứng đầy đủ tiêu điểm ban đầu, vòng lặp `Tab`/`Shift+Tab`, phím `Escape`, khôi phục tiêu điểm về đúng nút kích hoạt (`openerRef`), tên/mô tả trình đọc màn hình song ngữ và không tràn ngang (`0px`) ngay cả ở màn hình `320px` nhờ công thức `w-[calc(100vw-2rem)]`.

**🇬🇧 English:**
G7 closed the 07.2 dialog focus-trap measurement gap using real Chromium interactions (never jsdom mocks and without replacing Radix `@radix-ui/react-dialog`). Across **20 Playwright tests and 24 real dialog openings** (`dialog-a11y-07-3.json`), every dialog achieved `initialFocusInsideDialog: true`, `tabContained: true` (12 Tab presses), `shiftTabContained: true` (6 Shift+Tab presses), `escapeClosed: true`, `focusReturnedToTrigger: true`, `backgroundAriaHidden: true`, `dialogFitsViewport: true`, `horizontalOverflowPx: 0` (including at `320px` and `375px`), localized accessible names/descriptions/close labels (`"Đóng"` / `"Close"`), and `axeViolationsCount: 0` under WCAG 2.2 AA.

---

## 2. Bảng tổng hợp 24 phép đo Hộp thoại Thực trên Chromium (`dialog-a11y-07-3.json`)

| Surface / Hộp thoại | Route | Locale | Themes | Viewports Tested | Opened By | Initial Focus Inside | Tab / Shift+Tab Contained | Escape Closes | Focus Restored to Trigger | Background Inert (`aria-hidden`) | `320px`/`375px` Overflow | Axe WCAG 2.2 AA Violations |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **`CmdKPalette`** (`CommandDialog` / Radix) | `/vi/dashboard`, `/en/dashboard` | `vi`, `en` | `dark`, `light` | `1440px`, `320px` (8 runs) | TopBar `⌘K` button & `Meta+K` from search input | `true` (`input[cmdk-input]`) | `true` / `true` | `true` | `true` (`button[dashboard-cmdk-trigger]` & `input[dashboard-search-input]`) | `true` (`pointer-events: none`) | `0 px` | **`0`** |
| **`DashboardMobileDrawer`** (Modal nav drawer) | `/vi/dashboard` | `vi` | `dark`, `light` | `320px`, `375px` (4 runs) | Hamburger `button[mobile-drawer-trigger]` | `true` (Close button `"Đóng menu điều hướng"`) | `true` / `true` | `true` | `true` (`button[mobile-drawer-trigger]`) | `true` (`#main-content` & TopBar `aria-hidden="true"`) | `0 px` | **`0`** |
| **`RotationDialog`** (Sensitive BYOK Master Key Rotation — Radix `Dialog`) | `/vi/zen-a11y-harness`, `/en/zen-a11y-harness` *(mounts production `RotationDialog` component)* | `vi`, `en` | `dark`, `light` | `320px`, `375px`, `1440px` (12 runs) | `"Trigger Key Rotation"` / `"Kích Hoạt Xoay Khóa"` button | `true` (`input#rotation-reason`) | `true` / `true` (4 tab stops) | `true` | `true` (`openerRef` restores exact trigger button) | `true` (`pointer-events: none`) | `0 px` | **`0`** |

> **Ghi chú minh bạch về tuyến Admin BYOK Rotation:** Tuyến `/dashboard/admin/byok-rotation` yêu cầu quyền quản trị cấp nền tảng (`MASTER` / superadmin role gate trong middleware). Thành phần sản xuất `src/app/(app)/dashboard/admin/byok-rotation/components/rotation-dialog.tsx` được gắn nguyên bản không chỉnh sửa giả lập vào trang kiểm thử phát triển `/[locale]/zen-a11y-harness` (trang này tự trả `notFound()` khi `NODE_ENV === 'production'`), cho phép kiểm chứng trực tiếp hành vi Radix `Dialog` thật trên trình duyệt ở mọi kích thước `320px` / `375px` / `1440px`.

---

## 3. Các cải tiến kỹ thuật đã áp dụng trong G7 (Preserving Radix)

1. **`src/seed/components/ui/dialog.tsx`:**
   - Thay `w-full max-w-lg` bằng `w-[calc(100vw-2rem)] max-w-lg max-h-[calc(100vh-2rem)] overflow-y-auto` và `DialogFooter` `gap-2` để hộp thoại luôn chừa lề an toàn `16px` hai bên trên màn hình `320px` mà không chạm mép hay dính nút.
   - Bổ sung nhãn đóng bản địa hóa tự động (`"Đóng"` cho `vi`, `"Close"` cho `en`) qua prop `closeLabel`.
2. **`src/seed/components/ui/command-items.tsx`:**
   - Đặt `aria-hidden="true"` trên vạch kẻ trang trí `CommandSeparator` bên trong `CommandList` (`role="listbox"`) để tuân thủ nghiêm ngặt đặc tả WAI-ARIA 1.2 (`listbox` chỉ sở hữu `group` và `option`).
3. **`src/forest/dashboard/dashboard-mobile-drawer.tsx` & `src/app/[locale]/dashboard/layout.tsx`:**
   - Hoàn thiện bẫy tiêu điểm bàn phím, phím `Escape`, khóa `aria-hidden` phần nền và gắn `CmdKPalette` trực tiếp vào khung Dashboard sản xuất.
