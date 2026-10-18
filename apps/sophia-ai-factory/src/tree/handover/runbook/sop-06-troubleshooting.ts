/**
 * SOP 06: Troubleshooting & Recovery runbook entry.
 * Layer: tree (Domain operations; imports only from @/seed)
 *
 * @module tree/handover/runbook/sop-06-troubleshooting
 */

import type { RunbookContent } from '@/seed/handover/handover-types';

export const SOP_06_TROUBLESHOOTING: RunbookContent = {
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
};
