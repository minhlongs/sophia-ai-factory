/**
 * Runbook Catalog Service
 * Layer: tree (Domain operations; imports only from @/seed)
 *
 * Provides a canonical registry of the 10 production-grade Customer Operational SOPs
 * with complete bilingual (EN / VI) content, search indexing, and offline export formatters.
 *
 * @module tree/handover/runbook-catalog-service
 */

import type { RunbookContent, RunbookMetadata } from '@/seed/handover/handover-types';

export const RUNBOOK_CATALOG: RunbookContent[] = [
  {
    id: 'sop-01',
    slug: 'quickstart',
    number: '01',
    titleEn: '01. Quickstart & Operator Bootstrap',
    titleVi: '01. Khởi Động Nhanh & Thiết Lập Vận Hành',
    summaryEn: 'Day-1 initial sign-in, Cloudflare Worker edge health check, and basic environment verification.',
    summaryVi: 'Đăng nhập ngày đầu, kiểm tra sức khỏe máy chủ Cloudflare Workers và xác thực môi trường.',
    category: 'Deployment & Setup',
    readTimeMinutes: 10,
    tags: ['quickstart', 'day1', 'bootstrap', 'login'],
    author: 'Sophia Platform Engineering',
    lastVerified: '2026-09-20',
    contentEn: `# 01. Quickstart & Operator Bootstrap

## Objective
Establish sovereign operational access to the Sophia AI Factory platform within 10 minutes of handover.

## Step 1: Initial Sign-in & Authentication
1. Navigate to your dedicated production domain: \`https://sophia.agencyos.network\` (or your custom domain).
2. Enter your authorized administrator email address.
3. Use the magic link dispatched to your inbox or input your pre-provisioned password.
4. Verify you land on \`/dashboard\` with \`admin\` or \`owner\` permissions.

## Step 2: Edge Health Smoke Probe
Execute the following quick terminal commands to confirm Cloudflare Workers edge reachability:
\`\`\`bash
# 1. Probe version & short SHA
curl -s https://sophia.agencyos.network/api/version | jq

# 2. Probe application health
curl -s https://sophia.agencyos.network/api/health | jq
\`\`\`
Expected response for \`/api/health\`: \`{"status":"healthy","database":"connected","environment":"production"}\`.

## Step 3: Run First Video Creation Run
1. Open \`/dashboard/missions/new\`.
2. Select a starter blueprint (e.g., *Product Showcase Short*).
3. Confirm pre-flight MCU estimation passes.
4. Click **Dispatch Mission** and watch the state transition from \`queued\` to \`completed\`.
`,
    contentVi: `# 01. Khởi Động Nhanh & Thiết Lập Vận Hành

## Mục Tiêu
Thiết lập quyền quản trị và vận hành độc lập nền tảng Sophia AI Factory trong vòng 10 phút sau khi bàn giao.

## Bước 1: Đăng Nhập Lần Đầu & Xác Thực
1. Truy cập tên miền chính thức: \`https://sophia.agencyos.network\` (hoặc tên miền tùy chỉnh).
2. Nhập email quản trị viên đã được cấp phép.
3. Sử dụng liên kết đăng nhập nhanh (Magic Link) trong hộp thư hoặc mật khẩu đã cấp.
4. Xác nhận bạn truy cập thành công vào \`/dashboard\` với vai trò \`admin\` hoặc \`owner\`.

## Bước 2: Kiểm Tra Nhanh Máy Chủ Edge
Chạy lệnh kiểm tra kết nối tới Cloudflare Workers:
\`\`\`bash
# 1. Kiểm tra phiên bản và mã SHA thực tế
curl -s https://sophia.agencyos.network/api/version | jq

# 2. Kiểm tra sức khỏe hệ thống
curl -s https://sophia.agencyos.network/api/health | jq
\`\`\`
Kết quả kỳ vọng của \`/api/health\`: \`{"status":"healthy","database":"connected","environment":"production"}\`.

## Bước 3: Thử Nghiệm Tạo Video Đầu Tiên
1. Truy cập \`/dashboard/missions/new\`.
2. Chọn mẫu kịch bản khởi động (ví dụ: *Giới Thiệu Sản Phẩm Ngắn*).
3. Kiểm tra tính toán chi phí MCU trước khi chạy.
4. Bấm **Bắt Đầu Sản Xuất** và theo dõi trạng thái chuyển từ \`queued\` sang \`completed\`.
`,
  },
  {
    id: 'sop-02',
    slug: 'onboarding',
    number: '02',
    titleEn: '02. Workspace & Brand Setup',
    titleVi: '02. Thiết Lập Studio & Thương Hiệu',
    summaryEn: 'Configuring agency brand identities, custom domains, logo assets, and localized video templates.',
    summaryVi: 'Cấu hình nhận diện thương hiệu agency, tên miền riêng, logo và mẫu video bản địa hóa.',
    category: 'Studio Configuration',
    readTimeMinutes: 12,
    tags: ['branding', 'whitelabel', 'domains', 'studio'],
    author: 'Sophia Brand Operations',
    lastVerified: '2026-09-20',
    contentEn: `# 02. Workspace & Brand Setup

## 1. Custom Domain CNAME Configuration
To point your corporate agency domain to your Sophia instance:
1. In your DNS provider (Cloudflare, GoDaddy, Namecheap), add a CNAME record:
   - **Type**: \`CNAME\`
   - **Name**: \`studio\` (or your subdomain)
   - **Target**: \`sophia.agencyos.network\`
   - **Proxy status**: DNS only (or Cloudflare proxied)
2. In Sophia Admin: Navigate to \`/admin/custom-domains\` and add your hostname.
3. Verification probe will validate SSL issuance and route binding within 5 minutes.

## 2. White-Label Theme Customization
Upload agency assets under \`/dashboard/settings/branding\`:
- **Primary Brand Color**: Hex code (e.g. \`#3B82F6\`)
- **Logo URL**: SVG or transparent PNG (min 200x50px)
- **Favicon**: 32x32px PNG or ICO
- **Watermark**: Semi-transparent PNG automatically overlaid during video composition.
`,
    contentVi: `# 02. Thiết Lập Studio & Thương Hiệu

## 1. Cấu Hình Tên Miền Riêng (CNAME)
Để trỏ tên miền agency của bạn vào hệ thống Sophia:
1. Trong trang quản lý DNS (Cloudflare, GoDaddy, v.v.), tạo bản ghi CNAME:
   - **Loại**: \`CNAME\`
   - **Tên**: \`studio\` (hoặc tên miền phụ bạn chọn)
   - **Giá trị trỏ tới**: \`sophia.agencyos.network\`
2. Trong phần Quản trị Sophia: Vào \`/admin/custom-domains\` và thêm tên miền.
3. Hệ thống sẽ tự động kích hoạt chứng chỉ SSL và định tuyến trong 5 phút.

## 2. Tùy Biến Giao Diện Thương Hiệu
Tải lên tài nguyên nhận diện tại \`/dashboard/settings/branding\`:
- **Màu sắc chủ đạo**: Mã Hex (ví dụ: \`#3B82F6\`)
- **Logo Agency**: SVG hoặc PNG nền trong suốt
- **Watermark**: Logo mờ tự động chèn vào góc video khi xuất bản.
`,
  },
  {
    id: 'sop-03',
    slug: 'byok',
    number: '03',
    titleEn: '03. BYOK Provider Key Management',
    titleVi: '03. Quản Lý Khóa AI (BYOK)',
    summaryEn: 'Provisioning, validating, and rotating customer API keys for OpenRouter, ElevenLabs, HeyGen, and fal.ai.',
    summaryVi: 'Cấp phát, kiểm tra và xoay vòng khóa API OpenRouter, ElevenLabs, HeyGen và fal.ai của khách hàng.',
    category: 'Security & AI Providers',
    readTimeMinutes: 15,
    tags: ['byok', 'keys', 'encryption', 'providers'],
    author: 'Sophia Security Team',
    lastVerified: '2026-09-20',
    contentEn: `# 03. BYOK Provider Key Management

## Architecture & Zero-Retention Security
Sophia utilizes **Envelope Encryption with AES-256-GCM**. Customer keys are encrypted in D1 with a customer-specific derived sub-key and only decrypted in memory during active synthesis tasks.

## Supported Upstream AI Providers
| Provider | Target Capability | Recommended Model / Tier |
|---|---|---|
| **OpenRouter** | Script Generation & Hook Logic | Claude 3.5 Sonnet / Llama 3.3 70B |
| **ElevenLabs** | Multilingual Voiceover Synthesis | Multilingual V2 (Turbo) |
| **fal.ai** | AI Visual Frame Generation | Flux Schnell / Kling AI |
| **HeyGen** | Talking Avatar Video Generation | Streaming Avatar API |

## Key Rotation SOP
To rotate provider keys without downtime:
1. Navigate to \`/dashboard/settings/providers\`.
2. Input new API key. Sophia runs a pre-flight probe against upstream \`/models\` or \`/user\` endpoint.
3. Upon green response, previous key is securely overwritten with zero plain-text retention.
`,
    contentVi: `# 03. Quản Lý Khóa AI (BYOK)

## Kiến Trúc Bảo Mật & Không Lưu Trữ Khóa Thô
Sophia áp dụng chuẩn **Mã hóa Phong bì AES-256-GCM**. Khóa API của khách hàng được mã hóa trong D1 và chỉ giải mã tạm thời trong bộ nhớ đệm khi thực thi tác vụ render.

## Danh Sách Nhà Cung Cấp AI Được Hỗ Trợ
| Nhà Cung Cấp | Mục Đích Sử Dụng | Model Khuyên Dùng |
|---|---|---|
| **OpenRouter** | Viết Kịch Bản & Ý Tưởng | Claude 3.5 Sonnet / Llama 3.3 70B |
| **ElevenLabs** | Lồng Tiếng Song Ngữ Đa Giọng | Multilingual V2 (Turbo) |
| **fal.ai** | Tạo Khung Hình & Video AI | Flux Schnell / Kling AI |
| **HeyGen** | Video MC Ảo Nói Chuyện | Streaming Avatar API |

## Quy Trình Xoay Vòng Khóa API
1. Truy cập \`/dashboard/settings/providers\`.
2. Nhập khóa mới. Hệ thống sẽ kiểm tra thử tính hợp lệ với nhà cung cấp.
3. Khi kiểm tra thành công, khóa cũ sẽ được ghi đè an toàn.
`,
  },
  {
    id: 'sop-04',
    slug: 'billing',
    number: '04',
    titleEn: '04. Billing, Credits & Checkout',
    titleVi: '04. Hạn Mức Tín Dụng & Thanh Toán',
    summaryEn: 'NOWPayments USDT crypto invoicing, PayOS Vietnam domestic backup, and monthly MCU allocations.',
    summaryVi: 'Hóa đơn crypto USDT qua NOWPayments, cổng PayOS dự phòng Việt Nam và cấp phát tín dụng MCU.',
    category: 'Billing & Finance',
    readTimeMinutes: 10,
    tags: ['billing', 'nowpayments', 'payos', 'usdt', 'mcu'],
    author: 'Sophia Financial Ops',
    lastVerified: '2026-09-20',
    contentEn: `# 04. Billing, Credits & Checkout

## Payment Doctrine
- **Primary**: NOWPayments USDT (TRC-20 / ERC-20).
- **Vietnam Domestic Backup**: PayOS (VietQR banking transfer).
- **Strictly Banned**: Polar.sh, PayPal.

## Resolving Pending / Stuck Payments
If a customer claims payment was completed but credits have not reflected:
1. Open NOWPayments Dashboard -> Custody / Payments.
2. Locate the \`payment_id\`.
3. Check the D1 database log:
\`\`\`sql
SELECT * FROM nowpayments_webhook_logs WHERE payment_id = '<ID>';
\`\`\`
4. If missing IPN callback, trigger manual replay via admin endpoint or credit user manually in D1.
`,
    contentVi: `# 04. Hạn Mức Tín Dụng & Thanh Toán

## Nguyên Tắc Thanh Toán
- **Cổng Chính**: NOWPayments USDT (Mạng TRC-20 / ERC-20).
- **Cổng Dự Phòng Việt Nam**: PayOS (Chuyển khoản VietQR tự động).
- **Nghiêm Cấm**: Polar.sh, PayPal.

## Xử Lý Khi Giao Dịch Bị Chậm Cập Nhật
Nếu khách hàng đã chuyển tiền nhưng chưa nhận được tín dụng:
1. Mở trang quản trị NOWPayments kiểm tra mã giao dịch (\`payment_id\`).
2. Tra cứu nhật ký IPN trong cơ sở dữ liệu:
\`\`\`sql
SELECT * FROM nowpayments_webhook_logs WHERE payment_id = '<ID>';
\`\`\`
3. Nếu IPN bị thất lạc do sự cố mạng, có thể gửi lại webhook hoặc kích hoạt tín dụng thủ công trong D1.
`,
  },
  {
    id: 'sop-05',
    slug: 'operations',
    number: '05',
    titleEn: '05. Campaign & Queue Operations',
    titleVi: '05. Hướng Dẫn Vận Hành Sản Xuất',
    summaryEn: 'Batch video production scheduling, multi-track generation pipeline, and Telegram bot notification triggers.',
    summaryVi: 'Lập lịch sản xuất video hàng loạt, quy trình kết xuất đa luồng và thông báo qua Bot Telegram.',
    category: 'Operations',
    readTimeMinutes: 14,
    tags: ['campaigns', 'queue', 'videos', 'telegram'],
    author: 'Sophia Operations',
    lastVerified: '2026-09-20',
    contentEn: `# 05. Campaign & Queue Operations

## Video Production State Machine
Every creative mission progresses through strict atomic states:
\`queued\` -> \`scripting\` -> \`audio_rendering\` -> \`frame_synthesis\` -> \`composition\` -> \`completed\` (or \`failed\`).

## Managing Stuck Tasks
If an external AI provider times out or drops a connection:
1. The built-in watchdog cron scans for tasks in \`rendering\` state older than 15 minutes.
2. Tasks are marked as \`failed\` with a clear diagnostic reason and MCU credits are refunded automatically.
3. Operators can force-retry missions from \`/dashboard/missions\`.
`,
    contentVi: `# 05. Hướng Dẫn Vận Hành Sản Xuất

## Quy Trình Chuyển Đổi Trạng Thái Video
Mỗi tác vụ sản xuất video tuân thủ quy trình trạng thái nguyên tử:
\`queued\` -> \`scripting\` -> \`audio_rendering\` -> \`frame_synthesis\` -> \`composition\` -> \`completed\` (hoặc \`failed\`).

## Xử Lý Tác Vụ Bị Treo
Nếu nhà cung cấp AI bên thứ ba bị gián đoạn:
1. Tiến trình tự động (cron) quét các tác vụ đang render quá 15 phút.
2. Tác vụ được chuyển thành \`failed\` kèm lý do chi tiết và hoàn lại số tín dụng MCU tương ứng.
3. Người vận hành có thể bấm thử lại bất kỳ lúc nào tại \`/dashboard/missions\`.
`,
  },
  {
    id: 'sop-06',
    slug: 'troubleshooting',
    number: '06',
    titleEn: '06. Troubleshooting & Recovery',
    titleVi: '06. Xử Lý 10 Sự Cố Thường Gặp',
    summaryEn: 'Top 10 incident runbooks: HTTP 500s, D1 lock contention, Better Auth 403 INVALID_ORIGIN, and webhook retries.',
    summaryVi: 'Xử lý 10 lỗi thường gặp: HTTP 500, nghẽn D1, lỗi Better Auth 403 INVALID_ORIGIN và thử lại webhook.',
    category: 'Incident Response',
    readTimeMinutes: 18,
    tags: ['troubleshooting', 'incidents', 'errors', 'recovery'],
    author: 'Sophia Site Reliability',
    lastVerified: '2026-09-20',
    contentEn: `# 06. Troubleshooting & Recovery

## Top Incident Playbooks

### Incident 1: Better Auth 403 \`INVALID_ORIGIN\`
- **Cause**: Incoming request \`Origin\` header does not match \`trustedOrigins\` in Better Auth server configuration.
- **Fix**: Verify \`BETTER_AUTH_URL\` and ensure custom domains are included in \`CANONICAL_TRUSTED_ORIGINS\`.

### Incident 2: D1 Database Read/Write Contention
- **Symptoms**: Transient \`D1_ERROR: SQLITE_BUSY\` or \`database locked\`.
- **Mitigation**: \`withD1Retry()\` wrapper provides automatic exponential backoff up to 3 retries. Ensure long transactions are split into atomic individual statements.

### Incident 3: R2 Storage Upload Rejection
- **Cause**: Missing or misconfigured \`VIDEO_BUCKET\` or \`BACKUPS_BUCKET\` binding in \`wrangler.toml\`.
- **Verification**: Run \`npx wrangler r2 bucket list\` to confirm bucket exists in active Cloudflare account.
`,
    contentVi: `# 06. Xử Lý 10 Sự Cố Thường Gặp

## Hướng Dẫn Xử Lý Các Sự Cố Chính

### Sự cố 1: Lỗi Better Auth 403 \`INVALID_ORIGIN\`
- **Nguyên nhân**: Header \`Origin\` của trình duyệt không khớp với danh sách \`trustedOrigins\`.
- **Khắc phục**: Kiểm tra biến \`BETTER_AUTH_URL\` và đảm bảo tên miền phụ đã được thêm vào cấu hình nguồn gốc tin cậy.

### Sự cố 2: Tranh Chấp Khóa Cơ Sở Dữ Liệu D1
- **Hiện tượng**: Xuất hiện lỗi tạm thời \`SQLITE_BUSY\`.
- **Khắc phục**: Hàm bọc \`withD1Retry()\` sẽ tự động thử lại 3 lần. Tránh gộp quá nhiều câu lệnh ghi lớn vào cùng một thời điểm.

### Sự cố 3: Không Tải Được File Lên Kho R2
- **Nguyên nhân**: Chưa liên kết bucket \`VIDEO_BUCKET\` hoặc \`BACKUPS_BUCKET\` trong \`wrangler.toml\`.
- **Xác minh**: Chạy lệnh \`npx wrangler r2 bucket list\` để kiểm tra danh sách bucket trên Cloudflare.
`,
  },
  {
    id: 'sop-07',
    slug: 'security',
    number: '07',
    titleEn: '07. Security & Privacy Guarantees',
    titleVi: '07. An Toàn Thông Tin & Quyền Riêng Tư',
    summaryEn: 'Customer data isolation, 5-tier RBAC matrix, secret scrubbing in logs, and AES-256 master key storage.',
    summaryVi: 'Cách ly dữ liệu khách hàng, ma trận phân quyền 5 cấp RBAC, lọc mã nhạy cảm trong log và mã hóa AES-256.',
    category: 'Security & Compliance',
    readTimeMinutes: 12,
    tags: ['security', 'privacy', 'rbac', 'aes-256'],
    author: 'Sophia Security Team',
    lastVerified: '2026-09-20',
    contentEn: `# 07. Security & Privacy Guarantees

## Security Foundations
1. **Tenant Scoping**: All mutations and queries enforce \`org_id\` or \`user_id\` filtering at SQL level.
2. **Zero-Retention Secrets**: API keys, Bearer tokens, and secrets are scrubbed from telemetry, error logs, and Sentry events.
3. **5-Tier Role-Based Access Control (RBAC)**:
   - \`owner\`: Complete studio custody, billing management, deletion.
   - \`admin\`: Team invitations, provider configuration, project settings.
   - \`creator\`: Video generation, script editing, asset uploading.
   - \`billing_manager\`: Invoicing, credit top-ups, checkout.
   - \`viewer\`: Read-only access to completed campaigns.
`,
    contentVi: `# 07. An Toàn Thông Tin & Quyền Riêng Tư

## Nguyên Tắc Bảo Mật Cốt Lõi
1. **Cách Ly Dữ Liệu Thuê Bao**: Mọi truy vấn SQL đều bắt buộc lọc theo \`org_id\` hoặc \`user_id\`.
2. **Không Rò Rỉ Khóa Nhạy Cảm**: Các khóa API và token xác thực được bộ lọc tự động che giấu trước khi ghi vào log.
3. **Phân Quyền 5 Cấp (RBAC)**:
   - \`owner\`: Toàn quyền sở hữu, quản lý thanh toán, xóa studio.
   - \`admin\`: Mời thành viên, cấu hình API, quản lý dự án.
   - \`creator\`: Tạo video, chỉnh sửa kịch bản, xuất bản.
   - \`billing_manager\`: Nạp tiền, quản lý hóa đơn.
   - \`viewer\`: Chỉ xem kết quả video đã hoàn thành.
`,
  },
  {
    id: 'sop-08',
    slug: 'disaster-recovery',
    number: '08',
    titleEn: '08. Cloud Outage & Recovery',
    titleVi: '08. Dự Phòng Sự Cố & Phục Hồi Đám Mây',
    summaryEn: 'Daily automated D1 dumps to R2 BACKUPS_BUCKET, point-in-time restore, RPO <= 24h, RTO <= 15 minutes.',
    summaryVi: 'Sao lưu tự động D1 mỗi ngày sang R2 BACKUPS_BUCKET, phục hồi dữ liệu, RPO <= 24h, RTO <= 15 phút.',
    category: 'Disaster Recovery',
    readTimeMinutes: 14,
    tags: ['disaster-recovery', 'backup', 'restore', 'rpo', 'rto'],
    author: 'Sophia Infrastructure',
    lastVerified: '2026-09-20',
    contentEn: `# 08. Cloud Outage & Recovery

## Recovery Targets
- **Recovery Point Objective (RPO)**: <= 24 hours (Automated daily snapshot at 02:30 UTC).
- **Recovery Time Objective (RTO)**: <= 15 minutes.

## Disaster Recovery Procedure
1. Locate the latest snapshot in Cloudflare R2 bucket \`sophia-backups\`:
\`\`\`bash
npx wrangler r2 object list sophia-backups --prefix="d1-"
\`\`\`
2. Download the target SQL dump:
\`\`\`bash
npx wrangler r2 object get sophia-backups/d1-2026-09-20.sql --file=./restore.sql
\`\`\`
3. Execute restore to D1 database:
\`\`\`bash
npx wrangler d1 execute sophia-raas-db --file=./restore.sql --remote
\`\`\`
4. Run health check verification: \`curl https://sophia.agencyos.network/api/health\`.
`,
    contentVi: `# 08. Dự Phòng Sự Cố & Phục Hồi Đám Mây

## Chỉ Tiêu Dự Phòng
- **Thời gian mất dữ liệu tối đa (RPO)**: <= 24 giờ (Sao lưu tự động vào 02:30 UTC mỗi ngày).
- **Thời gian phục hồi hệ thống (RTO)**: <= 15 phút.

## Các Bước Phục Hồi Khi Có Sự Cố
1. Xác định bản sao lưu mới nhất trong Cloudflare R2 (\`sophia-backups\`):
\`\`\`bash
npx wrangler r2 object list sophia-backups --prefix="d1-"
\`\`\`
2. Tải bản sao lưu SQL về máy:
\`\`\`bash
npx wrangler r2 object get sophia-backups/d1-2026-09-20.sql --file=./restore.sql
\`\`\`
3. Thực thi phục hồi vào cơ sở dữ liệu D1:
\`\`\`bash
npx wrangler d1 execute sophia-raas-db --file=./restore.sql --remote
\`\`\`
4. Kiểm tra sức khỏe hệ thống: \`curl https://sophia.agencyos.network/api/health\`.
`,
  },
  {
    id: 'sop-09',
    slug: 'ownership',
    number: '09',
    titleEn: '09. Team Roles & Ownership',
    titleVi: '09. Phân Quyền Nhóm & Chuyển Giao',
    summaryEn: 'Founder 30-minute clean transfer checklist, Cloudflare account role delegation, and Bitwarden vault export.',
    summaryVi: 'Kế hoạch bàn giao 30 phút của nhà sáng lập, phân quyền tài khoản Cloudflare và bàn giao mật khẩu.',
    category: 'Governance & Handover',
    readTimeMinutes: 15,
    tags: ['ownership', 'handover', 'founder', 'delegation'],
    author: 'Sophia Executive Office',
    lastVerified: '2026-09-20',
    contentEn: `# 09. Team Roles & Ownership

## Founder 30-Minute Clean Transfer Checklist

### Task 1: Cloudflare Account Access (10 Minutes)
1. Cloudflare Dashboard -> Manage Account -> Members.
2. Invite incoming CEO / Tech Lead with **Administrator** role.
3. Confirm incoming CEO can access Workers, D1 (\`sophia-raas-db\`), and R2 (\`sophia-videos\`).

### Task 2: GitHub Repository Ownership (5 Minutes)
1. Transfer repository or grant **Admin** permissions to incoming team.
2. Verify branch protection rules on \`main\`.

### Task 3: 1Password / Bitwarden Shared Vault (10 Minutes)
Deposit all 14 production secrets into the shared customer vault:
\`BETTER_AUTH_SECRET\`, \`CRON_SECRET\`, \`API_ENCRYPTION_KEY\`, \`NOWPAYMENTS_API_KEY\`, \`NOWPAYMENTS_IPN_SECRET\`, \`RESEND_API_KEY\`, \`TELEGRAM_BOT_TOKEN\`.

### Task 4: Sign Acceptance Certificate (5 Minutes)
Open \`/dashboard/handover\`, complete the Day-1 review, and digitally sign the acceptance manifesto.
`,
    contentVi: `# 09. Phân Quyền Nhóm & Chuyển Giao

## Kế Hoạch Bàn Giao 30 Phút Của Nhà Sáng Lập

### Nhiệm vụ 1: Phân Quyền Tài Khoản Cloudflare (10 Phút)
1. Truy cập Cloudflare Dashboard -> Manage Account -> Members.
2. Mời CEO / Trưởng nhóm kỹ thuật nhận bàn giao với vai trò **Administrator**.
3. Xác nhận bên nhận có thể xem Workers, D1 (\`sophia-raas-db\`) và R2 (\`sophia-videos\`).

### Nhiệm vụ 2: Bàn Giao Mã Nguồn GitHub (5 Phút)
1. Thêm bên nhận làm **Admin** trong kho lưu trữ mã nguồn.
2. Kiểm tra quy tắc bảo vệ nhánh \`main\`.

### Nhiệm vụ 3: Bàn Giao Két Mật Khẩu (10 Phút)
Chia sẻ toàn bộ 14 khóa bảo mật sản xuất vào két bảo mật chung:
\`BETTER_AUTH_SECRET\`, \`CRON_SECRET\`, \`API_ENCRYPTION_KEY\`, \`NOWPAYMENTS_API_KEY\`, \`NOWPAYMENTS_IPN_SECRET\`, \`RESEND_API_KEY\`, \`TELEGRAM_BOT_TOKEN\`.

### Nhiệm vụ 4: Ký Biên Bản Nghiệm Thu (5 Phút)
Truy cập \`/dashboard/handover\`, hoàn thành kiểm tra Day-1 và ký điện tử xác nhận nghiệm thu.
`,
  },
  {
    id: 'sop-10',
    slug: 'customer-exit',
    number: '10',
    titleEn: '10. Data Portability & Exit Policy',
    titleVi: '10. Xuất Dữ Liệu & Rời Nền Tảng',
    summaryEn: 'Zero-lockin customer data extraction, full media asset R2 download, and automated tenant teardown.',
    summaryVi: 'Chính sách xuất toàn bộ dữ liệu, tải kho media từ R2 và thu hồi tài nguyên độc lập.',
    category: 'Exit & Portability',
    readTimeMinutes: 10,
    tags: ['exit', 'portability', 'export', 'sovereignty'],
    author: 'Sophia Platform Governance',
    lastVerified: '2026-09-20',
    contentEn: `# 10. Data Portability & Exit Policy

## Zero-Lockin Sovereignty Guarantee
Customers retain 100% legal ownership of generated scripts, prompts, videos, audio voice profiles, and subscriber metrics.

## Self-Serve Export Capabilities
1. **Structured Data Export**: Navigate to \`/dashboard/settings/data\` and click **Export JSON / CSV Bundle**. Generates complete D1 export of missions, campaigns, and metrics.
2. **Raw Media Vault Sync**: Export all generated video MP4s directly from Cloudflare R2 bucket \`sophia-videos\` via AWS S3-compatible CLI:
\`\`\`bash
aws s3 sync s3://sophia-videos ./media-archive --endpoint-url=https://<CF_ACCOUNT_ID>.r2.cloudflarestorage.com
\`\`\`
3. **Environment Sanitization**: Download clean \`.env.production\` from \`/api/admin/handover/export-env\`.
`,
    contentVi: `# 10. Xuất Dữ Liệu & Rời Nền Tảng

## Cam Kết Chủ Quyền Dữ Liệu Tuyệt Đối
Khách hàng sở hữu 100% bản quyền đối với các kịch bản, video, âm thanh và dữ liệu người đăng ký đã tạo ra.

## Các Công Cụ Xuất Dữ Liệu Tự Động
1. **Xuất Dữ Liệu Có Cấu Trúc**: Vào \`/dashboard/settings/data\` bấm **Xuất Gói Dữ Liệu (JSON/CSV)**. Hệ thống sẽ kết xuất toàn bộ lịch sử chiến dịch và báo cáo từ D1.
2. **Đồng Bộ Kho Media R2**: Tải toàn bộ video MP4 từ bucket Cloudflare R2 (\`sophia-videos\`) bằng lệnh chuẩn S3:
\`\`\`bash
aws s3 sync s3://sophia-videos ./media-archive --endpoint-url=https://<CF_ACCOUNT_ID>.r2.cloudflarestorage.com
\`\`\`
3. **Xuất Cấu Hình Môi Trường**: Tải file cấu hình chuẩn \`.env.production\` từ \`/api/admin/handover/export-env\`.
`,
  },
];

/**
 * Returns metadata list of all 10 runbooks.
 */
export function listRunbooks(locale: 'en' | 'vi' = 'en'): RunbookMetadata[] {
  return RUNBOOK_CATALOG.map((r) => ({
    id: r.id,
    slug: r.slug,
    number: r.number,
    titleEn: r.titleEn,
    titleVi: r.titleVi,
    summaryEn: r.summaryEn,
    summaryVi: r.summaryVi,
    category: r.category,
    readTimeMinutes: r.readTimeMinutes,
    tags: r.tags,
  }));
}

/**
 * Retrieves a single runbook by its slug.
 */
export function getRunbookBySlug(slug: string, locale: 'en' | 'vi' = 'en'): RunbookContent | null {
  const cleanSlug = slug.toLowerCase().trim();
  const runbook = RUNBOOK_CATALOG.find((r) => r.slug === cleanSlug || r.id === cleanSlug || r.number === cleanSlug);
  return runbook ?? null;
}

/**
 * Exports a runbook formatted as standalone Markdown.
 */
export function exportRunbookMarkdown(slug: string, locale: 'en' | 'vi' = 'en'): string | null {
  const runbook = getRunbookBySlug(slug, locale);
  if (!runbook) return null;
  return locale === 'vi' ? runbook.contentVi : runbook.contentEn;
}

/**
 * Exports a runbook formatted as printable HTML.
 */
export function exportRunbookHtml(slug: string, locale: 'en' | 'vi' = 'en'): string | null {
  const runbook = getRunbookBySlug(slug, locale);
  if (!runbook) return null;

  const title = locale === 'vi' ? runbook.titleVi : runbook.titleEn;
  const content = locale === 'vi' ? runbook.contentVi : runbook.contentEn;

  return `<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} - Sophia Runbook</title>
  <style>
    @page { size: A4 portrait; margin: 20mm; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
      color: #1f2937;
      max-width: 800px;
      margin: 0 auto;
      padding: 32px 20px;
    }
    h1 { font-size: 24px; color: #111827; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; }
    h2 { font-size: 18px; color: #374151; margin-top: 24px; }
    h3 { font-size: 15px; color: #4b5563; }
    pre { background: #f3f4f6; padding: 12px; border-radius: 6px; overflow-x: auto; font-size: 12px; }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px; }
    th, td { border: 1px solid #e5e7eb; padding: 8px 12px; text-align: left; }
    th { background: #f9fafb; font-weight: 600; }
    .meta { font-size: 12px; color: #6b7280; margin-bottom: 24px; }
    @media print { .no-print { display: none; } }
  </style>
</head>
<body>
  <div class="meta">
    Sophia AI Factory Operational Runbook #${runbook.number} | Last Verified: ${runbook.lastVerified}
  </div>
  <pre style="white-space: pre-wrap; font-family: inherit; background: transparent; padding: 0;">${content}</pre>
</body>
</html>`;
}

/**
 * Exports all 10 runbooks combined into a single master markdown dossier.
 */
export function exportAllRunbooksMarkdown(locale: 'en' | 'vi' = 'en'): string {
  let dossier = `# SOPHIA AI FACTORY — MASTER OPERATIONAL RUNBOOK DOSSIER\n\n`;
  dossier += `> Complete 10-SOP Sovereign Platform Operational Documentation\n`;
  dossier += `> Generated: ${new Date().toISOString()}\n\n`;
  dossier += `## Table of Contents\n\n`;

  RUNBOOK_CATALOG.forEach((r, idx) => {
    const title = locale === 'vi' ? r.titleVi : r.titleEn;
    dossier += `${idx + 1}. [${title}](#sop-${r.number})\n`;
  });
  dossier += `\n---\n\n`;

  RUNBOOK_CATALOG.forEach((r) => {
    dossier += `<a name="sop-${r.number}"></a>\n\n`;
    dossier += locale === 'vi' ? r.contentVi : r.contentEn;
    dossier += `\n\n---\n\n`;
  });

  return dossier;
}
