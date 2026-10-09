/**
 * SOP 07 and 08: Security/Privacy and Disaster Recovery.
 * Layer: tree (Domain operations; imports only from @/seed)
 *
 * @module tree/handover/runbook/sop-07-to-08
 */

import type { RunbookContent } from '@/seed/handover/handover-types';

export const SOPS_07_TO_08: RunbookContent[] = [
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
];
