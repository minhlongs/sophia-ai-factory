/**
 * SOP 03: BYOK AI Key Management & Zero-Downtime Rotation.
 * Layer: tree (Domain operations; imports only from @/seed)
 *
 * @module tree/handover/runbook/sop-03-byok-key-rotation
 */

import type { RunbookContent } from '@/seed/handover/handover-types';

export const SOP_03_BYOK_ROTATION: RunbookContent = {
  id: 'sop-03',
  slug: 'byok-key-rotation',
  number: '03',
  titleEn: '03. BYOK AI Key Management & Zero-Downtime Rotation',
  titleVi: '03. Quản Lý & Xoay Vòng Khóa AI BYOK Không Gián Đoạn',
  summaryEn:
    'Safely store, verify, and rotate OpenRouter, ElevenLabs, HeyGen, and D-ID API keys using AES-256-GCM encryption.',
  summaryVi:
    'Lưu trữ, xác thực và xoay vòng khóa OpenRouter, ElevenLabs, HeyGen, D-ID an toàn với mã hóa AES-256-GCM.',
  category: 'Security & Governance',
  readTimeMinutes: 12,
  tags: ['byok', 'security', 'rotation', 'openrouter', 'elevenlabs', 'heygen'],
  author: 'Sophia Platform Engineering',
  lastVerified: '2026-09-20',
  contentEn: `# 03. BYOK AI Key Management & Zero-Downtime Rotation

## Architecture Overview
Sophia AI Factory enforces a **Bring-Your-Own-Key (BYOK)** doctrine. Every provider key is encrypted client-to-server using **AES-256-GCM** before persistence in Cloudflare D1 (\`user_api_keys\`).

## Step 1: Supported AI Providers
- **OpenRouter (\`openrouter\`)**: Primary LLM reasoning & script generation.
- **ElevenLabs (\`elevenlabs\`)**: High-retention neural voice synthesis.
- **D-ID (\`did\`) / HeyGen (\`heygen\`)**: Avatar lip-sync and presenter synthesis.
- **Fal.ai (\`fal\`) / Replicate (\`replicate\`)**: B-roll & visual asset generation.

## Step 2: Zero-Downtime Key Rotation Procedure
1. Open \`/dashboard/handover\` → **Credential Rotation** tab (or \`/dashboard/settings\`).
2. Generate a new API key in the upstream provider dashboard **before** revoking the old key.
3. Paste the new key into the rotation form and click **Verify & Rotate**.
4. Sophia performs a live ping probe against the provider endpoint before committing the encrypted cipher to D1.
5. Once status shows \`VERIFIED\`, safely delete the old key from the upstream provider console.
`,
  contentVi: `# 03. Quản Lý & Xoay Vòng Khóa AI BYOK Không Gián Đoạn

## Tổng Quan Kiến Trúc
Sophia AI Factory áp dụng nguyên tắc **Tự Trang Bị Khóa (BYOK)**. Mọi khóa API đều được mã hóa chuẩn **AES-256-GCM** trước khi lưu vào cơ sở dữ liệu Cloudflare D1 (\`user_api_keys\`).

## Bước 1: Danh Mục Nhà Cung Cấp Hỗ Trợ
- **OpenRouter (\`openrouter\`)**: Bộ não ngôn ngữ lớn (LLM) tạo kịch bản.
- **ElevenLabs (\`elevenlabs\`)**: Tổng hợp giọng đọc AI tự nhiên.
- **D-ID (\`did\`) / HeyGen (\`heygen\`)**: Tạo nhân vật ảo trình bày video.
- **Fal.ai (\`fal\`) / Replicate (\`replicate\`)**: Tạo hình ảnh và cảnh quay B-roll.

## Bước 2: Quy Trình Xoay Vòng Khóa Không Gián Đoạn
1. Truy cập \`/dashboard/handover\` → thẻ **Xoay Vòng Khóa** (hoặc \`/dashboard/settings\`).
2. Tạo khóa API mới trên trang quản trị của nhà cung cấp **trước khi** xóa khóa cũ.
3. Dán khóa mới vào biểu mẫu và nhấn **Xác Thực & Xoay Vòng**.
4. Hệ thống sẽ kiểm tra kết nối thực tế trước khi ghi đè bản mã hóa mới vào D1.
5. Sau khi trạng thái báo \`ĐÃ XÁC THỰC\`, bạn có thể hủy khóa cũ ở nhà cung cấp.
`,
};
