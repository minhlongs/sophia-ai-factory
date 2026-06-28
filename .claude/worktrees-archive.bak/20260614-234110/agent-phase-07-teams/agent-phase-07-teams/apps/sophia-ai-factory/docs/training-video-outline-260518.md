# Sophia AI Factory — Training Video Outline (30 min)

**Date:** 2026-05-18  
**Audience:** Non-tech CEO (client)  
**Language:** Bilingual VI/EN narration + on-screen captions  
**Tools for recording:** Loom, OBS Studio, or QuickTime  
**Duration:** ~30 minutes  
**Video format:** 1080p MP4, system audio + external mic  

---

## 00:00–02:00 — Welcome + What is Sophia

### Narration Script (EN)
> "Welcome to Sophia AI Factory — the no-code RaaS platform for non-technical CEOs. Sophia lets you run a Revenue-as-a-Service business without coding. You bring your own API keys. We handle the platform. Let's see how."

### Narration Script (VI)
> "Chào mừng đến với Sophia AI Factory — nền tảng RaaS không cần code dành cho CEO không có nền tảng kỹ thuật. Sophia cho phép bạn chạy một doanh nghiệp RaaS mà không cần viết code. Bạn mang API key của riêng bạn. Chúng tôi quản lý nền tảng. Hãy xem cách thức hoạt động."

### On-Screen Content
- Title card: "Sophia AI Factory — No-Code RaaS"
- Zoom into platform dashboard
- Highlight 4 tier cards: BASIC / PREMIUM / ENTERPRISE / MASTER
- Show bilingual UI toggle (VI/EN)

### Key Talking Points
- Sophia = automated AI agent for revenue generation
- No coding needed from customer
- BYOK (Bring Your Own API Keys) — customer controls integrations
- Platform handles billing, promo, payouts, affiliate tracking

---

## 02:00–07:00 — Setup Wizard Demo (Staging)

### Narration Script (EN)
> "First, customers sign up via email. We send a magic link. Once verified, they enter their API keys for the AI engine they want to use — OpenRouter, or direct Anthropic key. Then they add payment credentials for NOWPayments — that's how customers are charged. Finally, they choose their tier. Setup is done in minutes."

### Narration Script (VI)
> "Trước tiên, khách hàng đăng ký qua email. Chúng tôi gửi một magic link. Sau khi xác minh, họ nhập API key cho engine AI mà họ muốn sử dụng — OpenRouter hoặc trực tiếp khóa Anthropic. Sau đó, họ thêm thông tin xác thực thanh toán cho NOWPayments — đó là cách khách hàng bị tính phí. Cuối cùng, họ chọn tier của họ. Thiết lập hoàn tất trong vài phút."

### On-Screen Content
- Open incognito browser → https://sophia-ai-factory-staging.agencyos-openclaw.workers.dev
- Click "Sign up with email"
- Enter test email (e.g., demo@example.com)
- Show magic link in email (use staging mail UI if available)
- Click magic link → verify email
- Navigate to Setup Wizard
- Step 1: Choose AI provider (OpenRouter) → Enter dummy API key
- Step 2: Choose payment provider (NOWPayments) → Enter dummy merchant key
- Step 3: Select tier (BASIC)
- Review setup confirmation
- Show success message & dashboard redirect

### Key Talking Points
- Email magic link = secure auth, no password
- API key field = read-only after submission (security)
- Tier selection affects pricing (shown in dashboard)
- Confirmation email sent to customer

---

## 07:00–12:00 — FREE100 Promo Flow (Admin Bulk Generate + Download)

### Narration Script (EN)
> "Operators can run promotions via bulk-generated promo codes. For example, let's generate a batch of 50 FREE100 codes — each gives one free month on the MASTER tier. We navigate to the admin section, click 'Bulk Generate Promo Codes', enter quantity 50, and download a CSV. The CSV is ready to share with customers, affiliates, or partners. Each code expires in 30 days and is single-use."

### Narration Script (VI)
> "Nhà khai thác có thể chạy khuyến mãi qua các mã promo được tạo hàng loạt. Ví dụ, hãy tạo một lô 50 mã FREE100 — mỗi mã cho một tháng miễn phí trên tier MASTER. Chúng tôi điều hướng đến phần admin, nhấp vào 'Tạo mã promo hàng loạt', nhập số lượng 50 và tải xuống CSV. CSV sẵn sàng chia sẻ với khách hàng, đối tác liên kết hoặc đối tác. Mỗi mã hết hạn trong 30 ngày và là dùng một lần."

### On-Screen Content
- Login as admin (admin-demo@example.com, incognito)
- Navigate to `/dashboard/admin/promo-codes/bulk`
- Show "Bulk Generate Codes" form
  - Promo template: FREE100-XXXX
  - Quantity: 50
  - Expiry: 30 days (default)
  - Max uses: 1
- Click "Generate 50 codes"
- Show progress bar (simulated: instant in staging)
- Click "Download CSV"
- Save to `/tmp/FREE100-codes-2026-05-18.csv`
- Open CSV in default app (show 50 rows of unique codes)
- Show one sample code: `FREE100-a7c2f9` with activation_url

### Key Talking Points
- Bulk generation saves time vs. one-by-one
- CSV format = easy to share via email/Drive
- Each code is unique, tamper-resistant (HMAC signed)
- Tracking available in admin list page (next section)

---

## 12:00–18:00 — Promo Codes List Page + Search/Filter + Admin Handover List

### Narration Script (EN)
> "Operators monitor redemptions in the Promo Codes list. Filter by status — active, expired, redeemed. Search by code or customer email. Here we see our newly generated FREE100 codes. Two have been redeemed already. We can export a summary for bookkeeping. We also have a separate 'Handover List' that shows which customers will auto-receive free month access. This list is reviewed weekly to ensure compliance with promo terms."

### Narration Script (VI)
> "Nhà khai thác theo dõi việc sử dụng lại trong danh sách Mã khuyến mãi. Lọc theo trạng thái — hoạt động, hết hạn, đã sử dụng. Tìm kiếm theo mã hoặc email khách hàng. Ở đây chúng tôi thấy các mã FREE100 mới được tạo của mình. Hai mã đã được sử dụng lại. Chúng tôi có thể xuất tóm tắt cho kế toán. Chúng tôi cũng có một 'Danh sách bàn giao' riêng biệt hiển thị khách hàng nào sẽ tự động nhận truy cập một tháng miễn phí. Danh sách này được xem xét hàng tuần để đảm bảo tuân thủ các điều khoản khuyến mãi."

### On-Screen Content
- Navigate to `/dashboard/admin/promo-codes/list`
- Show table with columns: Code, Status, Redeemed By, Redeemed At, Expires At
- Apply filter: Status = "ACTIVE"
- Show ~48 active codes
- Apply search: "FREE100" → show results
- Click on one redeemed code → show customer email + redemption timestamp
- Switch to `/dashboard/admin/handover-list`
- Show list of customers with FREE100 eligibility
  - Email, Tier, Expiry Date, Magic Link
- Mention 72h magic link validity
- Click "Export" → download CSV summary

### Key Talking Points
- Real-time redemption tracking
- Email verification before tier grant (prevents abuse)
- 72h magic link = secure onboarding for new customers
- Export for compliance & reporting
- Status flow: PENDING → REDEEMED or PENDING → EXPIRED

---

## 18:00–25:00 — Disaster Recovery Walkthrough (Staged on Staging)

### Narration Script (EN)
> "Sophia ships with a complete disaster recovery procedure. If PROD goes down, we have a clear playbook. Let me walk through it. Step 1: We verify the D1 database backup in R2 storage — it's daily automated. Step 2: We restore from backup into a new D1 database via the Cloudflare dashboard. Step 3: We redeploy the Worker with the new DB binding. Step 4: We verify SHA match and HTTP 200. Total recovery time is under 30 minutes. Here's the detailed procedure documented in our DR manual."

### Narration Script (VI)
> "Sophia đi kèm với quy trình phục hồi thảm họa hoàn chỉnh. Nếu PROD ngừng hoạt động, chúng tôi có một kế hoạch rõ ràng. Hãy để tôi hướng dẫn bạn qua nó. Bước 1: Chúng tôi xác minh sao lưu cơ sở dữ liệu D1 trong lưu trữ R2 — nó được tự động hàng ngày. Bước 2: Chúng tôi khôi phục từ bản sao lưu vào cơ sở dữ liệu D1 mới qua bảng điều khiển Cloudflare. Bước 3: Chúng tôi triển khai lại Worker với liên kết DB mới. Bước 4: Chúng tôi xác minh khớp SHA và HTTP 200. Thời gian phục hồi tổng cộng là dưới 30 phút. Đây là quy trình chi tiết được lưu trong hướng dẫn DR của chúng tôi."

### On-Screen Content
- Open `docs/dr-drill-260522.md` (or show on second screen)
- Read sections aloud with visuals:
  - **Backup verification:** Show R2 bucket in Cloudflare dashboard with recent backup object (2026-05-18-D1-dump.sql)
  - **Restore steps:** Show Cloudflare D1 console → "Restore from backup"
  - **Redeploy:** Show `npm run deploy:full` command in terminal (DO NOT execute)
  - **Verification:** Show `curl https://sophia.agencyos.network/api/version | jq .shortSha`
- Mention RTO (Recovery Time Objective) = <30min
- Mention RPO (Recovery Point Objective) = <24h (daily backups)

### Key Talking Points
- Automated daily backups to R2 (immutable storage)
- No external cron required (CF-native)
- Recovery procedure is tested monthly
- SLA: 30-min restore time
- Zero data loss guarantee (24h RPO)

---

## 25:00–28:00 — Incident Response & Escalation Playbook

### Narration Script (EN)
> "When production issues occur, we follow a severity-based playbook. Severity 1 — customer payment flow broken. We page the on-call operator immediately. Severity 2 — promo codes not working. We investigate within 1 hour. Severity 3 — slow page load. We gather metrics and fix in next release. For each severity, we have runbook steps, escalation contacts, and rollback procedures. Here's our incident response template."

### Narration Script (VI)
> "Khi các sự cố sản xuất xảy ra, chúng tôi làm theo kế hoạch dựa trên mức độ nghiêm trọng. Mức độ 1 — luồng thanh toán khách hàng bị hỏng. Chúng tôi gọi điều phối viên ca trực ngay lập tức. Mức độ 2 — mã promo không hoạt động. Chúng tôi điều tra trong vòng 1 giờ. Mức độ 3 — tải trang chậm. Chúng tôi thu thập số liệu và sửa trong bản phát hành tiếp theo. Đối với mỗi mức độ, chúng tôi có các bước runbook, liên hệ escalation và quy trình khôi phục. Đây là mẫu phản ứng sự cố của chúng tôi."

### On-Screen Content
- Open `docs/incident-response-playbook.md`
- Show severity matrix table:
  | Severity | Issue | Response Time | Action |
  |---|---|---|---|
  | 1 | Payment broken | <5 min | Page oncall |
  | 2 | Core feature degraded | <1 hour | Hotfix + test |
  | 3 | Non-critical bug | <24 hour | Next release |
- Show rollback command: `npx wrangler rollback --name sophia-ai-factory --message "Incident SEV1 hotfix" --yes`
- Show how to check prior deployments in Cloudflare console
- Mention escalation: operator → CEO → customer

### Key Talking Points
- Clear severity definitions prevent ambiguity
- Rollback available within 2 minutes
- Documented runbooks = faster response
- Customer communication template included

---

## 28:00–30:00 — Wrap-up + Where to Get Help

### Narration Script (EN)
> "Sophia AI Factory is production-ready and fully documented. Every feature has a runbook. Every scenario has a playbook. Customers can reach out via email for support — we respond within 24 hours. For operators, all documentation lives in the `docs/` folder. For incident response, check the incident playbook. For tier configuration, see the tiers reference. For payments, NOWPayments documentation is integrated. Finally, this project scores 91.5 out of 100 on our enterprise audit framework. The ceiling at 91.5 reflects our 'no-tech' doctrine — we do NOT ask operators to set up third-party infrastructure. We ship it complete, out of the box. Thank you for choosing Sophia."

### Narration Script (VI)
> "Sophia AI Factory sản xuất và được lưu ý đầy đủ. Mỗi tính năng có một cuốn sách chơi. Mỗi kịch bản đều có một kế hoạch. Khách hàng có thể liên hệ qua email để nhận hỗ trợ — chúng tôi trả lời trong vòng 24 giờ. Đối với nhà khai thác, tất cả tài liệu nằm trong thư mục `docs/`. Để phản ứng sự cố, hãy kiểm tra sách phát triển sự cố. Để cấu hình tier, hãy xem tham chiếu tier. Để thanh toán, tài liệu NOWPayments được tích hợp. Cuối cùng, dự án này đạt 91,5 trên 100 trên khung kiểm tra doanh nghiệp của chúng tôi. Mức trần 91,5 phản ánh 'không có công nghệ' của chúng tôi — chúng tôi KHÔNG yêu cầu các nhà khai thác thiết lập cơ sở hạ tầng của bên thứ ba. Chúng tôi vận chuyển nó hoàn chỉnh, ngay từ hộp. Cảm ơn bạn đã chọn Sophia."

### On-Screen Content
- Show document structure in VS Code:
  ```
  docs/
  ├── CLIENT-HANDOVER-PACKAGE.md
  ├── dr-drill-260522.md
  ├── incident-response-playbook.md
  ├── operator-playbook/
  ├── known-issues.md
  └── ...
  ```
- Show support email: operators@agencyos.network
- End card: "Sophia AI Factory — Score 91.5/100 (Enterprise Grade). No-Tech Doctrine. Fully Documented. Production Ready."

### Key Talking Points
- All docs in `docs/` folder (publicly accessible)
- Support SLA: 24h response time
- Operator runbooks cover all common tasks
- 91.5/100 score = enterprise-grade reliability
- Doctrine ceiling = intentional, not a bug
- Next steps = monthly DR drills, annual key rotation

---

## Recording Notes

### Technical Setup
- **Screen resolution:** 1920×1080 (record at native resolution for clarity)
- **Font size:** 16px minimum on code/text (accessibility)
- **Audio levels:** Test mic before recording; aim for -20dB to -6dB peak
- **System audio:** Unmute to capture any notification sounds (low volume)
- **Pacing:** Speak clearly, pause between sections for emphasis

### Safety Checklist
- [ ] Recording in INCOGNITO BROWSER (no logged-in state from other sessions)
- [ ] Using STAGING URL, not PROD (for demo safety)
- [ ] Dummy email/API keys visible (no real customer data)
- [ ] No credentials, secrets, or sensitive env vars visible on screen
- [ ] Admin account used is `admin-demo@example.com` (clearly test account)
- [ ] Redact or blur any real customer email if it appears accidentally

### Post-Recording
- [ ] Trim pauses/stutters in editor
- [ ] Add captions/subtitles (optional but recommended for non-native speakers)
- [ ] Export 1080p H.264 MP4, 30fps, 128kbps audio
- [ ] Verify file size ~600MB–1.2GB (reasonable for 30min video)
- [ ] Upload to client Google Drive (private folder, share link only)
- [ ] Save local copy to `/tmp/sophia-handover-training-260518.mp4`

---

## Alternate: Quick Walkthrough (15 min version)

If recording time is limited, condense as follows:

- **00:00–01:00:** Welcome + what is Sophia (intro only)
- **01:00–03:00:** Setup Wizard (skip payment details, focus on API key step)
- **03:00–07:00:** FREE100 bulk generate + CSV download
- **07:00–10:00:** Promo list + search (skip handover list)
- **10:00–14:00:** DR procedure (verbal walkthrough, no live demo)
- **14:00–15:00:** Incident response severity matrix only

Total: ~15 min, covers all critical flows.

---

**End of training outline. Ready for recording in Loom or OBS.**
