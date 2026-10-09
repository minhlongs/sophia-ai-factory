/**
 * SOP 09 and 10: Team Roles/Ownership and Data Portability/Exit Policy.
 * Layer: tree (Domain operations; imports only from @/seed)
 *
 * @module tree/handover/runbook/sop-09-to-10
 */

import type { RunbookContent } from '@/seed/handover/handover-types';

export const SOPS_09_TO_10: RunbookContent[] = [
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
