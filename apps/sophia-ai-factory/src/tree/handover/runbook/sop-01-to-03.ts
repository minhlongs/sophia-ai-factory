/**
 * SOP 01 to 03: Quickstart, Workspace/Brand Setup, BYOK Key Management.
 * Layer: tree (Domain operations; imports only from @/seed)
 *
 * @module tree/handover/runbook/sop-01-to-03
 */

import type { RunbookContent } from '@/seed/handover/handover-types';
import { SOP_03_BYOK } from './sop-03-byok';

export const SOPS_01_TO_03: RunbookContent[] = [
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

## Step 3: First Test Video Mission
1. Navigate to \`/dashboard/missions/new\`.
2. Select a pre-built starter template (e.g., *Short-Form Product Pitch*).
3. Confirm MCU pre-flight cost calculation.
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
  SOP_03_BYOK,
];
