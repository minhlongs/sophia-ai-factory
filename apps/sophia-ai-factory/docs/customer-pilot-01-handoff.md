# Sophia AI Factory — First Real Customer Pilot (CUSTOMER-01) Release Candidate Handoff & Deployment Pack
# Gói Bàn Giao & Kế Hoạch Triển Khai Thử Nghiệm Khách Hàng Đầu Tiên (CUSTOMER-01)

> **Status / Trạng thái:** `PENDING_FOUNDER_APPROVAL` (NO deploy, NO remote resource creation, NO live spend, NO invite sent)
> **Pilot Worker / Worker thử nghiệm:** `sophia-ai-factory-pilot` (isolated Cloudflare Worker, `wrangler.pilot.toml`)
> **Pilot Scope / Phạm vi:** 1 invited external customer · 1 allowlisted email · 1 pilot tenant · 7-day proposed window · Free ($0, payments & auto-publishing disabled) · `PILOT_FINANCING_MODE=FOUNDER_SPONSORED` (BYOK disabled, zero silent fallback)
> **Consent Version / Phiên bản điều khoản:** `2026-11-pilot-v2`
> **Real Provider E2E:** `REAL_PROVIDER_E2E=NOT_EXECUTED` (no paid calls executed prior to Founder financial GO)

---

## 1. Customer Onboarding Guide (EN + VI) / Hướng Dẫn Bắt Đầu Cho Khách Hàng

### 🇻🇳 Hướng dẫn từng bước (Dành cho khách hàng)

1. **🔗 Mở đường dẫn thử nghiệm riêng:** Nhấn vào liên kết thử nghiệm mà Founder gửi cho bạn (chỉ email được mời mới có thể truy cập qua Cloudflare Access và danh sách cho phép).
2. **🔐 Đăng nhập / Tạo tài khoản:** Đăng nhập bằng đúng địa chỉ email đã được mời. Bạn không cần dùng công cụ kỹ thuật, không cần nhập khóa API và không cần thẻ thanh toán.
3. **📋 Đọc thông báo thử nghiệm & quyền riêng tư (`2026-11-pilot-v2`):** Ở đầu trang **First Value** (`/vi/first-value`), đọc thông báo bản thử nghiệm miễn phí 7 ngày và nhấn **Đồng ý điều khoản & Tiếp tục**.
   - **Đơn vị kiểm soát dữ liệu:** Sophia AI Factory (Founder).
   - **Mục đích:** Tạo, chỉnh sửa và xuất kịch bản AI mẫu trong 7 ngày thử nghiệm; không tự động đăng công khai, không thu phí.
   - **Chuyển dữ liệu sang nhà cung cấp AI:** Yêu cầu nội dung (brief) được gửi tới OpenRouter (và nhà cung cấp mô hình `openai/gpt-4o-mini`) chỉ để tạo kịch bản. Không nhập mật khẩu, thông tin thẻ thanh toán hay bí mật nhạy cảm.
   - **Lưu trữ & Xóa dữ liệu:** Lưu tối đa 7 ngày trong cơ sở dữ liệu thử nghiệm tách biệt (`sophia-pilot-db`). Gửi yêu cầu xóa bất cứ lúc nào qua `support@agencyos.network` (xử lý trong vòng 72 giờ).
4. **✍️ Nhập yêu cầu nội dung (Business Brief):** Điền Chủ đề, Đối tượng khách hàng và Thời lượng mong muốn (ví dụ 30 giây).
5. **✨ Tạo kịch bản AI thật:** Nhấn nút tạo kịch bản (tối đa 20 lượt trong đợt thử nghiệm). Hệ thống tạo kịch bản gồm tối thiểu 3 phân cảnh (hình ảnh + lời thoại).
6. **✏️ Xem & Chỉnh sửa:** Nhấn **Chỉnh sửa kịch bản** để điều chỉnh tiêu đề, mô tả hình ảnh hoặc lời thoại theo giọng điệu doanh nghiệp của bạn, rồi nhấn **Lưu chỉnh sửa**.
7. **✅ Duyệt & Xuất bản nháp:** Nhấn **Chấp nhận** để chốt bản nháp, sau đó chọn **Xuất Markdown** hoặc **Xuất JSON**, hoặc nhấn **Sao chép bản xuất** để dán vào tài liệu của bạn.
8. **💬 Gửi góp ý hoặc báo lỗi:** Dùng khung **Góp ý & Báo lỗi thử nghiệm** ngay bên dưới để đánh giá mức độ hữu ích, phần khó chỉnh sửa hoặc báo lỗi gặp phải.

### 🇬🇧 Step-by-step Guide (Customer)

1. **🔗 Open your private pilot link:** Use the invite-only link provided by the Founder after launch approval (protected by Cloudflare Access + exact single-email allowlist).
2. **🔐 Sign in / Register:** Authenticate with your exact invited email address. No CLI, API keys, or billing setup is required.
3. **📋 Review Beta & Privacy Notice (`2026-11-pilot-v2`):** At the top of `/en/first-value`, read the 7-day private beta privacy notice and click **Accept Pilot Terms & Continue**.
   - **Data Controller:** Sophia AI Factory (Founder).
   - **Purpose:** Generate, edit, and export AI video scripts during your 7-day private evaluation. No auto-publishing, no billing.
   - **AI Provider Transfer:** Your brief is transmitted to OpenRouter (routing to `openai/gpt-4o-mini`) solely to generate your script. Never enter passwords, payment data, or confidential secrets.
   - **Retention & Deletion:** Stored in an isolated pilot database (`sophia-pilot-db`) for 7 days. Request immediate deletion anytime via `support@agencyos.network` (completed within 72 hours).
4. **✍️ Enter a Business Brief:** Fill in Topic, Target Audience, and Duration (e.g., 30 seconds).
5. **✨ Generate Your First Real AI Script:** Click Generate (up to 20 attempts in this pilot) to produce a validated script with at least 3 scenes (visuals + narration).
6. **✏️ Review & Edit:** Click **Edit Script** to refine the title, visual notes, or narration, then click **Save Changes**.
7. **✅ Approve & Export:** Click **Accept**, then choose **Export Markdown**, **Export JSON**, or **Copy Export**.
8. **💬 Share Feedback or Report Issues:** Use the **Pilot Feedback & Issue Report** card on the same page to rate usefulness, note editing friction, or report any error.

---

## 2. Sample Business Brief / Mẫu Yêu Cầu Nội Dung

| Field / Trường | English Example | Ví dụ Tiếng Việt |
|---|---|---|
| **Topic / Chủ đề** | Why busy clinic owners miss 40% of patient follow-ups and how a 60-second reminder workflow fixes it | Vì sao chủ phòng khám bận rộn bỏ lỡ 40% lịch tái khám và cách quy trình nhắc hẹn 60 giây khắc phục |
| **Audience / Đối tượng** | Independent dental & dermatology clinic owners | Chủ phòng khám nha khoa & da liễu tư nhân |
| **Duration / Thời lượng** | `30` seconds | `30` giây |

---

## 3. Privacy, Data Lifecycle & Vietnamese Legal Disclosure (G7)

- **Data Controller / Owner:** Sophia AI Factory (Founder — `support@agencyos.network`).
- **Consent Version:** `2026-11-pilot-v2` (explicit opt-in required prior to first generation; no pre-checked boxes).
- **Data Collected (Minimized):** Invited email, workspace/org membership, submitted brief, generated/edited script, consent timestamp & policy version, minimal scoped telemetry events (`INVITE_ACCEPTED`, `FIRST_LOGIN`, `BRIEF_SUBMITTED`, `GENERATION_REQUESTED`, `GENERATION_SUCCEEDED`, `GENERATION_FAILED`, `SCRIPT_REVIEWED`, `SCRIPT_EDITED`, `SCRIPT_EXPORTED`, `CUSTOMER_FEEDBACK_SUBMITTED`), and feedback text.
- **Data NOT Logged / NOT Stored in Plaintext:** No prompts, full script contents, or API keys are logged by default. Server-side `PILOT_OPENROUTER_API_KEY` is never exposed to client bundles, responses, or telemetry. Zero payment or social OAuth credentials (PayOS, NOWPayments, B2 publishing, and all non-pilot `/api/*` routes are hard-blocked at middleware with `403`).
- **Cross-Border Transfer Disclosure:** Submitted briefs are transmitted to OpenRouter (`https://openrouter.ai/api/v1/chat/completions`) and upstream model provider (`openai/gpt-4o-mini`) solely for script generation.
- **Applicable Vietnamese Privacy Framework (Founder Legal Check Required — No Fabricated Compliance):**
  - **Law on Personal Data Protection No. 91/2025/QH15** and implementing **Decree No. 356/2025/ND-CP** took effect **January 1, 2026** (superseding Decree 13/2023/ND-CP).
  - **Article 6 (Consent):** Verifiable, explicit, non-default consent is enforced via `accept_pilot_terms` (`2026-11-pilot-v2`) before any generation.
  - **Articles 17–18 (Cross-Border Data Transfer):** If the invited customer is a Vietnamese resident/data subject whose personal data is transferred outside Vietnam (e.g., to Cloudflare / OpenRouter), Founder legal review must verify whether a Transfer Impact Assessment (Form 09) must be prepared and filed within 60 days of transfer initiation, or whether an exemption applies.
- **Retention, Deletion & Pilot Termination:**
  - Data lives exclusively in isolated non-production D1 (`sophia-pilot-db`) for 7 calendar days.
  - Customer may request deletion anytime via `support@agencyos.network` (SLA: within 72 hours).
  - At pilot end (day 7 or earlier exit): export anonymized qualitative learnings only with customer consent, then delete customer rows or destroy `sophia-pilot-db`, `sophia-pilot-tag-cache`, `sophia-pilot-opennext-cache`, and the pilot Worker.

---

## 4. Real Pilot Deployment Pack (G10 — 20-Point Operator Plan, NOT Executed)

> **CRITICAL:** Do NOT execute any command below without explicit Founder GO. Never run generic `npm run deploy` or `wrangler deploy` without `--config wrangler.pilot.toml`.

### 1. Approved Exact Source SHA Candidate
- Branch: `feat/customer-01-first-real-pilot` (Draft PR #200).
- Verify exact HEAD SHA matches the CI-verified commit in the Founder Handoff before merge/deploy.

### 2. Isolated Worker Identity
- Worker name: `sophia-ai-factory-pilot` (`workers_dev = false`, `preview_urls = false`).
- Dedicated custom hostname: e.g. `pilot.sophia.agencyos.network` (must NOT be `sophia.agencyos.network`).

### 3. Pilot D1 & R2 Resource Creation Plan (Fresh Non-Production Only)
```bash
# Run ONLY after Founder GO:
wrangler d1 create sophia-pilot-db
wrangler d1 create sophia-pilot-tag-cache
wrangler r2 bucket create sophia-pilot-opennext-cache
```
- Note: `open-next.config.ts` uses `d1NextTagCache`, so `sophia-pilot-tag-cache` is a D1 database (`NEXT_TAG_CACHE_D1`) and `sophia-pilot-opennext-cache` is an R2 bucket (`NEXT_INC_CACHE_R2_BUCKET`).

### 4. Exact Wrangler Config & Automated Isolation Check
- Replace `REPLACE_WITH_ISOLATED_PILOT_D1_DATABASE_ID`, `REPLACE_WITH_ISOLATED_PILOT_TAG_CACHE_D1_ID`, and `REPLACE_WITH_PILOT_HOSTNAME` in `apps/sophia-ai-factory/wrangler.pilot.toml`.
- Verify zero production IDs/hostnames/buckets/crons/queues exist:
```bash
cd apps/sophia-ai-factory
npm run pilot:check-isolation -- --require-resolved-ids
```

### 5. Required Migrations in Exact Order (Fresh Pilot D1 Only)
Apply to `sophia-pilot-db` (`--remote`, `--config wrangler.pilot.toml` — NEVER `sophia-raas-db`):
1. `migrations/0001-init.sql`
2. `migrations/0003-better-auth.sql`
3. `migrations/0004-user-profiles.sql`
4. `migrations/0011-user-api-keys.sql`
5. `migrations/0076-rename-api-keys-to-user-api-keys.sql`
6. `migrations/0088-org-members-drop-user-id-fk.sql`
7. `migrations/0483_better_auth_two_factor_user_column.sql`
8. `migrations/0515_first_value_reviews.sql`
9. `migrations/0517_customer_pilot_first_value.sql`

> Note: Do NOT apply `0480_auth_2027_clean_slate.sql` on a fresh pilot D1 — it rebuilds legacy `campaigns`/`raas_licenses` tables not present in the minimal pilot schema and duplicates `0483`'s `twoFactorEnabled` column. Verified via disposable local D1 dry run with `PRAGMA foreign_keys = ON`.

Apply to `sophia-pilot-tag-cache` (`--remote`, `--config wrangler.pilot.toml`):
1. `migrations/0108-opennext-tag-cache.sql`

### 6. Better Auth Pilot Origin & Callback Configuration
- Set `APP_URL`, `BETTER_AUTH_URL`, and `NEXT_PUBLIC_APP_URL` in `wrangler.pilot.toml` to `https://<pilot-hostname>`.
- Ensure no production OAuth callback URLs (`sophia.agencyos.network`) are bound to the pilot Worker.
- Pilot sign-in uses email/password on the pilot origin (no third-party social OAuth required).

### 7. Required Secrets (By Name Only — Never Commit Values)
Set via `wrangler secret put <NAME> --config wrangler.pilot.toml`:
- `BETTER_AUTH_SECRET` (fresh 32+ byte random secret, distinct from production)
- `BYOK_MASTER_KEY` (fresh base64 32-byte key, distinct from production)
- `PILOT_ALLOWED_EMAILS` (exact single invited customer email, lowercase)
- `PILOT_OPENROUTER_API_KEY` (dedicated pilot-only OpenRouter key, loaded ONLY in Phase 2 after financial GO)

### 8. One-Customer Email Allowlist Setup
- Single exact email in `PILOT_ALLOWED_EMAILS` (no domain wildcards, no comma-separated extras).
- `PILOT_INVITE_ONLY = "true"` fails closed if `PILOT_ALLOWED_EMAILS` is empty.
- Middleware also hard-blocks all non-pilot `/api/*` routes outside `['/api/auth', '/api/first-value', '/api/health', '/api/version', '/api/check-access', '/api/csp-report']`.

### 9. Cloudflare Access Policy (Worker-Level Zero Trust)
- Create a Cloudflare Access Self-Hosted Application for `https://<pilot-hostname>/*`.
- Policy: **Allow** -> **Include: Emails** -> exact single invited customer email (+ Founder operator email during smoke test, removed before handoff if desired).
- Do **NOT** allow an entire email domain (`@domain.com`).
- Verify Access does not strip Better Auth session cookies or CSRF headers on `/api/auth/*` and `/api/first-value` during Phase 1 smoke test.

### 10. Provider Key Credit-Limit Evidence Requirement (Proposed `$5.00`)
- Create a dedicated OpenRouter API key strictly for `CUSTOMER-01` with a configured hard credit limit (proposed: `$5.00 USD`, no auto-top-up).
- Before Phase 2 activation, capture non-secret verification evidence via:
```bash
curl -sS -H "Authorization: Bearer $PILOT_OPENROUTER_API_KEY" https://openrouter.ai/api/v1/key | jq '{label: .data.label, limit: .data.limit, limit_remaining: .data.limit_remaining, limit_reset: .data.limit_reset, usage: .data.usage}'
```
- Confirm `limit <= 5.0` and `limit_remaining <= 5.0` in non-secret audit notes.

### 11. Local Spend & Call Limit (Proposed `$4.00` Cutoff)
- `PILOT_FINANCING_MODE = "FOUNDER_SPONSORED"` (BYOK disabled; zero fallback).
- `PILOT_MAX_GENERATIONS = "20"` (atomic D1 counter).
- `PILOT_MAX_ESTIMATED_SPEND_USD = "4.00"` (proposed; atomic D1 micro-USD counter; fail-closed `503 PILOT_COST_CONTROLS_UNCONFIGURED` if absent).
- `PILOT_ESTIMATED_COST_PER_ATTEMPT_USD = "0.02"` (conservative upper bound for `openai/gpt-4o-mini` @ max 2048 output tokens + max 1 retry).
- `PILOT_MODEL_ID = "openai/gpt-4o-mini"`, `PILOT_MAX_OUTPUT_TOKENS = "2048"`, `PILOT_MAX_RETRIES = "1"`, `PILOT_TIMEOUT_MS = "45000"`, `PILOT_RATE_LIMIT_COOLDOWN_MS = "5000"`.
- Atomic D1 in-flight lock (`in_flight_until_ms`) prevents concurrent parallel spend liability.
- Conservative charged-failure accounting: timeouts/5xx/bad-JSON retain slot & spend; only confirmed pre-charge `401`/`402`/`403` errors refund.

### 12. Two-Phase Inference Flag Activation
- **Phase 1 (Deploy Dark):** `PILOT_LIVE_INFERENCE_ENABLED = "false"`, `PILOT_OPENROUTER_API_KEY` NOT yet set.
- **Phase 2 (Activate Live Inference):** Only after Phase 1 no-cost smoke passes AND Founder issues explicit financial GO -> load `PILOT_OPENROUTER_API_KEY` and flip `PILOT_LIVE_INFERENCE_ENABLED = "true"`.

### 13. Initial Deployment (Live Inference OFF)
```bash
cd apps/sophia-ai-factory
npm run pilot:check-isolation -- --require-resolved-ids
npm run pilot:build
OPEN_NEXT_DEPLOY=true npx wrangler deploy --config wrangler.pilot.toml
```

### 14. No-Cost Smoke Tests (Before Phase 2 Activation)
Distinguish all three authorization layers (do not assume identical HTTP status codes):
- **Layer 1 — Edge Access rejection:** Unauthenticated or non-Access-allowed requests receive a Cloudflare Access challenge / `302` redirect to the Access login page (NOT an application `403`).
- **Layer 2 — Application allowlist rejection:** An Access-authenticated identity whose email is not in `PILOT_ALLOWED_EMAILS` receives `403 PILOT_INVITE_REQUIRED` (on sign-up/sign-in) or `403 PILOT_ACCESS_REVOKED` (on `/api/first-value`).
- **Layer 3 — Tenant authorization rejection:** An invited user passing another tenant's `orgId` receives `403` from tenant membership validation.
- Verify `/api/health` (`200`) and `/api/version` (`shortSha` matches deployed SHA).
- Verify `/api/checkout`, `/api/webhooks/payos`, `/api/publish`, `/api/v1/generate`, `/api/campaigns`, `/api/inngest` all return `403`.
- Verify invited user can sign in, accept consent (`2026-11-pilot-v2`), and attempting live generation returns `403 LIVE_INFERENCE_DISABLED` (zero spend).

### 15. Explicit Founder Go-Live Approval
- Founder reviews Phase 1 smoke evidence + OpenRouter `GET /api/v1/key` non-secret limit evidence (`limit <= $5.00`) and issues explicit written GO to enable live inference and spend up to `$4.00/$5.00`.

### 16. Real Inference Smoke Test (Post-Financial Authorization Only)
- Set `PILOT_OPENROUTER_API_KEY` secret and deploy with `PILOT_LIVE_INFERENCE_ENABLED = "true"`.
- Execute 1 real script generation (`openai/gpt-4o-mini`), verify >= 3 scenes, edit, save, export Markdown/JSON, and check `GET /api/v1/key` usage delta (< `$0.01`).
- Clear smoke test rows or confirm clean quota for the invited customer before sending invite.

### 17. Customer Invite Message & Onboarding Link
- Send private link (`https://<pilot-hostname>/vi/first-value` or `/en/first-value`) + Section 1 onboarding guide + `support@agencyos.network` contact directly to the invited customer. Do NOT post publicly.

### 18. Access Revocation & Kill-Switch Procedure (Honest Propagation Reality)
1. **Stop live inference:** Set `PILOT_LIVE_INFERENCE_ENABLED = "false"` in `wrangler.pilot.toml` and redeploy (~30–60s) OR immediately disable/delete the dedicated OpenRouter key in the OpenRouter dashboard (effective immediately at provider).
2. **Revoke customer access (propagation reality):**
   - **Cloudflare Access:** Remove email from Access policy & revoke active Access sessions in Zero Trust dashboard (propagates in seconds at edge).
   - **Application allowlist:** `wrangler secret put PILOT_ALLOWED_EMAILS --config wrangler.pilot.toml` (set to empty/non-matching value — triggers new Worker version deployment, propagates in ~10–30s).
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
financing_mode: "FOUNDER_SPONSORED"
openrouter_key_limit_usd: null
internal_spend_cutoff_usd: 4.00
events_observed:
  INVITE_ACCEPTED: 0
  FIRST_LOGIN: 0
  BRIEF_SUBMITTED: 0
  GENERATION_REQUESTED: 0
  GENERATION_SUCCEEDED: 0
  GENERATION_FAILED: 0
  SCRIPT_REVIEWED: 0
  SCRIPT_EDITED: 0
  SCRIPT_EXPORTED: 0
  CUSTOMER_FEEDBACK_SUBMITTED: 0
time_to_first_useful_draft_minutes: null
scripts_saved_or_exported: 0
voluntary_return_sessions: 0
actual_provider_spend_usd: null
security_incidents_p0: 0
cross_tenant_incidents: 0
qualitative_feedback_verbatim: []
```
