# 09 — PROPOSED PR SCOPE, COMMIT GRAPH, REPRODUCTION GUIDE & ROLLBACK PLAN (G12 / G13)
# PHẠM VI PR ĐỀ XUẤT, CÂY COMMIT CỤC BỘ, HƯỚNG DẪN TÁI LẬP & KẾ HOẠCH HOÀN TÁC

- **Target Base Branch:** `main` (currently `27107209d63a4861c6657cbc0f480a3fb1143280`)
- **Prepared Local Integration Branch:** `audit/sophia-zen-design-release-readiness`
- **Worktree Path:** `/Users/macbook/sophia-ai-factory/.claude/worktrees/zen-design-release-readiness-07-3`
- **Push / Merge / Deploy Status:** **NOT EXECUTED (`NO PUSH. NO MERGE. NO DEPLOY.`)**

---

## 1. Phạm vi PR đề xuất & Ranh giới Thay đổi (Proposed PR Scope)

Ứng viên phát hành trên nhánh `audit/sophia-zen-design-release-readiness` được tách thành **4 commit cục bộ có phạm vi rõ ràng (scoped commits)**, giúp Founder kiểm duyệt từng phần hoặc revert độc lập nếu cần:

1. **Commit 1 — Security & BYOK Rate-Limit / CSRF Closure (`G4` + `G9`):**
   - `src/seed/security/use-csrf-token.ts` + 9 trình gọi mutating phía trình duyệt (`use-setup-wizard-actions.ts`, `setup-wizard-api.ts`, `api-keys-config.ts`, `byok-form-sections.tsx`, `api-keys-manager-handlers.ts`, `byok-rotation-view.tsx`, `campaign-queue-api.ts`, `queue-view-api.ts`, `whatsapp-templates-view.tsx`): Đính kèm `x-csrf-token` bắt buộc và sửa khóa payload `{ provider, key }`.
   - `src/middleware.ts` & `src/middleware/api-handler.ts`: Khoá bypass `Next-Action` không cho áp dụng lên `/api/*`; mở rộng giỏ D1 `RATE_LIMITS.byok` (`40/phút`) sang toàn bộ `/api/setup/*`.
   - `src/app/api/setup/{save,skip}/route.ts`, `src/tree/byok/{provider-health-checker,provider-probe}.ts`, `src/app/api/setup-wizard/validate-key/route.ts`, `src/seed/types/failure-kind.ts`: Giới hạn `20 req/phút` ở tầng route và phân loại `429`/`402` nhà cung cấp thành `'PROVIDER_UNAVAILABLE'`.
   - Bộ kiểm thử bảo mật `byok-rate-limit-security.test.ts`, `api-handler-rate-limit-buckets.test.ts`, `content-security-policy-configuration.test.ts`.
2. **Commit 2 — Post-PR #171 Dual-Theme WCAG 2.2 AA Harmonization, i18n Fallback & Real Dialog Accessibility (`G5` + `G6` + `G7`):**
   - `src/app/globals.css`, `src/i18n.ts`, `messages/{en,vi}.json`.
   - Các thành phần giao diện mới từ PR #171 & khung tiếp thị/cài đặt (`validation-receipt-card.tsx`, `api-key-input-controls.tsx`, `api-keys-step.tsx`, `approval-queue/*`, `pricing/view/*`, `aeo/*`, `marketing-nav*`, `marketing-footer*`, `settings/*`, `stitch-deck-*`).
   - Hoàn thiện hộp thoại thực trên trình duyệt (`dialog.tsx`, `command.tsx`, `command-items.tsx`, `cmd-k-palette.tsx`, `dashboard-mobile-drawer.tsx`, `dashboard-topbar.tsx`, `dashboard-shell.tsx`, `dashboard/layout.tsx`, `dashboard-sources-drawer.tsx`, `rotation-dialog.tsx`, `a11y-harness.tsx`).
3. **Commit 3 — Typography & Token Authority Documentation Reconciliation (`G0` + `G6`):**
   - `ZEN-07.3-GITHUB-BASELINE.md`, `DESIGN.md`, `apps/sophia-ai-factory/.claude/rules/sophia-design-authority.md`, `docs/design/zen-design-os/09-CROSS-PRODUCT-THEMING-GUIDE.md`, `docs/design-guidelines*.md`, `design-system/sophia-ai-factory/MASTER.md`.
4. **Commit 4 — Browser E2E Suites & Complete `release-review/` Owner Package (`G7` + `G8` + `G12`):**
   - `tests/e2e/dialog-a11y/dialog-accessibility.spec.ts`, `tests/e2e/zen07-3/zen-07-3-release-acceptance.spec.ts`.
   - Toàn bộ gói `apps/sophia-ai-factory/docs/design/zen-design-os/release-review/` (`01`..`10` + `ZEN-07.3-GITHUB-BASELINE.md` + `36` ảnh chính + `20` ảnh mục tiêu + `6` tệp JSON bằng chứng).

---

## 2. Hướng dẫn Tái lập Xác định (Deterministic Checkout / Build / Test Guide)

Founder hoặc kỹ sư độc lập có thể kiểm chứng lại 100% kết quả ngay trên máy cục bộ bằng đúng các lệnh sau:

```bash
# 1. Đi vào thư mục ứng dụng của worktree tích hợp cô lập
cd /Users/macbook/sophia-ai-factory/.claude/worktrees/zen-design-release-readiness-07-3/apps/sophia-ai-factory

# 2. Kiểm tra trạng thái nhánh sạch & commit SHA 40 ký tự
git status --short
git rev-parse HEAD
git log --oneline -5

# 3. Chạy các cổng kiểm tra tĩnh & kiến trúc (TypeScript, ESLint, Boundaries, i18n, Color Tokens, Open-Core)
npm run ci:typecheck
npm run ci:lint
npm run check:boundaries
npm run i18n:validate
npm run check:color-tokens
npm run verify:open-core

# 4. Chạy bộ kiểm thử bảo mật BYOK V6 & toàn bộ Vitest (19,799 tests)
npx vitest run src/app/api/user/byok/__tests__/byok-rate-limit-security.test.ts src/middleware/__tests__/api-handler-rate-limit-buckets.test.ts
npm test

# 5. Biên dịch bản dựng sản xuất Cloudflare Worker (OpenNext) & kiểm tra dung lượng < 10MB
npm run deploy:build
npm run check:bundle-size

# 6. (Tuỳ chọn) Chạy lại 22 kịch bản trình duyệt thực Playwright (G5/G7/G8/G9)
#    Mở terminal phụ khởi chạy dev server cô lập trên cổng 3107 với biến kiểm thử tạm thời,
#    sau đó chạy:
#    PLAYWRIGHT_TEST_BASE_URL=http://localhost:3107 npx playwright test tests/e2e/dialog-a11y/dialog-accessibility.spec.ts tests/e2e/zen07-3/zen-07-3-release-acceptance.spec.ts --workers=1
```

---

## 3. Rủi ro khi Merge & Kế hoạch Hoàn tác (Merge Risks & Rollback Instructions)

### 3.1 Rủi ro còn lại cần lưu ý khi triển khai
1. **Dung lượng nén Cloudflare Worker ở mức `9.50 MB / 10.00 MB` (`check:bundle-size`):** Bản dựng đạt chuẩn và nhẹ hơn Pre-Zen `26.81 KB` gzip, nhưng toàn bộ dự án đang tiến sát trần `10 MB` của gói Cloudflare Workers tiêu chuẩn. Không nên cài thêm thư viện client/server nặng trong các PR tiếp theo.
2. **Cloudflare Rocket Loader trên hostname `sophia.agencyos.network`:** Hiện tại HTML sản xuất không bị tiêm Rocket Loader, nhưng nếu quản trị viên bật Rocket Loader cấp toàn zone `agencyos.network` sau này sẽ xung đột với CSP nonce nghiêm ngặt. Khuyến nghị áp dụng Configuration Rule riêng cho `sophia.agencyos.network` trong tệp `04-THEME-CSP-ROCKET-LOADER.md`.
3. **Không có thay đổi Schema D1 (`0` tệp SQL migration mới):** Việc phát hành và hoàn tác hoàn toàn không có rủi ro mất mát dữ liệu hay kẹt migration CSDL.

### 3.2 Quy trình Hoàn tác Khẩn cấp sau khi Triển khai (Post-Merge Rollback Plan)

Vì nhánh này **không thay đổi schema D1**, việc hoàn tác là tức thì và không để lại tác dụng phụ dữ liệu:

```bash
# Phương án A — Hoàn tác tức thì trên biên Cloudflare Workers (< 15 giây):
cd apps/sophia-ai-factory
npx wrangler rollback --name sophia-ai-factory --message "Rollback Zen 07.3 harmonization" --yes

# Phương án B — Hoàn tác chuẩn qua GitHub Actions CI/CD (khuyến nghị):
git revert <merge-commit-sha> -m 1
git push origin main
gh run watch
```
