/**
 * guide-backend-pillars-part1.ts
 * Pillars 1 to 4: BYOK, Hybrid Video, Affiliate Dual-Domain, CEO Governance.
 * Layer: seed/guide
 */

import type { BackendPillar } from './guide-backend-pillars';

export const GUIDE_BACKEND_PILLARS_PART1: readonly BackendPillar[] = [
  {
    id: 'byok-keys',
    number: 1,
    icon: '🔑',
    badge: 'BYOK 0% Markup',
    title: {
      vi: 'Quản Trị Khóa & Danh Tính (BYOK)',
      en: 'BYOK & Identity Management',
    },
    tag: {
      vi: '8+ Nhà cung cấp AI',
      en: '8+ AI Providers',
    },
    description: {
      vi: 'Khách hàng tự nhập chìa khóa API qua Setup Wizard một lần duy nhất. Nền tảng không bao giờ lưu trữ khóa dạng thô hay đội giá token qua credit trung gian.',
      en: 'Customers enter their own API keys via Setup Wizard once. The platform never stores plaintext keys or marks up token prices via intermediate credits.',
    },
    capabilities: [
      { vi: 'Hỗ trợ OpenRouter, ElevenLabs, HeyGen, D-ID, fal.ai, Replicate, NOWPayments, PayOS', en: 'Supports OpenRouter, ElevenLabs, HeyGen, D-ID, fal.ai, Replicate, NOWPayments, PayOS' },
      { vi: 'Circuit Breaker tự động ngắt khi provider báo AUTH_FAILURE hoặc RATE_LIMIT', en: 'Circuit Breaker automatically trips on AUTH_FAILURE or RATE_LIMIT' },
      { vi: 'Mã hóa đối xứng cấp trường trên Cloudflare D1 với cơ chế cô lập Tenant tuyệt đối', en: 'Field-level symmetric encryption on Cloudflare D1 with strict tenant isolation' },
    ],
    representativeRoutes: [
      '/api/setup-wizard/save-credentials',
      '/api/setup-wizard/validate-key',
      '/api/user/byok',
      '/api/admin/circuit-breaker/reset',
    ],
    representativeJobs: [
      'token-refresh-cron.ts',
      'key-rotation-reencrypt.ts',
    ],
    safetyPillar: {
      vi: 'Chống rò rỉ khóa: Không có khóa nào lộ ra log hay client-side bundle.',
      en: 'Key Leak Prevention: Zero keys exposed to logs or client-side bundles.',
    },
  },
  {
    id: 'hybrid-video',
    number: 2,
    icon: '🎬',
    badge: '0% Hallucination',
    title: {
      vi: 'Dây Chuyền Dựng Video Hybrid Scene-Graph',
      en: 'Hybrid Scene-Graph Video Engine',
    },
    tag: {
      vi: '51 Ngành Nghề Đa Ngôn Ngữ',
      en: '51 Multilingual Niches',
    },
    description: {
      vi: 'Sản xuất video AI quy mô lớn không lộ mặt. Kết hợp video Avatar, giọng đọc biểu cảm và các thẻ dữ liệu Edge SVG Data Cards để triệt tiêu 100% ảo giác số liệu.',
      en: 'Scale faceless AI video production. Combines avatar video, emotive voices, and Edge SVG Data Cards to eliminate 100% of numerical hallucinations.',
    },
    capabilities: [
      { vi: 'Kịch bản SEO 51 ngách, tổng hợp giọng đọc ElevenLabs/Edge-TTS đa cảm xúc', en: 'SEO scripting for 51 niches, ElevenLabs/Edge-TTS voice synthesis' },
      { vi: 'Ghép phụ đề động .vtt, chèn watermark bản quyền và đóng gói FFmpeg tự động', en: 'Dynamic .vtt subtitle merging, watermark branding, automated FFmpeg assembly' },
      { vi: 'Tự động tạo 3 biến thể Thumbnail A/B và tối ưu hóa khung hình theo tỷ lệ giữ chân', en: 'Generates 3 A/B thumbnail variants and optimizes retention curves' },
    ],
    representativeRoutes: [
      '/api/v1/video/autonomous',
      '/api/videos',
      '/api/video-templates',
      '/api/voice/clone',
    ],
    representativeJobs: [
      'autonomous-video-pipeline-job.ts',
      'video-splittest-evaluation-job.ts',
      'thumbnail-ab-selector.ts',
    ],
    safetyPillar: {
      vi: '0% Hallucination: Biểu đồ tài chính và tỷ lệ phần trăm được kết xuất bằng mã nguồn SVG thật.',
      en: '0% Hallucination: Financial charts and percentages rendered via raw deterministic SVG.',
    },
  },
  {
    id: 'affiliate-dual-domain',
    number: 3,
    icon: '💰',
    badge: '100% Thuộc Về Bạn',
    title: {
      vi: 'Cỗ Máy Affiliate 10 Mạng & Domain B',
      en: '10-Network Affiliate & Domain B Engine',
    },
    tag: {
      vi: '0% Phí Nền Tảng (Domain B)',
      en: '0% Platform Fee (Domain B)',
    },
    description: {
      vi: 'Tích hợp 10 mạng lưới tiếp thị liên kết hàng đầu. Tách biệt rạch ròi Domain A (hoa hồng nền tảng) và Domain B (100% hoa hồng trực tiếp thuộc về Workspace của bạn).',
      en: 'Integrates 10 top affiliate networks. Clean separation between Domain A (platform cut) and Domain B (100% workspace commission).',
    },
    capabilities: [
      { vi: 'Hỗ trợ Impact, PartnerStack, Binance, Bybit, Bitget, OKX, Coinbase, CJ, ShareASale, ClickBank', en: 'Supports Impact, PartnerStack, Binance, Bybit, Bitget, OKX, Coinbase, CJ, ShareASale, ClickBank' },
      { vi: 'Ràng buộc CHECK (platform_fee_cents = 0) tại cơ sở dữ liệu cho toàn bộ giao dịch Domain B', en: 'Database CHECK (platform_fee_cents = 0) constraint across all Domain B transactions' },
      { vi: 'Shortlink thông minh /r/{code} tại Edge với khả năng định danh SubID và chống gian lận bot', en: 'Smart /r/{code} edge shortlinks with SubID tracking and bot fraud mitigation' },
    ],
    representativeRoutes: [
      '/api/affiliate-discovery',
      '/api/postback/[network] (Canonical)',
      '/api/webhooks/saas-crypto/[network] (Legacy Compat)',
      '/api/r/[code]',
    ],
    representativeJobs: [
      'auto-discover-affiliates.ts',
      'conversion-to-ledger.ts',
      'affiliate-nightly-risk.ts',
    ],
    safetyPillar: {
      vi: 'Bảo vệ nguồn thu: Sổ cái bất biến Event Sourcing, không bao giờ trừ chiết khấu trên Domain B.',
      en: 'Revenue Protection: Immutable Event Sourcing ledger, zero platform deduction on Domain B.',
    },
  },
  {
    id: 'ceo-governance',
    number: 4,
    icon: '🛡️',
    badge: 'Mã Băm Bất Biến',
    title: {
      vi: 'Cổng Phê Duyệt Giám Đốc (CEO Governance)',
      en: 'CEO Approval Governance Gate',
    },
    tag: {
      vi: 'Khóa SHA-256 Chống Sửa Trộm',
      en: 'Tamper-Proof SHA-256 Lock',
    },
    description: {
      vi: 'Mọi chiến dịch tự động trước khi xuất bản hoặc tạo link tiếp thị đều phải qua Cổng duyệt của CEO với chữ ký mã băm SHA-256 bất biến trên toàn bộ nội dung.',
      en: 'Every autonomous campaign must pass the CEO Governance Gate with a tamper-proof SHA-256 payload hash before publishing or link creation.',
    },
    capabilities: [
      { vi: 'Khóa chặt payload_sha256; từ chối xuất bản ngay lập tức nếu nội dung bị thay đổi sau khi duyệt', en: 'Locks payload_sha256; instantly rejects publishing if content drifts after approval' },
      { vi: 'Cơ chế tự động hủy chiến dịch quá hạn (Approval Timeout Cron) để bảo vệ ngân sách', en: 'Automated timeout reaper (Approval Timeout Cron) to guard operational budgets' },
      { vi: 'Nhật ký kiểm toán Audit Ledger không thể xóa sửa lưu vết thời gian và người phê duyệt', en: 'Append-only Audit Ledger preserving timestamp and approver identity' },
    ],
    representativeRoutes: [
      '/api/approvals',
      '/api/approvals/[id]',
      '/api/publish/approve',
      '/api/audit',
    ],
    representativeJobs: [
      'agent-approval-gate.ts',
      'approval-timeout-cron.ts',
      'agent-rollback-cron.ts',
    ],
    safetyPillar: {
      vi: 'An toàn thương hiệu: Đảm bảo không có video hay liên kết nào ra mắt mà không có sự đồng thuận của CEO.',
      en: 'Brand Safety: Guarantees zero unverified videos or links reach live distribution channels.',
    },
  },
];
