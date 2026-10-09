/**
 * SOP 01 to 03: Quickstart, Workspace/Brand Setup, BYOK Key Management.
 * Layer: tree (Domain operations; imports only from @/seed)
 *
 * @module tree/handover/runbook/sop-01-to-03
 */

import type { RunbookContent } from '@/seed/handover/handover-types';

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
];
