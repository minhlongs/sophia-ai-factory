# ZEN-07.2 / #07.3 — Zen Design OS v1.0 — Final Founder Acceptance & Owner Sign-Off Package (Gate 6)

**Repository:** `github.com/minhlongs/sophia-ai-factory`
**Branch:** `design/sophia-zen-design-os-v1`
**Baseline (`main`):** `673ec911be317233c7e6cb961bdca9d2097e210f`
**Original Handover Commit:** `4d23ddb386f499b7627f2c828a1b80c81c6a3382`
**Reported Checkpoint (#07.3 Brief):** `b3338a256408ef194cc63cb6fcbe6dcc27ca718c`
**Verified Code & Browser-Evidence Commit:** `cd068bd39917e560f8857d490e04790fc6b0a7bf`
**Verification Date:** `2026-11-13`
**Release Review Verdict:** **`READY_FOR_DRAFT_PR`** *(Enum: `READY_FOR_DRAFT_PR` / `PARTIAL` / `BLOCKED` / `REJECTED`)*

> ⚠️ **Lưu ý quan trọng / Mandatory Authorization Guard:**
> Kết luận **`READY_FOR_DRAFT_PR` KHÔNG PHẢI là quyền tự động push, merge, deploy hay chỉnh sửa Cloudflare.** Toàn bộ quá trình kiểm định được thực hiện cô lập tại máy local: không `git push`, không merge nhánh, không deploy Worker, không đụng cấu hình Cloudflare live, không truy cập dữ liệu production, và không tự tick duyệt thay Founder.
>
> **`READY_FOR_DRAFT_PR` is NOT authorization to push, merge, deploy, or mutate live Cloudflare settings.** No remote git mutation, deployment, zone change, production data access, or self-signoff was performed.

---

## 1. Exact Commit SHA Chain & Baseline (Chuỗi Commit & Mốc Đối Chiếu)

| Milestone / Mốc | Full 40-char SHA | Summary |
|:--|:--|:--|
| **Baseline (`main`)** | `673ec911be317233c7e6cb961bdca9d2097e210f` | Nhánh `main` gốc để đối chiếu toàn bộ 164 file thay đổi và đo hiệu năng/bundle. / Canonical baseline for diff, bundle, and rate-limit delta checks. |
| **Handover v1.0** | `4d23ddb386f499b7627f2c828a1b80c81c6a3382` | Bản bàn giao Zen Design OS v1.0 ban đầu (36 file so với `main`). / Initial dual-theme token, motion, and 14-doc handover commit. |
| **Reported Checkpoint** | `b3338a256408ef194cc63cb6fcbe6dcc27ca718c` | Mốc báo cáo trong lệnh #07.3 sau đợt vá 7 lỗi V1–V7 đầu tiên. / Checkpoint cited in #07.3 brief after initial V1–V7 remediation. |
| **Security & Locale Seal** | `9b6b786565f5da77b3a0f9a312b8d97ba001c78c` | Khóa giới hạn BYOK theo từng route, sửa chuyển tiếp ngôn ngữ `/en/*` và focus dialog. / Per-route BYOK probing caps, `/en/*` locale header forwarding, dialog focus return. |
| **Verified Code & Evidence (`cd068bd39`)** | `cd068bd39917e560f8857d490e04790fc6b0a7bf` | Đóng toàn bộ kiểm thử Playwright modal thật, bộ test bảo mật BYOK đối kháng, đồng bộ font `DESIGN.md` và vượt qua 8/8 cổng chất lượng (`2096` file test / `19,682` tests). / Final code, test, and machine-evidence tree verified across all quality gates. |

*(Commit đóng gói tài liệu cuối cùng ngay trên `cd068bd39` chỉ cập nhật 7 báo cáo `ZEN-07.2-*.md` trong thư mục `evidence/`, giữ nguyên 100% mã nguồn, test và bằng chứng máy đo tại `cd068bd39917e560f8857d490e04790fc6b0a7bf`.)*

---

## 2. Status of the Seven Remediated Findings & Closure Fixes (Trạng Thái 7 Lỗi Đã Khắc Phục)

**[VN]** Cả 7 lỗi phát hiện ở vòng kiểm định trước (V1–V7: 1 lỗi nghiêm trọng P0 + 6 lỗi giao diện/truy cập P1) cùng 5 điểm hoàn thiện phát sinh khi đóng vòng #07.3 đều đã được **khắc phục triệt để và xác minh tự động**.
**[EN]** All seven previously reported defects (V1–V7) plus five acceptance-closure defects uncovered while completing real-browser dialog and adversarial BYOK testing are **CLOSED & VERIFIED**.

| ID | Mức độ / Sev | File & Line | Mô tả lỗi & Cách khắc phục (VN / EN) | Trạng thái / Status |
|:--:|:--:|:--|:--|--:|
| **V1** | **P1** | `src/components/niche-studio/niche-gate1-readiness-card.tsx:24,36,49` | **VN:** Nền tối bán trong suốt `bg-zinc-900/70` làm chữ mất tương phản ở chế độ Sáng (Light mode). Đã đổi sang `bg-card dark:bg-zinc-900/70` và token chữ ngữ nghĩa.<br>**EN:** Translucent dark surface failed AA contrast on Ivory Light background; replaced with semantic `bg-card dark:bg-zinc-900/70` and foreground tokens. | **CLOSED** (`g4-axe-summary.json` 0 violations) |
| **V2** | **P1** | `src/components/niche-studio/video-compliance-preview-player.tsx:58` | **VN:** Khung trống dùng `bg-zinc-900/40` bị xám mờ ở Light mode. Đã chuyển sang `bg-card dark:bg-zinc-900/40`, `text-foreground dark:text-zinc-300`.<br>**EN:** Empty-state dark translucency replaced with dual-theme `bg-card` + semantic text tokens. | **CLOSED** (`g4-axe-summary.json` 0 violations) |
| **V3** | **P1** | `src/components/stitch/ui/button-styles.ts:14` | **VN:** Nút chính ở Dark mode (`#6366F1` + chữ trắng) chỉ đạt 4.47:1 (< 4.5:1 AA). Đã áp dụng `bg-primary text-primary-foreground dark:bg-primary-600 dark:text-white` (**6.29:1** Dark, **8.61:1** Light).<br>**EN:** Raised Dark-mode primary button contrast from 4.47:1 to 6.29:1 (Light: 8.61:1). | **CLOSED** (`director-control-deck-design-system.test.ts`) |
| **V4** | **P1** | `src/components/niche-studio/sophia-artifact-canvas.tsx:140-149` | **VN:** 5 mã màu `#rrggbb` cứng làm đỏ cổng `npm run check:color-tokens`. Đã thay bằng `var(--primary-600)`, `var(--primary-foreground)` và hằng token.<br>**EN:** Removed 5 hardcoded hex literals; `check:color-tokens` passes at `1045` vs `1080` baseline (`-35` net). | **CLOSED** (`check:color-tokens` exit 0) |
| **V5** | **P1** | `src/forest/dashboard/dashboard-user-card.tsx:24` | **VN:** Khôi phục `dark:text-violet-300` (~8.5:1 trên nền tối) cho huy hiệu PRO để vừa đạt chuẩn AA vừa khớp test contract.<br>**EN:** Restored `dark:text-violet-300` (~8.5:1 contrast) preserving the PRO badge test contract. | **CLOSED** (`npm test` green) |
| **V6** | **P0** | `src/middleware/api-handler.ts:72-78`<br>`src/seed/security/sql-rate-limiter-queries.ts:32` | **VN:** Tách `/api/user/byok` và `/api/setup-wizard` khỏi nhóm đăng nhập `auth` (10 lần/phút) sang nhóm riêng `byok` (**40 lần/phút**), kết hợp giới hạn chống dò key ở từng route (xem Mục 4).<br>**EN:** Isolated BYOK & Setup Wizard into a dedicated `byok` D1 bucket (40 req/min) distinct from `auth` (10/min) and `admin` (50/min), backed by route-level probing caps (§4). | **CLOSED** (12/12 BYOK security tests) |
| **V7** | **P1** | `src/components/niche-studio/niche-form-product-inputs.tsx:102,118` | **VN:** Khôi phục `aria-label` cho 2 ô nhập URL sản phẩm và bằng chứng xã hội để trình đọc màn hình nhận diện đầy đủ.<br>**EN:** Restored `aria-label` attributes alongside `<label htmlFor>` on product URL and social proof inputs. | **CLOSED** (`niche-studio-readiness-ui.test.tsx`) |

**Các sửa lỗi bổ sung trong vòng đóng nghiệm thu #07.3 / Additional #07.3 Closure Corrections:**
- **C1 — Chuyển tiếp ngôn ngữ `/en/*` (`src/middleware/public-pipeline.ts`):** Gắn header `x-next-intl-locale` để các trang `/en/*` hiển thị đúng tiếng Anh thay vì rơi về tiếng Việt. / Forwarded stripped locale header so `/en/*` routes render English properly.
- **C2 — Trả focus & giới hạn chiều cao hộp thoại xoay khóa (`src/app/(app)/dashboard/admin/byok-rotation/components/rotation-dialog.tsx` + `messages/*.json`):** Trả con trỏ bàn phím về đúng nút mở hộp thoại sau khi đóng và thêm khóa dịch `cancel`. / Preserved trigger focus return and viewport height bounds on `ByokRotationView`.
- **C3 — Nhãn trợ năng cho bảng lệnh nhanh (`src/seed/components/ui/command.tsx`):** Bổ sung tiêu đề & mô tả `sr-only` mặc định cho `CommandDialog` để trình đọc màn hình không gặp hộp thoại rỗng tên. / Added `sr-only` `DialogTitle` and `DialogDescription` defaults on `CommandDialog`.
- **C4 — Kiểu `inert` & kiểm thử ngăn kéo đóng (`src/components/stitch/layouts/dashboard/mobile-nav-drawer.tsx:44`, `src/components/stitch/__tests__/stitch-screens-a11y.test.tsx`):** Chuẩn hóa kiểu `inert` cho React 19 / TypeScript và sửa bài test truy vấn ngăn kéo đang đóng (`aria-hidden`). / Fixed `inert` boolean typing (`type-check` 0 errors) and closed-drawer accessibility-tree assertion.
- **C5 — Chống tràn ngang ngăn kéo nguồn dữ liệu (`src/components/stitch/screens/dashboard/dashboard-sources-drawer.tsx`):** Đảm bảo không tràn ngang ở khung hẹp 320px–375px. / Prevented narrow-viewport overflow in sources drawer.

---

## 3. Decision 3 — Dialog Accessibility Evidence (Bằng Chứng Trợ Năng Hộp Thoại Trên Trình Duyệt Thật)

- **Bằng chứng máy đo / Machine Artifact:** [`dialog-a11y-report.json`](./dialog-a11y-report.json) (`12` phép đo trình duyệt thật / `12` real-browser Chrome measurements)
- **Kịch bản kiểm thử / Playwright Spec:** `apps/sophia-ai-factory/tests/e2e/dialog-a11y/dialog-accessibility.spec.ts`
- **Báo cáo chi tiết / Detailed Report:** [`ZEN-07.2-WCAG-AND-MOTION-EVIDENCE.md`](./ZEN-07.2-WCAG-AND-MOTION-EVIDENCE.md) §2.1

**[VN]** Ba hộp thoại Radix `Dialog` thật đã được mở bằng thao tác người dùng thật trên Chrome (nhấn nút mở form, nhấn nút xoay khóa trên trang quản trị thật, và bấm tổ hợp phím `Meta+k`) qua đủ 4 tổ hợp `vi`/`en` × `dark`/`light` (12 lượt đo). **Mọi kết quả `null` đều được ghi nhận trung thực đúng bản chất kỹ thuật, tuyệt đối không gắn nhãn PASS giả.**
**[EN]** Three real Radix `Dialog` surfaces were opened through genuine user interactions in Google Chrome across `vi`/`en` × `dark`/`light` (12 measurements). Actual values are recorded verbatim without promoting `null` checks to `PASS`.

| Hộp thoại / Dialog Surface | Cách mở / Trigger | Focus ban đầu / Initial Focus | Giữ Tab & Shift+Tab / Contained | Phím `Escape` đóng / Closes | Trả Focus về nút mở / Focus Return | Tên & Mô tả trợ năng / Accessible Title & Description | Khóa nền ngoài / Outside Blocked |
|:--|:--|:--|--:|:--:|:--|:--|:--|
| **Harness Form Dialog** (`vi`/`en` × `dark`/`light`, 4/4) | Click nút `Open form dialog` | `input#harness-field-first` (bên trong modal) | `true` / `true` (5 điểm dừng) | `true` | `true` → `button[harness-dialog-trigger]` | Có đầy đủ tiêu đề & mô tả (`labelledBy` + `describedBy` hợp lệ) | `aria-hidden="true"` ngoài modal + `body` `pointer-events: none` |
| **BYOK Master Key Rotation Dialog** (`vi`/`en` × `dark`/`light`, 4/4) | Click nút production `Xoay Khóa Ngay` / `Rotate Now` | `input#rotation-reason` (bên trong modal) | `true` / `true` (4 điểm dừng) | `true` | `true` → `button` (`Xoay Khóa Ngay` / `Rotate Now`) | Song ngữ đầy đủ: *"Xác Nhận Xoay Khóa Master"* (VI) / *"Confirm Master Key Rotation"* (EN) + mô tả 7 ngày | `aria-hidden="true"` ngoài modal + `body` `pointer-events: none` |
| **Command Palette `CmdKPalette`** (`vi`/`en` × `dark`/`light`, 4/4) | Tổ hợp phím `Meta+k` | `input` tìm kiếm (bên trong modal) | `true` / `true` (2 điểm dừng) | `true` | **`null`** *(ghi nhận thật: `body` — xem ghi chú 2)* | `"Quick actions"` / `"Search the list and run a command."` *(xem ghi chú 3)* | `aria-hidden="true"` ngoài modal + `body` `pointer-events: none` |

**Ba ghi nhận trung thực từ dữ liệu đo / Three Measured Caveats Recorded Honestly:**
1. **`ariaModal: null` ở cả 12 phép đo:** Thư viện Radix UI không gắn thuộc tính `aria-modal="true"`; thay vào đó Radix khóa nền bằng cách đặt `aria-hidden="true"` lên toàn bộ phần tử anh em bên ngoài hộp thoại và đặt `pointer-events: none` lên `<body>`. Cả hai cơ chế thật này đều được đo trực tiếp (`backgroundAriaHidden: true`, `backgroundPointerEvents: "none"`).
2. **`focusReturnedToTrigger: null` trên `CmdKPalette`:** Bảng lệnh mở bằng phím tắt `Meta+k` nên không có nút bấm khởi phát để trả focus về; trình duyệt trả focus về `body`. Bài test khẳng định `expect(r.focusReturnedToTrigger).toBeNull()` thay vì báo PASS giả.
3. **Tên `sr-only` của `CmdKPalette` đang dùng tiếng Anh ở cả hai ngôn ngữ:** Chuỗi mặc định `"Quick actions"` tại `src/seed/components/ui/command.tsx:43` chưa nối với khóa tiếng Việt sẵn có tại `messages/vi.json:7328` (`"Thao tác nhanh"`), được ghi nhận ở Mục 9 để tránh sửa lan sang các luồng dùng chung ngoài phạm vi pilot.

---

## 4. Gate 4 — BYOK Rate-Limit Security Audit (Kiểm Toán Bảo Mật Giới Hạn Tốc Độ BYOK)

- **Mã nguồn kiểm toán / Audited Files:** `src/middleware/api-handler.ts:69-114`, `src/seed/security/sql-rate-limiter-queries.ts:25-36`, `src/forest/middleware/rate-limiter/endpoint-rate-limiters.ts:9-33`, và 6 route BYOK / Setup Wizard.
- **Bộ test xác minh / Automated Suites:** `src/middleware/__tests__/api-handler-rate-limit-buckets.test.ts` (**6/6 PASS**) & `src/app/api/user/byok/__tests__/byok-rate-limit-security.test.ts` (**6/6 PASS**).

**[VN]** Kiến trúc bảo vệ gồm **2 tầng độc lập**, đảm bảo khách hàng CEO nhập/kiểm tra API key mượt mà ở Setup Wizard mà **không tạo ra bất kỳ khe hở dò quét API key không giới hạn nào**:
**[EN]** A **two-layer defense-in-depth rate-limit architecture** separates onboarding from login while strictly bounding upstream provider probing by both IP and authenticated user:

### 4.1 Tầng 1 — Cổng chặn D1 SQL toàn cục (`src/middleware/api-handler.ts:69-80`)

| Nhóm đường dẫn / Path Prefix | Baseline `main` (`673ec911`) | Nhánh hiện tại (`cd068bd39`) | Đánh giá bảo mật / Security Assessment |
|:--|--:|--:|:--|
| `/api/auth/*` | `auth` (`10`/phút) | `auth` (`10`/phút) | **Giữ nguyên** — chống dò mật khẩu đăng nhập; không bị lưu lượng BYOK làm nghẽn. / Unchanged login brute-force cap. |
| `/api/user/byok*` | `auth` (`10`/phút — gây lỗi 429 P0) | **`byok` (`40`/phút, fail-closed)** | **Tách riêng an toàn** — đủ cho trang Setup Wizard tải trạng thái + lưu key, chặt hơn 2.5 lần so với mức `/api/*` chung (`100`/phút). / Dedicated fail-closed D1 bucket. |
| `/api/setup-wizard*` | `api` (`100`/phút) | **`byok` (`40`/phút, fail-closed)** | **Chặt hơn baseline 60%** (`100 → 40`/phút). / Tighter than `main` by 60%. |
| `/api/admin/*` | rơi nhầm vào `auth` (`10`/phút) | `admin` (`50`/phút) | Khôi phục đúng cấu hình `RATE_LIMITS.admin` đã khai báo sẵn. / Restored pre-declared admin bucket. |

### 4.2 Tầng 2 — Giới hạn chi tiết theo hành động & chống xoay tài khoản/IP ở từng Route

| Endpoint & Hành động / Action | Giới hạn theo User / Per-User Cap | Giới hạn theo IP (`cf-connecting-ip`) / Per-IP Cap | Mã nguồn / Exact Source |
|:--|--:|--:|:--|
| `GET /api/user/byok` (Đọc danh sách provider — không trả key thô) | `60` / phút (`byok:read:${user.id}`) | `40` / phút (Tầng 1 `byok`) | `src/app/api/user/byok/route.ts:32-36` |
| `POST /api/user/byok` — **Save / Replace** (`validateLive` tắt) | `20` / phút (`byok:write:${user.id}`) | `40` / phút (Tầng 1 `byok`) | `src/app/api/user/byok/route.ts:46-50` |
| `POST /api/user/byok` — **Verify live** (`validateLive: true`) | **`10` / phút** (`byok:probe:${user.id}`) | **`12` / phút** (`byok:probe:${ip}`) | `src/app/api/user/byok/route.ts:68-80` |
| `DELETE /api/user/byok` — **Delete key** | **`10` / phút** (`byok:delete:${user.id}`) | `40` / phút (Tầng 1 `byok`) | `src/app/api/user/byok/route.ts:88-92` |
| `POST /api/user/byok/test` — **Verify stored/input key** | **`10` / phút** (`byok:test:${user.id}`) | **`10` / phút** (`byok:test:${ip}`) | `src/app/api/user/byok/test/route.ts:75-86` |
| `POST /api/setup-wizard/validate-key` — **Onboarding key probe** | **`12` / phút** (`setup:validate-key:${user.id}`) | **`12` / phút** (`setup:validate-key:${ip}`) | `src/app/api/setup-wizard/validate-key/route.ts:36-47` |
| `POST /api/setup-wizard/test-heygen` — **HeyGen probe** | **`10` / phút** (`setup:test-heygen:${user.id}`) | **`10` / phút** (`setup:test-heygen:${ip}`) | `src/app/api/setup-wizard/test-heygen/route.ts:38-49` |
| `POST /api/setup-wizard/test-resend` — **Resend email probe** | **`5` / phút** (`setup:test-resend:${user.id}`) | **`5` / phút** (`setup:test-resend:${ip}`) | `src/app/api/setup-wizard/test-resend/route.ts:31-42` |
| `POST /api/setup-wizard/heygen/auto-register` — **Webhook register** | **`5` / phút** (`setup:heygen-register:${user.id}`) | **`5` / phút** (`setup:heygen-register:${ip}`) | `src/app/api/setup-wizard/heygen/auto-register/route.ts:29-40` |

### 4.3 Kết quả kiểm thử kịch bản thực tế & tấn công đối kháng (`byok-rate-limit-security.test.ts`)

- **Verify / Save / Replace / Delete độc lập:** Hết hạn mức `Verify` (`10`/phút) không làm khóa thao tác `Delete` (`10`/phút) hay `Save` không dò mạng (`20`/phút) còn trong ngưỡng.
- **Tách biệt giữa các User / Tổ chức khác nhau:** Hai khách hàng độc lập ở hai IP khác nhau không làm cạn hạn mức của nhau; ngược lại, **1 user xoay nhiều IP** vẫn bị chặn ở mốc `10`/phút theo `user.id`, và **nhiều tài khoản xoay trên cùng 1 IP** bị chặn ở mốc `10`–`12`/phút theo IP.
- **Chống giả mạo Header IP / API Key:** `getClientIpIdentifier` (`endpoint-rate-limiters.ts:9-23`) ưu tiên `cf-connecting-ip` do Cloudflare gắn ở biên và **bỏ qua hoàn toàn header `x-api-key`** khi định danh IP, chặn đứng trò đổi `x-api-key` hoặc `x-forwarded-for` giả để né giới hạn.
- **Chịu tải đồng thời (`Promise.all` burst):** Bắn đồng thời 18 request song song chỉ cho phép đúng `10` request đi qua và trả `429` cho `8` request vượt ngưỡng.
- **Nhập sai key liên tục (Repeated invalid keys):** Các lần trả `422` do key sai vẫn trừ vào ngân sách dò key; ngay khi chạm ngưỡng `429`, hàm gọi ra nhà cung cấp ngoài (`probeProviderApiKey` / `fetch`) **ngừng hoàn toàn (0 cuộc gọi phát sinh thêm)**.
- **Chuẩn HTTP 429 & Bảo toàn Auth + CSRF:** Phản hồi `429` luôn trả đủ `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining: 0`, `X-RateLimit-Reset` và ghi sự kiện hợp lệ `limit_type: 'byok'` (`schemas-business.ts`). Request chưa đăng nhập bị chặn `401` **trước khi** tốn ngân sách rate-limit của người dùng thật; các lệnh ghi không có CSRF token hợp lệ vẫn bị chặn `403`.

---

## 5. Decision 1 — Cloudflare Rocket Loader Recommendation & Owner Steps (Khuyến Nghị Rocket Loader & Hướng Dẫn Cài Đặt Cho Founder)

- **Báo cáo chi tiết / Detailed Audit:** [`ZEN-07.2-DARK-LIGHT-CSP-AUDIT.md`](./ZEN-07.2-DARK-LIGHT-CSP-AUDIT.md) §1–§3 (`g2-audit.json`)

1. **Trạng thái thực tế trên `sophia.agencyos.network` (Đã đo trực tiếp, không suy đoán):**
   - Kiểm tra phản hồi thật `GET https://sophia.agencyos.network/vi/login` (HTTP 200) ghi nhận **0 dấu hiệu của Rocket Loader** (`type="text/rocketscript"`: 0, `rocket-loader`: 0, `data-cf-settings`: 0, `/cdn-cgi/`: 0). Toàn bộ **22/22 thẻ `<script>`** đều giữ nguyên `nonce` theo từng request với chính sách `script-src 'self' 'nonce-...'` nghiêm ngặt (không có `'unsafe-inline'`). **Hiện tại Rocket Loader đang TẮT trên phản hồi của Sophia.**
2. **Bảo vệ sẵn trong mã nguồn (`next-themes` + Strict Nonce CSP):**
   - `ZenThemeProvider` (`src/forest/theme/zen-theme-provider.tsx:38,54`) truyền `scriptProps={{ 'data-cfasync': 'false' }}` vào `next-themes@0.4.6`. Đã kiểm tra trực tiếp mã biên dịch của `next-themes@0.4.6`: `scriptProps` được trải (`spread`) **trước** khi gán `nonce`, nên thuộc tính `data-cfasync="false"` **không bao giờ ghi đè CSP nonce**.
   - CSP nghiêm ngặt với `nonce` theo từng request được **giữ nguyên 100%**, không nới lỏng `'unsafe-inline'`. Đã kiểm thử khởi tạo giao diện Sáng/Tối không nháy màu (0 FOUC) trên trình duyệt và xác minh tương thích với bản build Cloudflare Worker (`.open-next/worker.js`).
3. **Cấu hình an toàn nhỏ nhất đề xuất cho Founder (Chỉ áp dụng riêng cho tên miền phụ `sophia.agencyos.network` — ĐỂ CHỜ DUYỆT, CHƯA THỰC THI):**
   - **[VN]** Dù hiện tại Rocket Loader đang tắt và code đã có `data-cfasync="false"`, để phòng ngừa trường hợp sau này ai đó bật Rocket Loader cho toàn bộ tên miền `agencyos.network`, Founder có thể khóa riêng cho `sophia.agencyos.network` (không ảnh hưởng các trang khác trong cùng zone) theo 6 bước đơn giản sau:
   - **[EN]** Smallest safe defense-in-depth configuration (hostname-scoped Configuration Rule, leaving the zone-wide setting untouched — **left pending Founder approval, not executed**):
     1. 🖥️ Đăng nhập **Cloudflare Dashboard** → chọn tên miền **`agencyos.network`**. / Open Cloudflare Dashboard → select the `agencyos.network` zone.
     2. 🧭 Vào mục **Rules → Overview → Create rule → Configuration Rule**. / Navigate to **Rules → Overview → Create rule → Configuration Rule**.
     3. 🎯 Đặt tên quy tắc / Rule name: **`Sophia — Rocket Loader off`**.
     4. 🔍 Ở mục điều kiện (**If incoming requests match…**), chọn **Custom filter expression** và dán chính xác:
        `http.host eq "sophia.agencyos.network"`
     5. ⚙️ Ở mục thiết lập (**Then the settings are…**), bấm **Add** tại dòng **Rocket Loader** → chọn **Off**. / Add **Rocket Loader → Off**.
     6. 🚀 Bấm **Deploy** để lưu (giữ trạng thái đám mây cam **Proxied** như hiện tại, **không** chuyển DNS sang DNS-only). / Click **Deploy** (keep DNS proxied; do not switch to DNS-only).

---

## 6. Decision 2 — Typography Authority Resolution (Chuẩn Hóa Hệ Font Chữ)

- **Báo cáo chi tiết / Detailed Evidence:** [`ZEN-07.2-PERFORMANCE-COMPARISON.md`](./ZEN-07.2-PERFORMANCE-COMPARISON.md) §3–§4

**[VN & EN]** Hệ thống chữ viết đã được khóa thống nhất giữa mã nguồn, bộ token DTCG và tài liệu `DESIGN.md` đúng theo bản pilot v1 đã nghiệm thu:
1. **Giao diện & Nội dung chính (`--font-sans`):** **`Inter`** (`src/app/globals.css:386`, trọng lượng `400;500;600;700;800`), hỗ trợ đầy đủ dấu tiếng Việt chồng tầng (`ắ`, `ậ`, `ể`, `ỗ`, `ự`), đã kiểm tra hiển thị thực tế ở 375px / 768px / 1440px (`targeted/t02-*`, `targeted/t03-*`).
2. **Số liệu kỹ thuật & Mã (`--font-mono`):** **`JetBrains Mono`** (`src/app/globals.css:387`, trọng lượng `400;500;600`, `tabular-nums`) dùng cho số liệu tài chính, độ trễ, mã API key che một phần và thông số kỹ thuật.
3. **Ngoại lệ hiển thị có phạm vi hẹp (`.v3-core`):** **`Archivo`** chỉ được khai báo cục bộ cho `--font-display` bên trong lớp `.v3-core` (`src/styles/v3-core.css:28`), không bao giờ áp dụng làm font giao diện chung.
4. **Cơ chế tải font thực tế:** Tải qua thẻ `<link rel="stylesheet">` Google Fonts CSS2 kèm `preconnect` tại `src/app/layout.tsx:30-35` (`document.fonts.status === "loaded"`, CLS phòng thí nghiệm `0.0000`–`0.0005`).
5. **Đồng bộ tài liệu & Loại trừ triệt để:** `DESIGN.md:88-98` và `src/seed/design-tokens/zen-design-tokens.dtcg.json:128-132` đã khớp 100% với mã nguồn. **`Satoshi` và `Instrument Serif` hoàn toàn không được đưa vào bản phát hành này.**

---

## 7. Browser Screenshot Index (Danh Mục 40 Ảnh Chụp Trình Duyệt Thật)

Tất cả ảnh nằm tại `apps/sophia-ai-factory/docs/design/zen-design-os/evidence/` (manifest máy đo: [`g3-manifest.json`](./g3-manifest.json)), được chụp từ Google Chrome thật với `animations: 'disabled'` và đã kiểm tra trực quan từng tấm:

### 7.1 Ma trận chuẩn 36 tấm (`screenshots/` — 3 màn hình × 2 ngôn ngữ × 2 giao diện × 3 kích thước)

| Màn hình / Screen | Tiếng Việt — Dark (`vi__dark`) | Tiếng Việt — Light (`vi__light`) | English — Dark (`en__dark`) | English — Light (`en__light`) |
|:--|:--|:--|:--|:--|
| **Setup Wizard** (`/setup`) | `setup-wizard__vi__dark__375w.png`<br>`setup-wizard__vi__dark__768w.png`<br>`setup-wizard__vi__dark__1440w.png` | `setup-wizard__vi__light__375w.png`<br>`setup-wizard__vi__light__768w.png`<br>`setup-wizard__vi__light__1440w.png` | `setup-wizard__en__dark__375w.png`<br>`setup-wizard__en__dark__768w.png`<br>`setup-wizard__en__dark__1440w.png` | `setup-wizard__en__light__375w.png`<br>`setup-wizard__en__light__768w.png`<br>`setup-wizard__en__light__1440w.png` |
| **Dashboard** (`/dashboard`) | `dashboard__vi__dark__375w.png`<br>`dashboard__vi__dark__768w.png`<br>`dashboard__vi__dark__1440w.png` | `dashboard__vi__light__375w.png`<br>`dashboard__vi__light__768w.png`<br>`dashboard__vi__light__1440w.png` | `dashboard__en__dark__375w.png`<br>`dashboard__en__dark__768w.png`<br>`dashboard__en__dark__1440w.png` | `dashboard__en__light__375w.png`<br>`dashboard__en__light__768w.png`<br>`dashboard__en__light__1440w.png` |
| **Niche Studio** (`/dashboard/niche-studio`) | `niche-studio__vi__dark__375w.png`<br>`niche-studio__vi__dark__768w.png`<br>`niche-studio__vi__dark__1440w.png` | `niche-studio__vi__light__375w.png`<br>`niche-studio__vi__light__768w.png`<br>`niche-studio__vi__light__1440w.png` | `niche-studio__en__dark__375w.png`<br>`niche-studio__en__dark__768w.png`<br>`niche-studio__en__dark__1440w.png` | `niche-studio__en__light__375w.png`<br>`niche-studio__en__light__768w.png`<br>`niche-studio__en__light__1440w.png` |

### 7.2 Ảnh chụp trạng thái chuyên biệt (`targeted/` — 4 tấm)

| File | Trạng thái kiểm chứng / Verified State |
|:--|:--|
| `targeted/t01-mobile-nav-drawer-vi-dark-375w.png` | Ngăn kéo điều hướng di động mở ở màn hình 375px (Dark, Tiếng Việt). / Open mobile navigation drawer at 375px. |
| `targeted/t02-niche-studio-long-vi-text-dark-1440w.png` | Văn bản tiếng Việt dài có dấu phức tạp trên Niche Studio (Dark, 1440px) — tự xuống dòng gọn, không cắt chữ. / Long Vietnamese copy wrapping cleanly in Dark mode. |
| `targeted/t03-niche-studio-long-vi-text-light-1440w.png` | Văn bản tiếng Việt dài trên Niche Studio (Light, 1440px) — tương phản rõ trên nền Ivory. / Long Vietnamese copy wrapping cleanly in Light mode. |
| `targeted/t04-setup-wizard-step-state-vi.png` | Trạng thái giữa luồng nhập & xác thực API key trên Setup Wizard (Tiếng Việt). / Mid-flow Setup Wizard credential verification state. |

---

## 8. Gate 5 — Full Regression Status & Complete 164-File Diff Audit (Trạng Thái Hồi Quy & Kiểm Toán Toàn Bộ Diff)

### 8.1 Kết quả toàn bộ cổng chất lượng trên cây code `cd068bd39`

| Cổng kiểm tra / Quality Gate | Kết quả / Status | Số liệu đo thực tế / Measured Output |
|:--|--:|:--|
| `npm run type-check` | **PASS** | `0` lỗi TypeScript trên toàn bộ `src/`. |
| `npm run lint` | **PASS** | `0` lỗi ESLint (`247` cảnh báo cũ ngoài vùng thiết kế, thấp hơn trần CI `525`). |
| `bash scripts/check-layer-boundaries.sh` | **PASS** | `0` vi phạm kiến trúc 4 tầng (`seed → tree → forest → land`). |
| `npm run i18n:validate` | **PASS** | `0` khóa dịch thiếu giữa `messages/vi.json` và `messages/en.json`. |
| `npm run check:color-tokens` | **PASS** | `1045` mã màu cứng so với mốc `1080` (**giảm ròng `-35`**, `0` mã màu cứng mới). |
| `npm test` (Vitest toàn bộ repo) | **PASS** | **`2,096` file test PASS / `19,682` bài test PASS** (`1` file skip, `34` test skip, `10` todo; exit `0`). |
| `npm run build` (Next.js 16.4.2) | **PASS** | Build production thành công `636` routes; độ lệch bundle chỉ **+3.86 KB gzip JS (+0.16%)** và **+1.23 KB gzip CSS (+2.46%)**. |
| OpenNext Cloudflare Worker Build | **PASS** | `.open-next/worker.js` đóng gói **0 lỗi**, dung lượng nén **`9.46 MB` gzipped** (< ngưỡng cứng `10.00 MB`). |
| Luồng bảo vệ (Protected Flows) | **PASS** | **Setup Wizard** (xác minh trực tiếp trên trình duyệt + 12 test BYOK), **Telegram Bot** (`@Sophia_Bbot` không bị chạm sửa), **NOWPayments IPN** (luồng thanh toán không bị chạm sửa; không có Polar/PayPal). |
| Quét bí mật & Độ sạch Worktree | **PASS** | `0` API key thật, `0` file `.env` hay khóa riêng tư trong lịch sử diff; `git status --porcelain` sạch hoàn toàn sau commit đóng gói. |

### 8.2 Tổng hợp kiểm toán 164 file thay đổi so với `main` ([`ZEN-07.2-DIFF-CLASSIFICATION.md`](./ZEN-07.2-DIFF-CLASSIFICATION.md))

*(Lưu ý đo đạc: Lệnh #07.3 nhắc con số ước tính cũ "104 file", nhưng đo trực tiếp bằng `git diff --name-status 673ec911` trên nhánh sau khi bổ sung ảnh chụp trình duyệt, test bảo mật BYOK và test hộp thoại cho ra chính xác **164 file** = `81` file thêm mới + `83` file chỉnh sửa, gồm `15` file ở thư mục gốc monorepo và `149` file trong `apps/sophia-ai-factory/`. Cả 164/164 file đã được phân loại đầy đủ.)*

| Nhóm phân loại / Classification Category | File phi nhị phân / Non-PNG | Ảnh PNG / Screenshots | Tổng / Total |
|:--|--:|--:|--:|
| **Design implementation** (Token, Dual-Theme UI, Motion, `DESIGN.md`) | 55 | — | **55** |
| **Browser evidence** (JSON máy đo, Playwright specs, harness dev-only, PNGs) | 12 | 40 | **52** |
| **Documentation** (14 tài liệu kiến trúc ở gốc repo + 7 báo cáo `ZEN-07.2-*.md`) | 21 | — | **21** |
| **Functional regression correction** (Dialog focus, `/en/*` locale header, `messages/*.json`) | 19 | — | **19** |
| **Security correction** (BYOK D1 bucket + route probing caps + 12 security tests) | 17 | — | **17** |
| **Unexpected / out-of-scope change** (Thay đổi ngoài phạm vi / sửa nhầm nghiệp vụ) | **0** | **0** | **0** |
| **TỔNG CỘNG / GRAND TOTAL** | **124** | **40** | **164** |

---

## 9. Remaining Blockers & Transparent Follow-Ups (Điểm Chặn Còn Lại & Hạng Mục Theo Dõi Nhỏ)

### 9.1 Điểm chặn kỹ thuật đối với việc mở Draft PR / Technical Blockers for Draft PR
- **KHÔNG CÓ (`0` Blockers).** Mọi điều kiện nghiệm thu kỹ thuật của Lệnh #07.3 (Decisions 1–3, Gates 4–6) đều đã khép kín với bằng chứng đo thực tế.

### 9.2 Thao tác cấu hình tùy chọn phía Founder (Không chặn Draft PR / Non-Blocking Owner Governance)
- **Quy tắc Cloudflare Configuration Rule theo tên miền phụ (`sophia.agencyos.network`):** Hiện Rocket Loader đang tắt trên thực tế; Founder có thể chủ động bật quy tắc khóa `Rocket Loader = Off` riêng cho `sophia.agencyos.network` theo 6 bước ở **Mục 5** bất cứ lúc nào để phòng ngừa rủi ro về sau.

### 9.3 Sáu ghi nhận minh bạch không chặn phát hành (Non-Blocking Follow-Ups for Future Cleanup)
1. **Nhãn `sr-only` tiếng Việt cho `CmdKPalette` (`src/seed/components/ui/command.tsx:43`):** Đang đọc `"Quick actions"` ở cả VI và EN; có thể nối khóa `messages/vi.json:7328` (`"Thao tác nhanh"`) trong một PR dọn dẹp nhỏ riêng cho thành phần dùng chung.
2. **Route kiểm thử `/[locale]/zen-a11y-harness` (`src/app/[locale]/zen-a11y-harness/page.tsx:23`):** Trả về `404` ngay lập tức ở môi trường production nhờ chốt `if (process.env.NODE_ENV === 'production') notFound()`, nhưng vẫn xuất hiện dưới dạng route động (`ƒ`) trong bảng build của Next.js.
3. **Lắng nghe sự kiện đổi `prefers-reduced-motion` trực tiếp:** 4 motion primitives đọc cấu hình giảm chuyển động ngay khi tải trang (và CSS `@media (prefers-reduced-motion: reduce)` tắt chuyển động tức thì), nhưng state JS chưa đăng ký listener `change` nếu người dùng bật/tắt cài đặt hệ điều hành ngay giữa phiên mà không chuyển trang.
4. **Phạm vi kiểm thử trình đọc màn hình:** Đã xác minh cây trợ năng (accessibility tree), nhãn ARIA và điều hướng bàn phím trên trình duyệt thật, chưa bao gồm bản ghi âm đọc thực tế bằng phần mềm VoiceOver/NVDA.
5. **Mật khẩu giả lập cục bộ trong bài test E2E (`tests/e2e/zen07-2/zen-07-2-acceptance.spec.ts:75`):** Chỉ dùng cho tài khoản ảo `zen-07-2@sophia.test` trên SQLite local khi chạy Playwright, không liên quan đến bất kỳ hệ thống thật nào.
6. **Chuỗi tiếng Anh tồn đọng từ trước (`sop.install.cancel`):** Nằm ngoài 3 màn hình pilot của Zen Design OS, không sửa để giữ đúng kỷ luật không chạm ngoài phạm vi.

---

## 10. Proposed Draft PR Scope & Founder Sign-Off (Phạm Vi Draft PR Đề Xuất & Mục Ký Duyệt Của Founder)

### 10.1 Đề xuất cấu trúc Draft PR (CHỈ MỞ KHI FOUNDER CHO PHÉP PUSH)
- **Nhánh nguồn → Nhánh đích / Head → Base:** `design/sophia-zen-design-os-v1` → `main` (chế độ **Draft PR**).
- **Tiêu đề đề xuất / Proposed Title:** `feat(design): Zen Design OS v1.0 dual-theme pilot, strict nonce CSP & BYOK rate-limit hardening`
- **Phạm vi đưa vào Draft PR (164 file):**
  1. Hệ thống token giao diện kép **Dark (Director's Control Deck)** & **Light (Executive Studio Ivory)** trong `src/app/globals.css`, `zen-design-tokens.dtcg.json`, `ZenThemeProvider` (`data-cfasync="false"` + strict per-request CSP nonce) và 4 motion primitives tuân thủ `prefers-reduced-motion`.
  2. Áp dụng và sửa lỗi tương phản AA trên **3 màn hình Pilot** (`/setup`, `/dashboard`, `/dashboard/niche-studio`) ở cả Tiếng Việt & Tiếng Anh.
  3. Chuẩn hóa hệ chữ **Inter + JetBrains Mono** (Archivo giới hạn trong `.v3-core`) đồng bộ giữa `layout.tsx`, `globals.css`, DTCG JSON và `DESIGN.md`.
  4. Gia cố bảo mật **BYOK & Setup Wizard 2 tầng** (bucket D1 `byok` 40/phút + giới hạn chống dò key theo IP & User ở từng route + 12 bài test bảo mật).
  5. Trọn bộ **bằng chứng kiểm định độc lập** (`7` báo cáo `ZEN-07.2-*.md`, `8` file JSON/script máy đo, `40` ảnh chụp Chrome thật, và `2` bộ Playwright E2E specs).
- **Phạm vi loại trừ rõ ràng (Excluded from PR):** Không thêm thư viện hoạt ảnh mới (không GSAP / Lenis / React Bits), không đưa Satoshi hay Instrument Serif vào hệ thống, không thay đổi luồng Telegram Bot hay thanh toán NOWPayments, không thay đổi migration D1.

### 10.2 Bảng Ký Duyệt Dành Riêng Cho Founder (Để Trống Theo Quy Định — No Self-Signoff)

- [ ] **1. Duyệt Hình Ảnh & Giao Diện Kép (Visual & Dual-Theme Approval):** Founder đã xem và đồng ý với 36 ảnh chụp chuẩn + 4 ảnh chuyên biệt tại `apps/sophia-ai-factory/docs/design/zen-design-os/evidence/screenshots/` và `targeted/`.
- [ ] **2. Duyệt Chữ Viết & Trợ Năng Hộp Thoại (Typography & Dialog A11y Approval):** Founder xác nhận chuẩn font `Inter` + `JetBrains Mono` (`DESIGN.md`) và kết quả kiểm thử hộp thoại thật (`ZEN-07.2-WCAG-AND-MOTION-EVIDENCE.md` §2.1).
- [ ] **3. Duyệt Bảo Mật BYOK & Chính Sách Rocket Loader (Security & Edge Governance Approval):** Founder đồng ý với cơ chế giới hạn tốc độ BYOK 2 tầng (Mục 4) và hướng dẫn khóa Rocket Loader theo hostname `sophia.agencyos.network` (Mục 5).
- [ ] **4. Cấp Quyền Push Nhánh & Mở Draft PR (Authorization to Push & Open Draft PR):** Founder cho phép push nhánh `design/sophia-zen-design-os-v1` lên GitHub và tạo **Draft PR** vào `main` *(chưa merge / chưa deploy production cho tới khi có lệnh phát hành riêng)*.
