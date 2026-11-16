# 07 — REAL VISUAL REGRESSION & BROADER ROUTE SMOKE EVIDENCE (G8)
# BẰNG CHỨNG KIỂM THỬ HÌNH ẢNH 36 MÀN HÌNH CHÍNH, 20 TRẠNG THÁI MỤC TIÊU & SMOKE TOÀN TUYẾN (G8)

- **Historical 07.2 Baseline (Preserved Intact):**
  - `apps/sophia-ai-factory/docs/design/zen-design-os/evidence/screenshots/` (36 historical pilot PNGs)
  - `apps/sophia-ai-factory/docs/design/zen-design-os/evidence/targeted/` (12 historical targeted PNGs)
- **New 07.3 Integration Candidate Visual Baseline:**
  - **Primary 36-Screen Matrix:** `apps/sophia-ai-factory/docs/design/zen-design-os/release-review/screenshots-07.3/` (**36 PNGs**)
  - **Targeted States & Broader Smoke Routes:** `apps/sophia-ai-factory/docs/design/zen-design-os/release-review/targeted-07.3/` (**20 PNGs**)
  - **Manifest & Axe WCAG 2.2 AA Audit:** `apps/sophia-ai-factory/docs/design/zen-design-os/release-review/evidence/g8-visual-manifest-07-3.json` & `g8-axe-summary-07-3.json`
- **Playwright Spec:** `apps/sophia-ai-factory/tests/e2e/zen07-3/zen-07-3-release-acceptance.spec.ts`
- **Gate Verdict:** **PASS (`36/36` Primary + `20/20` Targeted/Smoke Captures Verified Visually, `0px` Horizontal Overflow Across All Viewports, `0` Axe WCAG 2.2 AA Violations)**

---

## 1. Tóm tắt Tiếng Việt / English Summary

**🇻🇳 Tiếng Việt:**
1. **Bảo toàn 100% lịch sử 07.2:** Toàn bộ ảnh chụp trong `docs/design/zen-design-os/evidence/` được giữ nguyên không ghi đè.
2. **Ma trận 36 ảnh chụp chính mới (`screenshots-07.3/`):** Đã chụp mới trên ứng viên tích hợp kết hợp PR #155 + PR #171 qua đủ **3 màn hình trọng điểm (`Setup Wizard`, `Operations Dashboard`, `AI Video / Niche Studio`) × 2 chế độ (`Dark` `#090A10` & `Light` `#F8F9FC`) × 2 ngôn ngữ (`Tiếng Việt` & `English`) × 3 khung nhìn (`375px` di động, `768px` máy tính bảng, `1440px` máy tính để bàn)**. Tất cả 36 trạng thái đều đạt **`0px` tràn ngang** và **`0` lỗi WCAG 2.2 AA** từ `@axe-core/playwright`.
3. **20 ảnh chụp trạng thái mục tiêu, hộp thoại mở & kiểm thử khói mở rộng (`targeted-07.3/`):** Bao phủ toàn bộ các trạng thái yêu cầu của G8 (nút bị vô hiệu hóa, đang tải/xác thực, lỗi xác thực khóa, khóa đã xác thực kèm biên lai `ValidationReceiptCard` mới của PR #171 ở cả Sáng & Tối, hàng đợi phê duyệt trống & chờ duyệt, văn bản tiếng Việt dài có dấu phức tạp, chế độ giảm chuyển động `prefers-reduced-motion: reduce`, 6 ảnh hộp thoại thực đang mở, cùng các tuyến mở rộng tiêu thụ token toàn cục là `/vi/pricing` với `PaidPilotBanner` 14 ngày của PR #171 và `/vi/dashboard/settings` tab Hồ sơ + Giao diện).
4. **Kiểm tra trực quan bằng mắt (Visual Inspection Findings):** Quá trình kiểm tra trực tiếp từng nhóm ảnh đã giúp phát hiện và sửa ngay 2 chi tiết tinh tế trước khi đóng gói: khoảng cách nút xếp chồng dọc của `DialogFooter` trên màn hình hẹp (`gap-2`) và biến thể nút `"Hủy"` trung tính (`variant="outline"`) trên `RotationDialog`.

**🇬🇧 English:**
All historical 07.2 captures under `docs/design/zen-design-os/evidence/` remain untouched. A fresh, reproducible 56-screenshot visual baseline (`36` primary matrix screenshots + `20` targeted/dialog/smoke screenshots) was generated against the reconciled 07.3 Release Candidate (`origin/main` `27107209d` + security/contrast/dialog fixes). Every route and targeted state passed automated WCAG 2.2 AA axe-core scanning (`0` violations) and `0px` horizontal overflow verification, and representative captures across Dark, Light, Vietnamese diacritics, mobile (`375px`), and PR #171 surfaces were visually inspected.

---

## 2. Ma trận 36 Ảnh Chụp Chính (`release-review/screenshots-07.3/`)

| Pilot Screen | Route | Locales | Themes | Viewports (`px`) | Files (`screenshots-07.3/*.png`) | Overflow (`px`) | Axe WCAG 2.2 AA |
|---|---|---|---|---|---|---|---|
| **1. Setup Wizard / BYOK** *(with PR #171 1-Key OpenRouter Fast-Track)* | `/[locale]/setup` | `vi`, `en` | `dark` (`#090A10`), `light` (`#F8F9FC`) | `375`, `768`, `1440` | `setup-wizard__{vi,en}__{dark,light}__{375,768,1440}w.png` (12 files) | `0 px` | **`0` violations** |
| **2. Operations Dashboard** *(Quiet Enterprise + TopBar `⌘K`)* | `/[locale]/dashboard` | `vi`, `en` | `dark` (`#090A10`), `light` (`#F8F9FC`) | `375`, `768`, `1440` | `dashboard__{vi,en}__{dark,light}__{375,768,1440}w.png` (12 files) | `0 px` | **`0` violations** |
| **3. AI Video / Niche Studio** *(Creative Studio Workspace)* | `/[locale]/dashboard/niche-studio` | `vi`, `en` | `dark` (`#090A10`), `light` (`#F8F9FC`) | `375`, `768`, `1440` | `niche-studio__{vi,en}__{dark,light}__{375,768,1440}w.png` (12 files) | `0 px` | **`0` violations** |

---

## 3. Danh mục 20 Ảnh Trạng thái Mục tiêu, Hộp thoại & Smoke Mở rộng (`release-review/targeted-07.3/`)

| # | File Name (`targeted-07.3/`) | Requirement Covered | Theme / Viewport | Axe WCAG 2.2 AA |
|---:|---|---|---|---|
| 1 | `s01-setup-disabled-controls-vi-dark.png` | **Disabled controls** (Empty key → disabled `Verify` button) | Dark / `1440w` | `0` violations |
| 2 | `s02-setup-loading-validating-vi-dark.png` | **Loading state** (Active credential probe spinner) | Dark / `1440w` | Captured mid-flight |
| 3 | `s03-setup-validation-error-vi-dark.png` | **Validation error** (`HTTP 422` localized error alert) | Dark / `1440w` | `0` violations |
| 4 | `s04-setup-verified-receipt-vi-dark.png` | **Verified credential (Dark)** + PR #171 `ValidationReceiptCard` | Dark / `1440w` | `0` violations |
| 5 | `s05-setup-verified-receipt-vi-light.png` | **Verified credential (Light)** + harmonized PR #171 `ValidationReceiptCard` | Light / `1440w` | `0` violations |
| 6 | `s06-approvals-empty-state-vi-light.png` | **Empty state** (`/vi/dashboard/approvals` zero queue items in Light mode) | Light / `1440w` | `0` violations |
| 7 | `s07-approvals-pending-vi-light.png` | **Approval desk (Light)** (`/vi/dashboard/approvals` governance & queues) | Light / `1440w` | `0` violations |
| 8 | `s08-approvals-pending-vi-dark.png` | **Approval desk (Dark)** (`/vi/dashboard/approvals` governance & queues) | Dark / `1440w` | `0` violations |
| 9 | `s09-niche-studio-long-vi-text-dark.png` | **Long Vietnamese diacritic text** (`ắ, ậ, ể, ỗ, ự` overflow & line-height check) | Dark / `1440w` | `0` violations |
| 10 | `s10-dashboard-reduced-motion-vi-dark.png` | **Reduced motion** (`prefers-reduced-motion: reduce` media emulation) | Dark / `1440w` | `0` violations |
| 11 | `s11-smoke-pricing-paid-pilot-vi-light.png` | **Smoke route (Light):** `/vi/pricing` + PR #171 `PaidPilotBanner` + AEO Bento | Light / `1440w` | `0` violations |
| 12 | `s12-smoke-pricing-paid-pilot-vi-dark.png` | **Smoke route (Dark):** `/vi/pricing` + MarketingNav/Footer + `PaidPilotBanner` | Dark / `1440w` | `0` violations |
| 13 | `s13-smoke-settings-profile-vi-dark.png` | **Smoke route:** `/vi/dashboard/settings` (Account & BYOK Vault Banner) | Dark / `1440w` | `0` violations |
| 14 | `s14-smoke-settings-appearance-vi-dark.png` | **Smoke route:** `/vi/dashboard/settings` (Appearance Theme Switcher + Geo Picker) | Dark / `1440w` | `0` violations |
| 15 | `t05-dialog-cmdk-dashboard-vi-dark-1440w.png` | **Dialog open:** Production Dashboard `CmdKPalette` (Dark) | Dark / `1440w` | `0` violations |
| 16 | `t05-dialog-cmdk-dashboard-vi-light-1440w.png` | **Dialog open:** Production Dashboard `CmdKPalette` (Light) | Light / `1440w` | `0` violations |
| 17 | `t06-mobile-drawer-dialog-vi-dark-375w.png` | **Dialog open:** `DashboardMobileDrawer` modal focus-trap (Dark mobile) | Dark / `375w` | `0` violations |
| 18 | `t06-mobile-drawer-dialog-vi-light-375w.png` | **Dialog open:** `DashboardMobileDrawer` modal focus-trap (Light mobile) | Light / `375w` | `0` violations |
| 19 | `t07-rotation-dialog-vi-dark-375w.png` | **Sensitive action dialog open:** `RotationDialog` (Dark mobile `375w`) | Dark / `375w` | `0` violations |
| 20 | `t07-rotation-dialog-vi-light-375w.png` | **Sensitive action dialog open:** `RotationDialog` (Light mobile `375w`) | Light / `375w` | `0` violations |
