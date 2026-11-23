# Sophia AI Factory — First Real Customer Pilot (CUSTOMER-01) Handoff Package
# Gói Bàn Giao Thử Nghiệm Khách Hàng Đầu Tiên (CUSTOMER-01)

> **Status / Trạng thái:** `PENDING_DEPLOYMENT` (awaiting explicit Founder authorization)
> **Pilot URL / Đường dẫn thử nghiệm:** `PENDING_DEPLOYMENT` (Isolated Private Pilot Worker `sophia-ai-factory-pilot`, protected by Cloudflare Access + server-side `PILOT_ALLOWED_EMAILS` allowlist)
> **Deployed Source SHA:** `NOT_DEPLOYED` (prepared on branch `feat/customer-01-first-real-pilot`)
> **Pilot Duration / Thời hạn:** 7 days (proposed) · **Fee / Chi phí:** Free ($0, payments disabled) · **Scope / Phạm vi:** 1 invited external customer

---

## 1. Customer Onboarding Guide (EN + VI) / Hướng Dẫn Bắt Đầu Cho Khách Hàng

### 🇻🇳 Hướng dẫn từng bước (Dành cho khách hàng)

1. **🔗 Mở đường dẫn thử nghiệm riêng:** Nhấn vào liên kết thử nghiệm mà Founder gửi cho bạn (chỉ email được mời mới có thể truy cập).
2. **🔐 Đăng nhập / Tạo tài khoản:** Đăng nhập bằng đúng địa chỉ email đã được mời. Bạn không cần dùng công cụ kỹ thuật hay cài đặt phần mềm nào.
3. **📋 Đọc thông báo thử nghiệm & quyền riêng tư:** Ở đầu trang **First Value** (`/vi/first-value`), đọc thông báo bản thử nghiệm miễn phí 7 ngày và nhấn **Đồng ý điều khoản & Tiếp tục**.
   - Dữ liệu kịch bản của bạn chỉ hiển thị riêng cho bạn, không tự động đăng công khai, và có thể xóa bất cứ lúc nào khi bạn yêu cầu.
   - Không nhập mật khẩu, thông tin thẻ thanh toán hay bí mật nhạy cảm vào ô mô tả.
4. **✍️ Nhập yêu cầu nội dung (Business Brief):** Điền Chủ đề, Đối tượng khách hàng và Thời lượng mong muốn (ví dụ 30 giây).
5. **✨ Tạo kịch bản AI thật:** Nhấn nút tạo kịch bản. Hệ thống tạo kịch bản gồm tối thiểu 3 phân cảnh (hình ảnh + lời thoại).
6. **✏️ Xem & Chỉnh sửa:** Nhấn **Chỉnh sửa kịch bản** để điều chỉnh tiêu đề, mô tả hình ảnh hoặc lời thoại theo giọng điệu doanh nghiệp của bạn, rồi nhấn **Lưu chỉnh sửa**.
7. **✅ Duyệt & Xuất bản nháp:** Nhấn **Chấp nhận** để chốt bản nháp, sau đó chọn **Xuất Markdown** hoặc **Xuất JSON**, hoặc nhấn **Sao chép bản xuất** để dán vào tài liệu của bạn.
8. **💬 Gửi góp ý hoặc báo lỗi:** Dùng khung **Góp ý & Báo lỗi thử nghiệm** ngay bên dưới để đánh giá mức độ hữu ích, phần khó chỉnh sửa hoặc báo lỗi gặp phải.

### 🇬🇧 Step-by-step Guide (Customer)

1. **🔗 Open your private pilot link:** Use the invite-only link provided by the Founder after launch approval.
2. **🔐 Sign in / Register:** Authenticate with your exact invited email address. No CLI, Postman, or technical setup is needed.
3. **📋 Review Beta & Privacy Notice:** At the top of `/en/first-value`, read the short 7-day private beta privacy notice and click **Accept Pilot Terms & Continue**.
   - Your briefs, scripts, and feedback remain strictly private to your workspace, are never auto-published, and will be deleted upon request or after the 7-day pilot.
   - Never enter passwords, payment details, or confidential secrets into prompts.
4. **✍️ Enter a Business Brief:** Fill in Topic, Target Audience, and Duration (e.g., 30 seconds).
5. **✨ Generate Your First Real AI Script:** Click Generate to produce a validated script with at least 3 scenes (visuals + narration).
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

## 3. Privacy, Data Retention & Deletion Policy (G6)

- **Data collected:** Invited email, workspace membership, submitted briefs, generated/edited scripts, pilot consent timestamp, minimal scoped telemetry events (`INVITE_ACCEPTED`, `FIRST_LOGIN`, `BRIEF_SUBMITTED`, `GENERATION_REQUESTED`, `GENERATION_SUCCEEDED`, `GENERATION_FAILED`, `SCRIPT_REVIEWED`, `SCRIPT_EDITED`, `SCRIPT_EXPORTED`, `CUSTOMER_FEEDBACK_SUBMITTED`), and submitted feedback.
- **Data NOT collected / NOT logged:** Customer API keys are encrypted at rest and never logged; server-side provider keys are never sent to the browser; raw prompts/provider headers are never logged; zero payment data (PayOS/NOWPayments disabled).
- **Retention & Deletion:** Data is stored in an isolated non-production D1 database (`sophia-pilot-db`) for the 7-day pilot window. Upon customer request or pilot end, the Founder exports anonymized qualitative learnings (with customer permission) and deletes the customer's rows or destroys the isolated `sophia-pilot-db` database.

---

## 4. Founder Support, Incident Response & Kill Switch (Operator Appendix)

### Instant Kill Switch & Access Revocation
1. **Stop all live AI inference immediately (without taking down login/export):**
   Set `PILOT_LIVE_INFERENCE_ENABLED = "false"` in `wrangler.pilot.toml` (or Cloudflare Worker Variables) and redeploy/save. Every `live_provider` generation immediately returns `403 LIVE_INFERENCE_DISABLED`.
2. **Revoke the customer's access immediately:**
   Update Worker secret `PILOT_ALLOWED_EMAILS` (`wrangler secret put PILOT_ALLOWED_EMAILS --config wrangler.pilot.toml`) to remove the customer's email (or set to an empty/non-matching value). Because `PILOT_INVITE_ONLY=true` fails closed, all `/api/first-value` and auth endpoints immediately reject the user with `403 PILOT_ACCESS_REVOKED` / `403 PILOT_INVITE_REQUIRED`.
3. **Revoke provider key (if Founder-sponsored):**
   Rotate/disable the dedicated OpenRouter pilot key in the OpenRouter dashboard (where a hard spend cap of `$5.00 USD` should also be configured).

### Incident Escalation
- **P0 (Cross-tenant access, leaked key, runaway provider spend):** Immediately trigger Kill Switch #1 + #2 + OpenRouter key disable within 5 minutes, notify the customer, preserve audit logs without secrets, and do not resume until root cause is fixed and verified.
- **P1 (Provider outage / generation error):** Customer receives a clean bilingual error message and their quota slot is automatically released (`releasePilotGenerationSlot`). Support responds via the Founder's agreed direct channel within 4 business hours.

---

## 5. Pilot Start / End Criteria & Real Evidence Template (G5 / G9)

### Start Criteria (All Required Before Sending Invite)
- [ ] Draft PR reviewed (0 unresolved P0/P1) and explicitly approved by Founder.
- [ ] Dedicated non-production D1 (`sophia-pilot-db`, `sophia-pilot-tag-cache`) and R2 (`sophia-pilot-opennext-cache`) created and wired in `wrangler.pilot.toml`.
- [ ] Migrations applied ONLY to `sophia-pilot-db` (never production `sophia-raas-db`).
- [ ] Cloudflare Access policy + `PILOT_ALLOWED_EMAILS` configured for the Founder-supplied single customer email.
- [ ] Real inference financing chosen (Customer BYOK or Founder-sponsored `PILOT_OPENROUTER_API_KEY` with `$5.00` OpenRouter hard limit + `PILOT_MAX_GENERATIONS=20`).
- [ ] Founder explicitly authorizes deployment, enables `PILOT_LIVE_INFERENCE_ENABLED=true`, and sends the invitation.

### End Criteria
- 7 calendar days elapsed from customer's `FIRST_LOGIN`, OR customer requests early exit, OR Founder triggers kill switch.

### Actual Usage & Cost Evidence Format (Fill ONLY After Real Customer Use — Never Fabricate)

```yaml
pilot_id: CUSTOMER-01
deployed_sha: "<exact-sha>"
pilot_window_start_iso: "<YYYY-MM-DDTHH:MM:SSZ>"
pilot_window_end_iso: "<YYYY-MM-DDTHH:MM:SSZ>"
funding_mode: "<customer_byok | founder_sponsored>"
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
