# Sophia AI Factory — First Real Customer Pilot (CUSTOMER-01) Release Candidate Handoff & Deployment Pack
# Gói Bàn Giao & Kế Hoạch Triển Khai Thử Nghiệm Khách Hàng Đầu Tiên (CUSTOMER-01)

> **Status / Trạng thái:** `PILOT_ACTIVE_CUSTOMER_PROVISIONED` (Pilot deployed on `sophia-ai-factory-pilot`, Cloudflare Access 1-click GitHub OAuth + One-time PIN active, Customer BYOK enabled)
> **Pilot Worker / Worker thử nghiệm:** `sophia-ai-factory-pilot` (`https://sophia-ai-factory-pilot.agencyos-openclaw.workers.dev`, `wrangler.pilot.toml`)
> **Pilot Scope / Phạm vi:** 1 invited external customer · exact email allowlist (operator allowlist + 1 invited customer email) · 1 pilot tenant · 7-day window · Free ($0 platform fee, payments & auto-publishing disabled) · `PILOT_FINANCING_MODE=CUSTOMER_BYOK` (customer enters & verifies own OpenRouter key in-app, AES-256-GCM encrypted, zero platform fallback)
> **Consent Version / Phiên bản điều khoản:** `2026-11-pilot-v2`
> **Support & Data Deletion / Hỗ trợ & Xóa dữ liệu:** In-app Support & Data Deletion card (`/vi/dashboard/first-value#support-deletion`, receipt `psr_<uuid>`, 72h SLA) + Founder queue CLI (`node scripts/pilot-support-queue.mjs list`)

---

## 1. Customer Onboarding Guide (EN + VI) / Hướng Dẫn Bắt Đầu Cho Khách Hàng

### 🇻🇳 Hướng dẫn từng bước (Dành cho khách hàng)

1. **🔗 Mở đường dẫn thử nghiệm riêng:** Nhấn vào liên kết thử nghiệm mà Founder gửi cho bạn (`https://sophia-ai-factory-pilot.agencyos-openclaw.workers.dev/vi/register?next=/vi/dashboard/first-value` — chỉ đúng email được mời mới có thể qua Cloudflare Access và danh sách cho phép).
2. **🔐 Xác thực 1 chạm & Tạo tài khoản:** Trên màn hình bảo mật Cloudflare Access, bấm **GitHub** để vào thẳng 1 chạm (nếu tài khoản GitHub dùng đúng email được mời) hoặc nhập đúng email được mời vào ô bên dưới để nhận mã PIN 6 số, sau đó đăng ký hoặc đăng nhập Sophia bằng đúng địa chỉ email đã được mời ($0 phí nền tảng, không cần thẻ thanh toán).
3. **📋 Đọc thông báo thử nghiệm & quyền riêng tư (`2026-11-pilot-v2`):** Ở đầu trang **Sophia Private Beta** (`/vi/dashboard/first-value`), đọc thông báo bản thử nghiệm miễn phí 7 ngày và nhấn **Đồng ý điều khoản & Tiếp tục**.
   - **Đơn vị kiểm soát dữ liệu:** Sophia AI Factory (vận hành bởi MekongMind).
   - **Mục đích:** Tạo, chỉnh sửa, lưu nháp và xuất kịch bản AI trong 7 ngày thử nghiệm; không tự động đăng công khai, không thu phí nền tảng.
   - **Khóa OpenRouter của bạn (Customer BYOK) & Nhà cung cấp AI:** Bạn nhập khóa OpenRouter cá nhân (`sk-or-v1-...`) ngay tại mục số 1; khóa được mã hóa AES-256-GCM và chỉ giải mã tạm thời để gửi brief tới OpenRouter (`openai/gpt-4o-mini`). Không nhập mật khẩu cá nhân, thẻ thanh toán hay dữ liệu nhạy cảm vào ô brief.
   - **Lưu trữ, Hỗ trợ & Xóa dữ liệu:** Lưu tối đa 7 ngày trong cơ sở dữ liệu thử nghiệm biệt lập (`sophia-pilot-db`). Bạn có thể xóa khóa BYOK bất cứ lúc nào hoặc gửi yêu cầu tại mục **Hỗ trợ & Xóa dữ liệu** ngay trong ứng dụng (`#support-deletion`) để nhận mã biên nhận `psr_...` (xử lý trong vòng 72 giờ).
4. **🔑 Kết nối khóa OpenRouter (BYOK):** Dán khóa API OpenRouter của bạn vào ô **1. Khóa API OpenRouter Của Bạn** và nhấn **Xác thực & Lưu khóa**.
5. **✍️ Nhập yêu cầu nội dung (Business Brief):** Điền Chủ đề, Đối tượng khách hàng và Thời lượng mong muốn (ví dụ 30 giây).
6. **✨ Tạo kịch bản AI thật:** Nhấn **Tạo kịch bản AI thật** (tối đa 20 lượt trong đợt thử nghiệm). Hệ thống tạo kịch bản gồm tối thiểu 3 phân cảnh (tên cảnh, hình ảnh, lời thoại).
7. **✏️ Xem, Chỉnh sửa & Lưu bản nháp:** Nhấn **Chỉnh sửa kịch bản** để điều chỉnh tiêu đề kịch bản, tên phân cảnh, mô tả hình ảnh hoặc lời thoại, rồi nhấn **Lưu bản nháp**.
8. **✅ Duyệt & Xuất nội dung:** Nhấn **Chấp nhận kịch bản**, sau đó chọn **Xuất Markdown riêng tư**, **Xuất JSON riêng tư**, **Sao chép nội dung** hoặc **Tải tệp xuống**.
9. **💬 Gửi góp ý, báo lỗi hoặc yêu cầu hỗ trợ/xóa dữ liệu:** Dùng khung **Góp ý & Báo lỗi thử nghiệm** hoặc khung **Yêu cầu Hỗ trợ & Xóa dữ liệu** ngay bên dưới trang.

### 🇬🇧 Step-by-step Guide (Customer)

1. **🔗 Open your private pilot link:** Use the invite-only link provided by the Founder (`https://sophia-ai-factory-pilot.agencyos-openclaw.workers.dev/en/register?next=/en/dashboard/first-value` — protected by Cloudflare Access + exact email allowlist).
2. **🔐 1-Click Authenticate & Register:** On the Cloudflare Access screen, click **GitHub** for 1-click sign-in (when your GitHub account uses your invited email) or enter your invited email below to receive a 6-digit One-time PIN code, then register or sign in to Sophia with your exact invited email ($0 platform fee, no payment card needed).
3. **📋 Review Beta & Privacy Notice (`2026-11-pilot-v2`):** At the top of `/en/dashboard/first-value`, read the 7-day private beta privacy notice and click **Accept Pilot Terms & Continue**.
   - **Data Controller:** Sophia AI Factory (operated by MekongMind).
   - **Purpose:** Generate, edit, save, and export AI video scripts during your 7-day private evaluation. No auto-publishing, no Sophia billing.
   - **Customer BYOK & AI Provider Transfer:** Enter your own OpenRouter API key (`sk-or-v1-...`) in Card 1 (stored encrypted with AES-256-GCM). Your brief is transmitted to OpenRouter (`openai/gpt-4o-mini`) solely to generate your script. Never enter passwords, payment data, or sensitive personal data.
   - **Retention, Support & Deletion:** Stored in an isolated pilot database (`sophia-pilot-db`) for 7 days. Remove your BYOK key anytime or submit a Support / Data Deletion request directly in the in-app **Support & Data Deletion** panel (`#support-deletion`) to receive a verifiable `psr_...` receipt ID (completed within 72 hours).
4. **🔑 Connect Your OpenRouter Key (BYOK):** Paste your OpenRouter key in **1. Your OpenRouter API Key (Customer BYOK)** and click **Verify & Save Key**.
5. **✍️ Enter a Business Brief:** Fill in Topic, Target Audience, and Duration (e.g., 30 seconds).
6. **✨ Generate Your First Real AI Script:** Click **Generate Live AI Script** (up to 20 generations in this pilot) to produce a validated script with at least 3 scenes (scene name, visuals, narration).
7. **✏️ Review, Edit & Save Draft:** Click **Edit Script** to refine the script title, scene names, visual notes, or narration, then click **Save Draft**.
8. **✅ Approve & Export:** Click **Explicitly Accept Script**, then choose **Export Private Markdown**, **Export Private JSON**, **Copy Export**, or **Download File**.
9. **💬 Share Feedback or Request Support / Deletion:** Use the **Pilot Feedback & Issue Report** card or the **Support & Data Deletion Request** card on the same page.

---

## 2. Sample Business Brief / Mẫu Yêu Cầu Nội Dung

| Field / Trường | English Example | Ví dụ Tiếng Việt |
|---|---|---|
| **Topic / Chủ đề** | Why busy clinic owners miss 40% of patient follow-ups and how a 60-second reminder workflow fixes it | Vì sao chủ phòng khám bận rộn bỏ lỡ 40% lịch tái khám và cách quy trình nhắc hẹn 60 giây khắc phục |
| **Audience / Đối tượng** | Independent dental & dermatology clinic owners | Chủ phòng khám nha khoa & da liễu tư nhân |
| **Duration / Thời lượng** | `30` seconds | `30` giây |

---

## 3. Privacy, Data Lifecycle & Vietnamese Legal Disclosure (G7)

- **Data Controller / Owner:** Sophia AI Factory (operated by MekongMind — in-app Support & Data Deletion queue at `/[locale]/dashboard/first-value#support-deletion`, operator CLI `node scripts/pilot-support-queue.mjs`).
- **Consent Version:** `2026-11-pilot-v2` (explicit opt-in required prior to first generation; no pre-checked boxes).
- **Data Collected (Minimized):** Invited email, workspace/org membership, submitted brief, generated/edited script, consent timestamp & policy version, minimal scoped telemetry events (`INVITE_ACCEPTED`, `FIRST_LOGIN`, `BYOK_KEY_SAVED`, `BYOK_KEY_CLEARED`, `BRIEF_SUBMITTED`, `GENERATION_REQUESTED`, `GENERATION_SUCCEEDED`, `GENERATION_FAILED`, `SCRIPT_REVIEWED`, `SCRIPT_EDITED`, `SCRIPT_EXPORTED`, `CUSTOMER_FEEDBACK_SUBMITTED`, `SUPPORT_REQUEST_SUBMITTED`, `DATA_DELETION_REQUESTED`), feedback text, and in-app support/deletion requests (`pilot_support_requests`).
- **Data NOT Logged / NOT Stored in Plaintext:** No prompts, full script contents, or API keys are logged by default. Customer OpenRouter BYOK keys are encrypted at rest with AES-256-GCM (`BYOK_MASTER_KEY` + `key_versions`) and never echoed in responses or telemetry. Zero payment or social OAuth credentials (PayOS, NOWPayments, B2 publishing, and all non-pilot `/api/*` routes are hard-blocked at middleware with `403`).
- **Cross-Border Transfer Disclosure:** Submitted briefs are transmitted to OpenRouter (`https://openrouter.ai/api/v1/chat/completions`) and upstream model provider (`openai/gpt-4o-mini`) solely for script generation.
- **Applicable Vietnamese Privacy Framework (Founder Legal Check Required — No Fabricated Compliance):**
  - **Law on Personal Data Protection No. 91/2025/QH15** and implementing **Decree No. 356/2025/ND-CP** took effect **January 1, 2026** (superseding Decree 13/2023/ND-CP).
  - **Article 6 (Consent):** Verifiable, explicit, non-default consent is enforced via `accept_pilot_terms` (`2026-11-pilot-v2`) before any generation.
  - **Articles 17–18 (Cross-Border Data Transfer):** If the invited customer is a Vietnamese resident/data subject whose personal data is transferred outside Vietnam (e.g., to Cloudflare / OpenRouter), Founder legal review must verify whether a Transfer Impact Assessment (Form 09) must be prepared and filed within 60 days of transfer initiation, or whether an exemption applies.
- **Retention, Deletion & Pilot Termination:**
  - Data lives exclusively in isolated non-production D1 (`sophia-pilot-db`) for 7 calendar days.
  - Customer may request support or full data deletion anytime via the in-app Support & Data Deletion panel (`psr_<uuid>` receipt, SLA: within 72 hours, processed via `node scripts/pilot-support-queue.mjs`).
  - At pilot end (day 7 or earlier exit): export anonymized qualitative learnings only with customer consent, then delete customer rows or destroy `sophia-pilot-db`, `sophia-pilot-tag-cache`, `sophia-pilot-opennext-cache`, and the pilot Worker.

---

## 4. Real Pilot Deployment Runbook (G10 — Isolated `sophia-ai-factory-pilot`)

> **CRITICAL:** Never run generic `npm run deploy` or `wrangler deploy` without `--config wrangler.pilot.toml`. Production (`sophia-ai-factory`, `sophia-raas-db`) must remain untouched.

### 1. Approved Source Branch & SHA Verification
- Verify exact HEAD SHA matches `/api/version` on `https://sophia-ai-factory-pilot.agencyos-openclaw.workers.dev` after deployment, and verify production (`https://sophia.agencyos.network/api/version`) remains unchanged.

### 2. Isolated Worker Identity & Access Perimeter
- Worker name: `sophia-ai-factory-pilot` (`workers_dev = true`, `preview_urls = false`).
- Pilot URL: `https://sophia-ai-factory-pilot.agencyos-openclaw.workers.dev` (protected by Cloudflare Access App `11a89148-d86e-4d3e-a1d4-e12edbeb6f75`, Policy `5ad49a50-b19a-4cc9-a43d-d2455e92fa42`).

### 3. Isolated Pilot D1 & R2 Bindings
- `DB` -> `sophia-pilot-db` (`d50fc9d9-dc3b-4fcd-bd3a-9efbf7524ed6`)
- `NEXT_TAG_CACHE_D1` -> `sophia-pilot-tag-cache` (`cf2812c4-1156-4b7c-b7f3-b5611a6e40c1`)
- `NEXT_INC_CACHE_R2_BUCKET` -> `sophia-pilot-opennext-cache`

### 4. Exact Wrangler Config & Automated Isolation Check
```bash
cd apps/sophia-ai-factory
npm run pilot:check-isolation -- --require-resolved-ids
```

### 5. Required Migrations in Exact Order (`sophia-pilot-db` Only)
Apply to `sophia-pilot-db` (`--remote --config wrangler.pilot.toml` — NEVER `sophia-raas-db`):
1. `migrations/0001-init.sql`
2. `migrations/0003-better-auth.sql`
3. `migrations/0004-user-profiles.sql`
4. `migrations/0011-user-api-keys.sql`
5. `migrations/0013-rate-limits.sql`
6. `migrations/0076-rename-api-keys-to-user-api-keys.sql`
7. `migrations/0088-org-members-drop-user-id-fk.sql`
8. `migrations/0114-user-failed-logins.sql`
9. `key_versions` table & `user_api_keys` BYOK metadata columns (`key_version`, `key_validated_at`, `capability_mask`, `monthly_budget_usd`, `cooldown_until`, `last_receipt_json` from `migrations/0184_key_versions.sql` & `migrations/0499_byok_key_policy_and_publish_ledger.sql`)
10. `migrations/0483_better_auth_two_factor_user_column.sql`
11. `migrations/0484_better_auth_passkey_and_two_factor_tables.sql`
12. `migrations/0485_better_auth_account_token_columns.sql`
13. `migrations/0515_first_value_reviews.sql`
14. `migrations/0517_customer_pilot_first_value.sql`
15. `migrations/0519_pilot_support_requests.sql`

Apply to `sophia-pilot-tag-cache` (`--remote --config wrangler.pilot.toml`):
1. `migrations/0108-opennext-tag-cache.sql`

### 6. Better Auth Pilot Origin & Callback Configuration
- `APP_URL`, `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL`, and `WORKER_TECHNICAL_URL` are pinned to `https://sophia-ai-factory-pilot.agencyos-openclaw.workers.dev` with `ALLOWED_HOSTS = "sophia-ai-factory-pilot.agencyos-openclaw.workers.dev"`.
- Zero production OAuth callback URLs (`sophia.agencyos.network`) are bound to the pilot Worker.

### 7. Required Secrets (By Name Only — Never Commit Values)
Set via `wrangler secret put <NAME> --config wrangler.pilot.toml`:
- `BETTER_AUTH_SECRET` (32+ byte random secret, distinct from production)
- `BYOK_MASTER_KEY` (base64 32-byte key for AES-256-GCM customer BYOK encryption, distinct from production)
- `CSRF_SECRET` & `FIRST_VALUE_RECEIPT_SECRET` (distinct pilot HMAC secrets)
- `PILOT_ALLOWED_EMAILS` (operator allowlist + exact single invited customer email, managed via `node scripts/pilot-invite-customer.mjs "<email>"`)

### 8. Exact Email Allowlist & Page Scope Confinement
- Exact allowlisted emails only in `PILOT_ALLOWED_EMAILS` (operator allowlist + single invited customer email; zero domain wildcards, fails closed when empty).
- Middleware confines pilot APIs to `['/api/auth', '/api/first-value', '/api/health', '/api/version', '/api/check-access', '/api/csp-report']` and confines pilot UI pages to `/login`, `/register`, `/signup`, `/reset-password`, `/privacy`, `/terms`, and `/dashboard/first-value`.

### 9. Cloudflare Access Policy & 1-Click GitHub SSO (Worker-Level Zero Trust)
- Cloudflare Access App `11a89148-d86e-4d3e-a1d4-e12edbeb6f75` (`mekongmind.cloudflareaccess.com`) binds `allowed_idps` to 1-click **GitHub OAuth** (`6d34ddc8-ac66-4489-ac4e-4e8dc784aacd`) alongside **One-time PIN** (`374e269a-15c4-4228-bce1-abccacce9110`) fallback.
- Policy `5ad49a50-b19a-4cc9-a43d-d2455e92fa42` enforces `decision = "allow"` with exact `email` include rules for the operator emails and the single invited customer email.
- Zero wildcard domains, `everyone`, or `bypass` rules permitted (verified automatically by `scripts/pilot-invite-customer.mjs`).

### 10. Financing Mode & Platform Spend Guarantee (`$0` Platform Spend)
- `PILOT_FINANCING_MODE = "CUSTOMER_BYOK"` and `BYOK_ENABLED = "1"`.
- The invited customer enters and live-verifies their own OpenRouter key (`sk-or-...`) inside Card 1 of `/vi/dashboard/first-value`.
- Zero platform OpenRouter key is provisioned or charged; automatic fallback to Founder/platform keys is strictly disabled (`422 BYOK_KEY_REQUIRED` if unconfigured).

### 11. Local Quota, Token & Spend Guardrails
- `PILOT_LIVE_INFERENCE_ENABLED = "true"`.
- `PILOT_MAX_GENERATIONS = "20"` (atomic D1 counter in `pilot_usage_quotas`).
- `PILOT_MAX_ESTIMATED_SPEND_USD = "4.00"` and `PILOT_ESTIMATED_COST_PER_ATTEMPT_USD = "0.02"` (atomic D1 micro-USD ceiling).
- `PILOT_MODEL_ID = "openai/gpt-4o-mini"`, `PILOT_MAX_OUTPUT_TOKENS = "2048"`, `PILOT_MAX_RETRIES = "1"`, `PILOT_TIMEOUT_MS = "45000"`, `PILOT_RATE_LIMIT_COOLDOWN_MS = "5000"`.
- Atomic D1 in-flight lock (`in_flight_until_ms`) prevents concurrent parallel calls.

### 12. Pilot Build & Isolated Deployment
```bash
cd apps/sophia-ai-factory
npm run pilot:check-isolation -- --require-resolved-ids
npm run pilot:build
OPEN_NEXT_DEPLOY=true CLOUDFLARE_API_TOKEN= npx wrangler deploy --config wrangler.pilot.toml
```

### 13. Three-Layer Security & Journey Verification
- **Layer 1 — Edge Access perimeter:** Unauthenticated requests to `https://sophia-ai-factory-pilot.agencyos-openclaw.workers.dev` receive HTTP `302` redirect to Cloudflare Access (1-click GitHub OAuth + One-time PIN fallback).
- **Layer 2 — Application allowlist:** Any identity not matching `PILOT_ALLOWED_EMAILS` receives `403 PILOT_INVITE_REQUIRED` / `403 PILOT_ACCESS_REVOKED`.
- **Layer 3 — Tenant & feature isolation:** Cross-tenant `orgId` requests, `/api/checkout`, `/api/publish`, and non-pilot routes return `403`; out-of-scope UI routes `307`-redirect to `/vi/dashboard/first-value`.
- **Customer Journey E2E:** Register/Login -> Consent (`2026-11-pilot-v2`) -> Save & Verify OpenRouter BYOK key -> Enter brief -> Generate >= 3 scenes -> Edit scene title & content -> Save draft -> Accept & Export Markdown/JSON/Copy/Download -> Submit feedback -> Submit Support / Data Deletion (`psr_...` receipt).

### 17. Customer Invite Command & Onboarding Link
- Provision the single invited customer email across Cloudflare Access AND `PILOT_ALLOWED_EMAILS` with verified readback:
```bash
node scripts/pilot-invite-customer.mjs "<invited-customer-email>"
```
- Send private link (`https://sophia-ai-factory-pilot.agencyos-openclaw.workers.dev/vi/register?next=/vi/dashboard/first-value`) + Section 1 onboarding guide directly to the invited customer. Support & deletion requests are submitted directly in-app (`#support-deletion`) and monitored via `node scripts/pilot-support-queue.mjs list`. Do NOT post publicly.

### 18. Access Revocation & Kill-Switch Procedure (Honest Propagation Reality)
1. **Stop live inference:** Set `PILOT_LIVE_INFERENCE_ENABLED = "false"` in `wrangler.pilot.toml` and redeploy (~30–60s) OR immediately disable/delete the dedicated OpenRouter key in the OpenRouter dashboard (effective immediately at provider).
2. **Revoke customer access (propagation reality):**
   - **Cloudflare Access:** Remove email from Access policy & revoke active Access sessions in Zero Trust dashboard (propagates in seconds at edge).
   - **Application allowlist:** `wrangler secret put PILOT_ALLOWED_EMAILS --config wrangler.pilot.toml` (reset to operator-only emails `billwill.mentor@gmail.com,minhlong.rice@gmail.com` or empty to pause all access — triggers new Worker version deployment, propagates in ~10–30s).
   - **Session cookie cache:** Better Auth caches validated sessions in a signed cookie for up to 5 minutes (`cookieCache.maxAge = 300`); however, `/api/first-value` checks `PILOT_ALLOWED_EMAILS` on **every request** regardless of cookie cache, and Cloudflare Access blocks at the edge before the Worker runs. For complete session invalidation in D1, delete rows from `session` in `sophia-pilot-db`.

### 19. Customer Feedback & Incident Monitoring
- Review `pilot_events` and `pilot_feedback` tables in `sophia-pilot-db` daily via read-only `wrangler d1 execute sophia-pilot-db --remote --command "..."`.
- Monitor OpenRouter key `usage` / `limit_remaining` via `GET /api/v1/key`.
- P0 incident (cross-tenant access, leaked secret, runaway spend): disable OpenRouter key + revoke Cloudflare Access within 5 minutes.

### 20. End-of-Pilot Data Retention & Deletion Actions
- At Day 7 (or earlier upon customer request):
  1. Export anonymized qualitative feedback (only with customer permission).
  2. Delete customer rows from `sophia-pilot-db` or destroy pilot resources:
     - `wrangler delete sophia-ai-factory-pilot --config wrangler.pilot.toml`
     - `wrangler d1 delete sophia-pilot-db`
     - `wrangler d1 delete sophia-pilot-tag-cache`
     - `wrangler r2 bucket delete sophia-pilot-opennext-cache`
  3. Revoke the dedicated OpenRouter pilot key and remove the Cloudflare Access application.
  4. Send deletion confirmation to the customer.

---

## 5. Actual Usage & Cost Evidence Template (Fill ONLY After Real Customer Use)

```yaml
pilot_id: CUSTOMER-01
deployed_sha: "<exact-sha>"
pilot_window_start_iso: "<YYYY-MM-DDTHH:MM:SSZ>"
pilot_window_end_iso: "<YYYY-MM-DDTHH:MM:SSZ>"
financing_mode: "CUSTOMER_BYOK"
platform_provider_spend_usd: 0.00
internal_spend_cutoff_usd: 4.00
events_observed:
  INVITE_ACCEPTED: 0
  FIRST_LOGIN: 0
  BYOK_KEY_SAVED: 0
  BYOK_KEY_CLEARED: 0
  BRIEF_SUBMITTED: 0
  GENERATION_REQUESTED: 0
  GENERATION_SUCCEEDED: 0
  GENERATION_FAILED: 0
  SCRIPT_REVIEWED: 0
  SCRIPT_EDITED: 0
  SCRIPT_EXPORTED: 0
  CUSTOMER_FEEDBACK_SUBMITTED: 0
  SUPPORT_REQUEST_SUBMITTED: 0
  DATA_DELETION_REQUESTED: 0
time_to_first_useful_draft_minutes: null
scripts_saved_or_exported: 0
voluntary_return_sessions: 0
actual_provider_spend_usd: 0.00
security_incidents_p0: 0
cross_tenant_incidents: 0
qualitative_feedback_verbatim: []
```
