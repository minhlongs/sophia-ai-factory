/**
 * SOP 04 to 06: Billing & Credits, Campaign/Queue Ops, Troubleshooting & Recovery.
 * Layer: tree (Domain operations; imports only from @/seed)
 *
 * @module tree/handover/runbook/sop-04-to-06
 */

import type { RunbookContent } from '@/seed/handover/handover-types';

export const SOPS_04_TO_06: RunbookContent[] = [
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
];
