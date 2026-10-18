/**
 * Open-Core vs. Commercial SaaS Module & Feature Manifest
 *
 * Classifies Sophia AI Factory capabilities across:
 * 1. COMMUNITY (Apache-2.0 — Free Self-Hosted Open-Core)
 * 2. CLOUD_SAAS (Managed Cloud Subscription — BASIC $199, PREMIUM $399, ENTERPRISE $799/mo)
 * 3. ENTERPRISE_MASTER (Commercial / FSL-1.1 — ENTERPRISE $799/mo or MASTER $4,999 Handover)
 *
 * Layer: seed/config
 * @module seed/config/open-core-manifest
 */

import type {
  SophiaEdition,
  LicenseScopeTier,
  SophiaModuleFeatureId,
  OpenCoreFeatureSpec,
} from './open-core-manifest-types';

export type {
  SophiaEdition,
  LicenseScopeTier,
  SophiaModuleFeatureId,
  OpenCoreFeatureSpec,
};

const PRICING_URL = 'https://sophia.agencyos.network/pricing';
const APACHE = 'Apache-2.0' as const;
const COMMERCIAL = 'LicenseRef-Sophia-Commercial-FSL-1.1' as const;

export const OPEN_CORE_FEATURES: Readonly<Record<SophiaModuleFeatureId, OpenCoreFeatureSpec>> = {
  byok_setup_wizard: {
    id: 'byok_setup_wizard', scope: 'COMMUNITY', licenseSpdx: APACHE, minPaidTier: 'FREE',
    modulePaths: ['src/app/api/setup-wizard', 'src/tree/byok', 'src/tree/credentials'],
    titleVi: 'Trình cài đặt BYOK (Tự nhập khóa API)', titleEn: 'BYOK Self-Serve Setup Wizard',
    summaryVi: 'Mã hóa khóa API (OpenRouter, ElevenLabs, HeyGen, D-ID) bằng AES-256-GCM.',
    summaryEn: 'Encrypt your own AI keys (OpenRouter, ElevenLabs, HeyGen, D-ID) via AES-256-GCM.',
    upgradeCtaUrl: PRICING_URL,
  },
  bilingual_ask_router: {
    id: 'bilingual_ask_router', scope: 'COMMUNITY', licenseSpdx: APACHE, minPaidTier: 'FREE',
    modulePaths: ['src/tree/ask'],
    titleVi: 'Bộ định tuyến ngôn ngữ tự nhiên /ask & 4 Cố Vấn', titleEn: 'Bilingual /ask Intent Router & 4-Advisor Consultation',
    summaryVi: 'Phân loại 10 chủ đích VI/EN và hội đồng 4 cố vấn kiến trúc.',
    summaryEn: '10 canonical bilingual intents and 4-Advisor architectural consultation.',
    upgradeCtaUrl: PRICING_URL,
  },
  single_channel_video_studio: {
    id: 'single_channel_video_studio', scope: 'COMMUNITY', licenseSpdx: APACHE, minPaidTier: 'FREE',
    modulePaths: ['src/seed/ai', 'src/forest/inngest/functions/video-generate.ts'],
    titleVi: 'Xưởng tạo Video AI 1 kênh (Open-Core)', titleEn: 'Single-Channel AI Video Studio (Open-Core)',
    summaryVi: 'Tạo kịch bản, giọng đọc TTS và kết xuất video cơ bản với khóa BYOK cá nhân.',
    summaryEn: 'Script generation, TTS voiceover, and single-workspace video rendering with BYOK.',
    upgradeCtaUrl: PRICING_URL,
  },
  telegram_bot_commands: {
    id: 'telegram_bot_commands', scope: 'COMMUNITY', licenseSpdx: APACHE, minPaidTier: 'FREE',
    modulePaths: ['src/tree/telegram'],
    titleVi: 'Điều khiển chiến dịch qua Telegram Bot', titleEn: 'Telegram Bot Command Interface',
    summaryVi: 'Hỗ trợ các lệnh /campaign, /status, /results cho kênh cá nhân.',
    summaryEn: 'Supports /campaign, /status, /results webhook commands.',
    upgradeCtaUrl: PRICING_URL,
  },
  managed_social_oauth_relay: {
    id: 'managed_social_oauth_relay', scope: 'CLOUD_SAAS', licenseSpdx: COMMERCIAL, minPaidTier: 'PREMIUM',
    modulePaths: ['src/land/social', 'src/tree/social/publisher'],
    titleVi: 'Đăng tải đa nền tảng tự động (TikTok, YouTube Shorts, IG Reels)', titleEn: 'Managed Multi-Platform Social Direct Publisher',
    summaryVi: 'Sử dụng OAuth App đã được duyệt sẵn trên Sophia Cloud kèm bộ điều nhịp chống khóa kênh.',
    summaryEn: 'Pre-approved TikTok/YouTube/Meta OAuth apps on Sophia Cloud with anti-ban pacing.',
    upgradeCtaUrl: `${PRICING_URL}?feature=social-publisher`,
  },
  growth_triad_bandit_kelly: {
    id: 'growth_triad_bandit_kelly', scope: 'CLOUD_SAAS', licenseSpdx: COMMERCIAL, minPaidTier: 'PREMIUM',
    modulePaths: ['src/land/growth', 'src/land/growth-v13', 'src/land/growth-v14'],
    titleVi: 'Bộ ba tăng trưởng tự hành (Thompson Sampling MAB & Half-Kelly)', titleEn: 'Autonomous Growth Triad (MAB Optimizer & Half-Kelly Capital Allocator)',
    summaryVi: 'Tối ưu hóa A/B tiêu đề và phân bổ ngân sách tự động theo toán học định lượng.',
    summaryEn: 'Quantitative A/B hook optimization and Fractional Half-Kelly budget allocation.',
    upgradeCtaUrl: `${PRICING_URL}?feature=growth-triad`,
  },
  affiliate_attribution_payouts: {
    id: 'affiliate_attribution_payouts', scope: 'CLOUD_SAAS', licenseSpdx: COMMERCIAL, minPaidTier: 'BASIC',
    modulePaths: ['src/land/affiliates', 'src/land/payouts'],
    titleVi: 'Đối soát hoa hồng Affiliate & Chi trả USDT tự động', titleEn: 'Multi-Network Affiliate Attribution & Automated USDT Payouts',
    summaryVi: 'Theo dõi chuyển đổi ClickBank/Awin và tự động thanh toán hoa hồng đa tầng.',
    summaryEn: 'Real-time postback attribution and automated crypto/fiat partner payouts.',
    upgradeCtaUrl: `${PRICING_URL}?feature=affiliate-engine`,
  },
  multi_tenant_saas_billing: {
    id: 'multi_tenant_saas_billing', scope: 'CLOUD_SAAS', licenseSpdx: COMMERCIAL, minPaidTier: 'ENTERPRISE',
    modulePaths: ['src/land/billing', 'src/tree/billing/invoices'],
    titleVi: 'Hệ thống thu phí SaaS đa thuê bao (NOWPayments & PayOS)', titleEn: 'Multi-Tenant SaaS Billing & E-Invoice Engine',
    summaryVi: 'Thu phí định kỳ bằng USDT/VNĐ, xử lý dunning và xuất hóa đơn điện tử song ngữ.',
    summaryEn: 'Subscription billing via NOWPayments/PayOS, dunning state machine, and bilingual e-invoices.',
    upgradeCtaUrl: `${PRICING_URL}?feature=saas-billing`,
  },
  white_label_agency_portal: {
    id: 'white_label_agency_portal', scope: 'ENTERPRISE_MASTER', licenseSpdx: COMMERCIAL, minPaidTier: 'ENTERPRISE',
    modulePaths: ['src/forest/admin/white-label', 'src/forest/agency/review-portal'],
    titleVi: 'Cổng Agency White-Label & Quản lý Subaccount', titleEn: 'White-Label Agency Subaccount Portal',
    summaryVi: 'Tùy biến thương hiệu riêng, quản lý khách hàng con và cổng duyệt video.',
    summaryEn: 'Custom agency branding, isolated client subaccounts, and video approval portal.',
    upgradeCtaUrl: `${PRICING_URL}?tier=ENTERPRISE`,
  },
  custom_domain_provisioning: {
    id: 'custom_domain_provisioning', scope: 'ENTERPRISE_MASTER', licenseSpdx: COMMERCIAL, minPaidTier: 'ENTERPRISE',
    modulePaths: ['src/tree/custom-domains'],
    titleVi: 'Tên miền riêng & SSL tự động (Custom Domains)', titleEn: 'Custom Domain & Automated Edge SSL Provisioning',
    summaryVi: 'Gắn tên miền riêng của Agency với xác thực DNS TXT/CNAME tự động.',
    summaryEn: 'Bind custom agency domains with automated DNS TXT/CNAME verification.',
    upgradeCtaUrl: `${PRICING_URL}?tier=ENTERPRISE`,
  },
  merkle_ipo_audit_vault: {
    id: 'merkle_ipo_audit_vault', scope: 'ENTERPRISE_MASTER', licenseSpdx: COMMERCIAL, minPaidTier: 'ENTERPRISE',
    modulePaths: ['src/tree/finance/merkle'],
    titleVi: 'Sổ cái kiểm toán bất biến Merkle Tree (Chuẩn SOC2 / IPO)', titleEn: 'Cryptographic Merkle Audit Vault (SOC2 / IPO Compliance)',
    summaryVi: 'Chuỗi băm SHA-256 + chữ ký số HMAC-SHA256 chống chỉnh sửa dữ liệu tài chính.',
    summaryEn: 'Tamper-evident SHA-256 hash chain and HMAC-SHA256 financial audit ledger.',
    upgradeCtaUrl: `${PRICING_URL}?tier=ENTERPRISE`,
  },
  day1_master_handover_suite: {
    id: 'day1_master_handover_suite', scope: 'ENTERPRISE_MASTER', licenseSpdx: COMMERCIAL, minPaidTier: 'MASTER',
    modulePaths: ['src/tree/handover'],
    titleVi: 'Bộ công cụ bàn giao Master ($4,999 Sovereign Handover)', titleEn: 'Day-1 Master Sovereign Handover Suite ($4,999)',
    summaryVi: 'Kiểm định 10 cổng hạ tầng và bàn giao toàn quyền vận hành hệ thống.',
    summaryEn: '10-checkpoint infrastructure certification and turnkey sovereign handover.',
    upgradeCtaUrl: `${PRICING_URL}?tier=MASTER`,
  },
};
