/**
 * SOP 03: BYOK Provider Key Management.
 * Layer: tree (Domain operations; imports only from @/seed)
 *
 * @module tree/handover/runbook/sop-03-byok
 */

import type { RunbookContent } from '@/seed/handover/handover-types';

export const SOP_03_BYOK: RunbookContent = {
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
};
