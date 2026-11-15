# 08 — CORE PROTECTED-FLOW, PERFORMANCE, CLOUDFLARE BUILD & CI GATES (G9 / G10 / G11)
# BÁO CÁO HỒI QUY LUỒNG BẢO VỆ, ĐỘ LỆCH BUNDLE CLOUDFLARE WORKER & TOÀN BỘ CỔNG CI (G9–G11)

- **Bundle Delta Evidence:** `apps/sophia-ai-factory/docs/design/zen-design-os/release-review/evidence/g10-bundle-delta-07-3.json`
- **Lab Runtime Performance Evidence:** `apps/sophia-ai-factory/docs/design/zen-design-os/release-review/evidence/g10-lab-runtime-perf-07-3.json`
- **Gates Verdict:** **G9 PASS | G10 PASS | G11 PASS (with 3 Pre-Existing Baseline Items Transparently Classified)**

---

## 1. Cổng G9 — Hồi quy toàn diện 15 khu vực Luồng Bảo vệ (Protected-Flow Regression)

Tất cả kiểm thử được chạy cục bộ hoàn toàn bằng mock định định (deterministic mocks) và SQLite/D1 nội bộ — **không phát sinh bất kỳ cuộc gọi trả phí, giao dịch tiền thật, xuất bản thật hay kết nối CSDL sản xuất nào**.

| # | Protected Area / Khu vực bắt buộc | Kết quả xác minh thực tế |
|---:|---|---|
| 1 | **Better Auth / Session** | Đăng ký (`/api/auth/sign-up/email`), đăng nhập (`/api/auth/sign-in/email`) và cookie phiên Better Auth v1.7 hoạt động trọn vẹn trên trình duyệt thực (`22/22` bài test Playwright + unit tests auth PASS) |
| 2 | **Signup / Organization** | Tạo tài khoản CEO + liên kết tổ chức/workspace không bị ảnh hưởng bởi giao diện Sáng/Tối |
| 3 | **CSRF Double-Submit** | `POST /api/user/byok` thiếu `x-csrf-token` bị chặn `HTTP 403`; giả mạo `Next-Action` trên `/api/*` bị chặn `403`; Setup Wizard gửi `x-csrf-token` hợp lệ từ cookie đi qua cổng CSRF |
| 4 | **BYOK Verification** | Xác thực khóa OpenRouter/ElevenLabs/D-ID/HeyGen hoạt động chuẩn; phân biệt chính xác khóa hợp lệ (`200`), khóa sai (`422 INVALID`) và hết hạn mức nhà cung cấp (`422 PROVIDER_UNAVAILABLE`) |
| 5 | **Secure Credential Save** | Mã hóa AES-256-GCM và lưu theo `user_id` của phiên xác thực (`FLOW_1_SETUP_WIZARD_SAVE`: `PASSED`) |
| 6 | **Credential Reload & Masking** | `GET /api/user/byok` chỉ trả bản che `****...xxxx` và trạng thái; không bao giờ lộ khóa gốc ra client |
| 7 | **Provider Readiness** | `ValidationReceiptCard` và biểu ngữ trạng thái sẵn sàng AI trên Dashboard/Niche Studio đồng bộ Sáng/Tối |
| 8 | **Dashboard Navigation** | Điều hướng Sidebar, ngăn kéo di động `320px`/`375px`, chuyển ngôn ngữ `VI`/`EN` và bảng lệnh nhanh `⌘K` hoạt động mượt |
| 9 | **Video Studio / Niche Studio** | Khung soạn thảo kịch bản, xem trước phân cảnh 9:16/16:9/1:1 và trình kiểm tra tuân thủ hiển thị chuẩn cả Sáng & Tối |
| 10 | **AI Job Lifecycle & Webhooks** | Callback Inngest (`/api/inngest`) và Telegram Bot `@Sophia_Bbot` (`/api/webhooks/telegram`) giữ nguyên đường vào không bị vướng CSRF (`FLOW_2_TELEGRAM_WEBHOOK`: `PASSED`) |
| 11 | **Payment UI & IPN Webhooks** | Trang `/[locale]/pricing` (gồm `PaidPilotBanner` 14 ngày VietQR/PayOS + USDT NOWPayments) và chữ ký HMAC của `/api/webhooks/nowpayments` giữ nguyên 100% (`FLOW_3_NOWPAYMENTS_ROUTE`: `PASSED`; không xuất hiện Polar/PayPal) |
| 12 | **Human Approval UI** | `/[locale]/dashboard/approvals` (`ApprovalQueue`, `CampaignApprovalQueue`, `PublishLedgerApprovalQueue`, `TikTokComplianceFields`) đạt chuẩn tương phản WCAG 2.2 AA |
| 13 | **Publishing Preflight & Status** | Cổng kiểm tra trước xuất bản (TikTok privacy/unaudited self-only, YouTube synthetic-media provenance) giữ nguyên 100% kết quả nghiệp vụ phía server |
| 14 | **i18n (`vi` + `en` + 10 locales)** | `npm run i18n:validate` đạt `0` khóa thiếu trên `5.770` lệnh gọi `t()`; `deepMergeFallback` bảo vệ an toàn mọi locale phụ |
| 15 | **Tenant Isolation** | Giả mạo `userId` hoặc `organizationId` trong payload bị loại bỏ; toàn bộ truy vấn khóa và hạn mức neo chặt vào phiên xác thực |

---

## 2. Cổng G10 — Hiệu năng Phòng thí nghiệm & Độ lệch Bundle Cloudflare Worker (`deploy:build`)

### 2.1 Đối chiếu Bundle trong điều kiện Build đồng nhất (`Pre-Zen d785888a7` vs `07.3 RC`)

Cả hai bản đều được biên dịch bằng đúng chuỗi lệnh sản xuất `npm run deploy:build` (`next build` + `fix-instrumentation-standalone.mjs` + `patch-opennext-d3-stubs.sh` + `@opennextjs/cloudflare build --skipNextBuild` + `inject-scheduled-handler.mjs`).

> **Lưu ý quan trọng khi đọc số đo:** So với mốc trước Zen (`d785888a7`), bản `07.3 RC` bao gồm **cả Zen Design OS (PR #155) lẫn toàn bộ tính năng mới của Genesis Activation Funnel (PR #171: 52 tệp — 1-key BYOK router, Paid Pilot 14 ngày, R2 edge renderer, TikTok compliance publish gate & org SSE)**.

| Metric / Chỉ số Build | Pre-Zen `main` (`d785888a7`) | 07.3 RC (`PR #155 + PR #171 + 07.3 Fixes`) | Exact Delta (`07.3 RC - Pre-Zen`) | Ghi chú kỹ thuật |
|---|---:|---:|---:|---|
| **Client JS Chunks Count** | `217` files | `231` files | **`+14` files** | Thêm các chunk phân tách theo tuyến của PR #171 + Zen Theme/CmdK |
| **Total Client JS (Raw)** | `7,471,743 B` | `7,683,364 B` | **`+211,621 B` (`+206.66 KB`)** | Tổng toàn bộ 231 tệp chunk tĩnh (người dùng chỉ tải các chunk thuộc trang đang xem) |
| **Total Client JS (Gzip L9)** | `2,413,400 B` | `2,483,756 B` | **`+70,356 B` (`+68.71 KB`)** | Đã gộp cả PR #155 + PR #171 (52 tệp tính năng Genesis) |
| **Global CSS Chunks (`1` file Raw)** | `410,848 B` | `421,112 B` | **`+10,264 B` (`+10.02 KB`)** | Toàn bộ hệ thống Dual-Theme `:root`/`.dark`, high-contrast & reduced-motion |
| **Global CSS Chunks (`1` file Gzip L9)** | `51,404 B` | `51,046 B` | **`-358 B` (`-0.35 KB`)** | Nhẹ hơn 358 byte sau nén gzip nhờ quy chuẩn hóa lớp Tailwind v4 |
| **OpenNext Worker `handler.mjs` (Raw)** | `42,501,042 B` | `42,683,643 B` | **`+182,601 B` (`+178.32 KB`)** | Chứa đầy đủ 22 mẫu cron & 39 tuyến lập lịch (`inject-scheduled-handler.mjs`) |
| **OpenNext Worker `handler.mjs` (Gzip L9)** | `9,936,277 B` (`9.48 MB`) | `9,908,828 B` (`9.45 MB`) | **`-27,449 B` (`-26.81 KB`)** | `npm run check:bundle-size`: `9.50 MB compressed` (**ĐẠT** giới hạn cứng `< 10.00 MB` của Cloudflare Workers) |

### 2.2 Số đo Phòng thí nghiệm trên Trình duyệt thực (`g10-lab-runtime-perf-07-3.json`)

*(Ghi chú minh bạch theo G10: Đây là số đo phòng thí nghiệm cục bộ trên Chromium — **không phải** số liệu thực địa CrUX p75 của người dùng cuối).*

| Pilot Route (`vi`) | Theme | HTTP | TTFB (`ms`) | FCP (`ms`) | DOM Complete (`ms`) | Lab CLS | Fonts Status | Hydration / Console Errors |
|---|---|---:|---:|---:|---:|---:|---|---|
| `/vi/setup` | `dark` | `200` | `73` | `428` | `755` | **`0.0000`** | `loaded` (`Inter`, `JetBrains Mono`) | `0` / `0` |
| `/vi/setup` | `light` | `200` | `68` | `408` | `714` | **`0.0000`** | `loaded` (`Inter`, `JetBrains Mono`) | `0` / `0` |
| `/vi/dashboard` | `dark` | `200` | `144` | `172` | `526` | **`0.0000`** | `loaded` (`Inter`, `JetBrains Mono`) | `0` / `0` |
| `/vi/dashboard` | `light` | `200` | `127` | `156` | `518` | **`0.0000`** | `loaded` (`Inter`, `JetBrains Mono`) | `0` / `0` |
| `/vi/dashboard/niche-studio` | `dark` | `200` | `103` | `208` | `344` | **`0.0000`** | `loaded` (`Inter`, `JetBrains Mono`) | `0` / `0` |
| `/vi/dashboard/niche-studio` | `light` | `200` | `109` | `224` | `362` | **`0.0000`** | `loaded` (`Inter`, `JetBrains Mono`) | `0` / `0` |

---

## 3. Cổng G11 — Bảng Kết quả Toàn bộ Cổng Chất lượng & Bảo mật CI

| Gate / Check | Exact Command Run | Classification | Exact Measured Result |
|---|---|---|---|
| **TypeScript (App)** | `npm run ci:typecheck` (`tsc --noEmit`) | **PASS** | `0` errors |
| **ESLint** | `npm run ci:lint` (`eslint src --max-warnings=525`) | **PASS** | `0` errors, `242` warnings (well below `525` cap; `0` warnings on any 07.3 modified file) |
| **4-Layer Architecture Boundaries** | `npm run check:boundaries` | **PASS** | `0` layer violations; legacy-tree imports `6 / 6` allowed |
| **i18n Key Completeness** | `npm run i18n:validate` | **PASS** | `5,770` `t()` calls, `2,558` static keys, `0` missing, `0` empty |
| **Color Token Ratchet** | `npm run check:color-tokens` | **PASS** | `1,029` literals vs `1,080` baseline (**`-51` hardcoded literals improved across 15 files**, `0` new hardcoded colors) |
| **DTCG ↔ CSS Parity** | `npx vitest run src/__tests__/director-control-deck-design-system.test.ts` | **PASS** | `6 / 6` assertions passed (29 semantic roles + Dual-Theme + Typography + WCAG AA) |
| **GET Route Side-Effects** | `npm run ci:get-side-effects` | **PASS** | `0` GET routes with DB write side effects |
| **Open-Core & Protected Flows** | `npm run verify:open-core` | **PASS** | `25/25` catalog entries (`100%`) + `11/11` protected-flow checks `PASSED` |
| **Unit & Integration Suite (Vitest)** | `npx vitest run` | **PASS** | **`2,110` test files passed** (`1` skipped), **`19,799` tests passed, `0` failed** |
| **Browser Dialog A11y (Playwright)** | `npx playwright test tests/e2e/dialog-a11y/dialog-accessibility.spec.ts` | **PASS** | **`20 / 20` passed** (`24` real dialog openings across `320px`/`375px`/`1440px`, `0` axe violations) |
| **Browser Visual, CSP, CSRF & Perf (Playwright)** | `npx playwright test tests/e2e/zen07-3/zen-07-3-release-acceptance.spec.ts` | **PASS** | **`2 / 2` suites passed** (`36` primary + `20` targeted/smoke PNGs, `0` axe violations, `CLS = 0`) |
| **Secret Scanning** | `npx secretlint --secretlintignore .secretlintignore <all touched & added files>` | **PASS** | `0` secrets or credentials detected *(Note: root wildcard `'*.{json,toml,...}'` in `npm run ci:secrets` scans large untracked/workspace JSONs slowly; targeted scan on 100% of changed/added files completed in `<3s` with `0` findings)* |
| **Cloudflare Worker Build & Size** | `npm run deploy:build && npm run check:bundle-size` | **PASS** | `.open-next/worker.js` generated cleanly; `9.50 MB` compressed (`< 10 MB` limit) |
| **Worker Standalone Typecheck** | `npm run worker:typecheck` | **PRE-EXISTING BASELINE FAILURE** | `src/seed/types/creative-economy/errors.ts(24,20): TS2554` (introduced in historical commit `44f15d1dc` / `#20`, untouched by Zen Design OS; out of scope per G0/G9 scope lock) |
| **Migration Prefix Uniqueness** | `npm run check:migrations` | **PRE-EXISTING BASELINE FAILURE** | Duplicate `0485_*` SQL prefix already present on `origin/main` (`27107209d`); Zen 07.3 adds `0` SQL migrations |
| **Dependency Vulnerability Audit** | `npm audit --audit-level=high` | **PRE-EXISTING BASELINE FAILURE (DEV-ONLY)** | `2` high advisories on dev-only `vite` (`vitest` test runner), non-blocking in `package.json` (`npm run ci:audit`); `0` new packages installed in 07.3 |
