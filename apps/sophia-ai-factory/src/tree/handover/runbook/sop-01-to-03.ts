/**
 * SOP 01 to 03: Quickstart, Workspace/Brand Setup, BYOK Key Management.
 * Layer: tree (Domain operations; imports only from @/seed)
 *
 * @module tree/handover/runbook/sop-01-to-03
 */

import type { RunbookContent } from '@/seed/handover/handover-types';
import { SOP_03_BYOK } from './sop-03-byok';

export const SOP_01_QUICKSTART: RunbookContent = {
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
\`\`\`bash
curl -s https://sophia.agencyos.network/api/version | jq
curl -s https://sophia.agencyos.network/api/health | jq
\`\`\`

## Step 3: First Test Video Mission
1. Navigate to \`/dashboard/missions/new\`.
2. Select a pre-built starter template.
3. Confirm MCU pre-flight cost calculation and click **Dispatch Mission**.
`,
  contentVi: `# 01. Khởi Động Nhanh & Thiết Lập Vận Hành

## Mục Tiêu
Thiết lập quyền quản trị và vận hành độc lập nền tảng Sophia AI Factory trong vòng 10 phút sau khi bàn giao.

## Bước 1: Đăng Nhập Lần Đầu & Xác Thực
1. Truy cập tên miền chính thức: \`https://sophia.agencyos.network\`.
2. Nhập email quản trị viên đã được cấp phép.
3. Sử dụng magic link hoặc mật khẩu đã cấp.
4. Xác nhận bạn truy cập thành công vào \`/dashboard\` với vai trò \`admin\` hoặc \`owner\`.

## Bước 2: Kiểm Tra Nhanh Máy Chủ Edge
\`\`\`bash
curl -s https://sophia.agencyos.network/api/version | jq
curl -s https://sophia.agencyos.network/api/health | jq
\`\`\`

## Bước 3: Thử Nghiệm Tạo Video Đầu Tiên
1. Truy cập \`/dashboard/missions/new\`.
2. Chọn mẫu kịch bản khởi động, kiểm tra chi phí MCU và bấm **Bắt Đầu Sản Xuất**.
`,
};

export const SOP_02_ONBOARDING: RunbookContent = {
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
1. In DNS provider, add a CNAME record: \`studio\` -> \`sophia.agencyos.network\`.
2. In Sophia Admin: Navigate to \`/admin/custom-domains\` and add your hostname.
3. Verification probe will validate SSL issuance within 5 minutes.

## 2. White-Label Theme Customization
Upload agency assets under \`/dashboard/settings/branding\` (Primary Brand Color, Logo URL, Favicon, Watermark).
`,
  contentVi: `# 02. Thiết Lập Studio & Thương Hiệu

## 1. Cấu Hình Tên Miền Riêng (CNAME)
1. Trong trang DNS, tạo bản ghi CNAME: \`studio\` -> \`sophia.agencyos.network\`.
2. Trong phần Quản trị Sophia: Vào \`/admin/custom-domains\` và thêm tên miền.
3. Hệ thống sẽ tự động kích hoạt SSL trong 5 phút.

## 2. Tùy Biến Giao Diện Thương Hiệu
Tải lên tài nguyên nhận diện tại \`/dashboard/settings/branding\` (Màu sắc chủ đạo, Logo Agency, Watermark).
`,
};

export const SOPS_01_TO_03: RunbookContent[] = [
  SOP_01_QUICKSTART,
  SOP_02_ONBOARDING,
  SOP_03_BYOK,
];
