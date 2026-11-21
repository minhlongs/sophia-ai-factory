import { OPTION_A_PILOT_COPY } from '@/seed/config/tiers/option-a-pilot-contract';
/**
 * Canonical Ground-Truth Catalog for Sophia AI Factory AEO/GEO.
 * Reads directly from TIER_CONFIGS and NICHE_SLUGS so HTML, Markdown, and JSON-LD never drift.
 * Layer: seed/aeo
 */

import { TIER_CONFIGS } from '@/seed/config/tiers/tier-configs';
import { UNIFIED_TIERS } from '@/seed/config/tiers/unified-limits';
import { NICHE_SLUGS } from '@/seed/config/niche-list';
import type { Tier } from '@/seed/types';
import { buildEeatTelemetryProof } from './eeat-telemetry-proof';
import type { AeoLocale, AgentDiscoveryManifest, DualReadPagePayload } from './aeo-types';

export const SOPHIA_BASE_URL = 'https://sophia.agencyos.network';
export const VERIFIED_ISO_DATE = '2026-10-26';

export const AFFILIATE_NETWORKS_LIST = [
  'Impact', 'PartnerStack', 'Binance', 'Bybit', 'Bitget', 'OKX', 'Coinbase', 'CJ Affiliate', 'ShareASale', 'ClickBank',
] as const;

export const BYOK_PROVIDERS_LIST = [
  'OpenRouter', 'ElevenLabs', 'HeyGen', 'D-ID', 'fal.ai', 'Replicate', 'NOWPayments (USDT)', 'PayOS (VN)',
] as const;

export function getVerifiedTierSummary(tier: Tier) {
  const cfg = TIER_CONFIGS[tier];
  const unified = UNIFIED_TIERS[tier];
  return {
    tier, name: cfg.name, priceUsd: cfg.price, priceDisplay: cfg.priceDisplay,
    monthlyMcu: unified.mcuMonthly, youtubeChannels: cfg.limits.youtubeChannels,
    videoTemplates: cfg.limits.videoTemplates, supportMonths: cfg.limits.supportMonths,
  };
}

export function getAllVerifiedTiersSummary() {
  return (['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER'] as Tier[]).map(getVerifiedTierSummary);
}

export function buildAgentDiscoveryManifest(): AgentDiscoveryManifest {
  return {
    schemaVersion: '2027.1',
    name: 'Sophia AI Factory',
    canonicalUrl: SOPHIA_BASE_URL,
    description: 'Autonomous BYOK AI Video & Affiliate RaaS Factory on Cloudflare Workers with USDT settlement.',
    locales: ['vi', 'en'],
    openApiSpecUrl: `${SOPHIA_BASE_URL}/api/openapi.json`,
    indexNowUrl: `${SOPHIA_BASE_URL}/api/aeo/indexnow`,
    dualReadProtocol: {
      acceptHeader: 'text/markdown',
      markdownSuffix: '.md',
      llmsIndexUrl: `${SOPHIA_BASE_URL}/llms.txt`,
      llmsFullUrl: `${SOPHIA_BASE_URL}/llms-full.txt`,
    },
    billingRails: ['NOWPayments (USDT Crypto)', 'PayOS (Vietnam Domestic)'],
    byokProviders: [...BYOK_PROVIDERS_LIST],
    affiliateNetworks: [...AFFILIATE_NETWORKS_LIST],
    supportedNicheCount: NICHE_SLUGS.length,
    endpoints: [
      { path: '/llms.txt', method: 'GET', contentType: 'text/plain; charset=utf-8', description: 'Concise LLM index of Sophia AI Factory', authRequired: false },
      { path: '/llms-full.txt', method: 'GET', contentType: 'text/markdown; charset=utf-8', description: 'Complete ground-truth documentation, tiers, and 51 niches', authRequired: false },
      { path: '/.well-known/agent.json', method: 'GET', contentType: 'application/json', description: 'Machine-readable agent capability manifest', authRequired: false },
      { path: '/api/openapi.json', method: 'GET', contentType: 'application/json', description: 'OpenAPI 3.1 public agent action schema', authRequired: false },
      { path: '/api/aeo/markdown', method: 'GET', contentType: 'text/markdown; charset=utf-8', description: 'Dual-Read Markdown projection for any public route', authRequired: false },
      { path: '/api/aeo/indexnow', method: 'GET', contentType: 'text/plain; charset=utf-8', description: 'Deterministic IndexNow key verification endpoint', authRequired: false },
      { path: '/api/version', method: 'GET', contentType: 'application/json', description: 'Edge deployment SHA verification endpoint', authRequired: false },
    ],
  };
}

export function buildCoreMetrics(isVi: boolean) {
  const { BASIC: basic, PREMIUM: premium, ENTERPRISE: enterprise } = TIER_CONFIGS;
  return [
    {
      label: isVi ? 'Gói thử nghiệm 14 ngày (Option A)' : '14-Day Paid Pilot (Option A)',
      value: isVi ? '1.990.000 VND' : '1,990,000 VND',
      sourceNote: OPTION_A_PILOT_COPY[isVi ? 'vi' : 'en'].scope + ' ' + OPTION_A_PILOT_COPY[isVi ? 'vi' : 'en'].refund,
    },
    { label: isVi ? 'Gói khởi điểm (BASIC)' : 'Entry Tier (BASIC)', value: basic.priceDisplay, sourceNote: isVi ? 'Kịch bản AI & chiến dịch · dựng video từ Growth' : 'AI scripts & campaigns · video rendering on Growth+' },
    { label: isVi ? 'Gói khuyên dùng (PREMIUM / Growth)' : 'Recommended (PREMIUM / Growth)', value: premium.priceDisplay, sourceNote: isVi ? 'Bao gồm dựng video cloud' : 'Includes cloud video rendering' },
    { label: isVi ? 'Gói doanh nghiệp (ENTERPRISE)' : 'Enterprise Tier', value: enterprise.priceDisplay, sourceNote: `${enterprise.limits.youtubeChannels} workspace channels` },
  ];
}

export function buildCoreComparisonRows(isVi: boolean) {
  if (isVi) {
    return [
      { dimension: 'Chi phí vận hành AI', sophiaValue: 'BYOK trả trực tiếp cho nhà cung cấp AI (0% phí trung gian Sophia)', legacyValue: 'Đội giá 300%–500% qua credit trung gian', advantageMetric: 'Minh bạch chi phí' },
      { dimension: 'Quy trình nội dung & chiến dịch', sophiaValue: 'Lập kế hoạch chiến dịch, tạo kịch bản AI & tài sản affiliate (dựng video từ Growth+)', legacyValue: 'Phối hợp rời rạc nhiều công cụ thủ công', advantageMetric: 'Tập trung 1 workspace' },
      { dimension: 'Thanh toán & Gói thử nghiệm', sophiaValue: `PayOS VietQR / Chuyển khoản thủ công (1.990.000 VND) + USDT (NOWPayments)`, legacyValue: 'Bắt buộc cam kết dài hạn ngay từ đầu', advantageMetric: 'Thử nghiệm 14 ngày' },
    ];
  }
  return [
    { dimension: 'AI Token Economics', sophiaValue: 'Direct BYOK billing from your AI providers (0% Sophia markup)', legacyValue: '300%–500% credit wrapper markup', advantageMetric: 'Transparent Cost' },
    { dimension: 'Campaign & Script Workflow', sophiaValue: 'AI campaign planning, scripting & affiliate assets (cloud video rendering on Growth+)', legacyValue: 'Disconnected manual tools', advantageMetric: 'Unified Workspace' },
    { dimension: 'Payment & Pilot Rails', sophiaValue: `PayOS VietQR / Manual Bank Transfer (1,990,000 VND) + USDT (NOWPayments)`, legacyValue: 'Forced long-term commitment upfront', advantageMetric: '14-Day Pilot' },
  ];
}

export function buildCorePagePayload(
  surface: 'home' | 'pricing' | 'guide' | 'affiliate' | 'status',
  locale: AeoLocale,
): DualReadPagePayload {
  const isVi = locale === 'vi';
  const { BASIC: basic, PREMIUM: premium, ENTERPRISE: enterprise, MASTER: master } = TIER_CONFIGS;
  const pathSuffix = surface === 'home' ? '' : `/${surface}`;

  return {
    pageKey: `${surface}-${locale}`,
    surface,
    locale,
    canonicalUrl: `${SOPHIA_BASE_URL}/${locale}${pathSuffix}`,
    title: isVi
      ? `Sophia AI Factory — Nhà Máy Video AI & Affiliate Tự Động (${surface.toUpperCase()})`
      : `Sophia AI Factory — Autonomous BYOK AI Video & Affiliate Engine (${surface.toUpperCase()})`,
    answerFirstSummary: isVi
      ? `Sophia AI Factory là nền tảng SaaS tự động hóa sản xuất video AI không lộ mặt theo kiến trúc Hybrid Scene-Graph (HeyGen, ElevenLabs, fal.ai, Replicate, Edge SVG Data Cards 0% Hallucination) và phân phối tiếp thị liên kết trên ${AFFILIATE_NETWORKS_LIST.length} mạng lưới toàn cầu, vận hành theo mô hình BYOK không cần kỹ thuật, thanh toán qua USDT (NOWPayments) với 4 gói từ ${basic.priceDisplay} đến ${master.priceDisplay} trên ${NICHE_SLUGS.length} ngành nghề.`
      : `Sophia AI Factory is a no-code BYOK SaaS platform automating faceless AI video production via Hybrid Scene-Graph (HeyGen, ElevenLabs, fal.ai, Replicate, 0% Hallucination Edge SVG Data Cards) and multi-channel affiliate distribution across ${AFFILIATE_NETWORKS_LIST.length} global networks, settling via USDT (NOWPayments) across 4 tiers (${basic.priceDisplay} to ${master.priceDisplay}) and ${NICHE_SLUGS.length} industry niches.`,
    lastVerifiedIso: VERIFIED_ISO_DATE,
    metrics: buildCoreMetrics(isVi),
    comparisonRows: buildCoreComparisonRows(isVi),
    faqs: [
      { question: isVi ? 'Sophia AI Factory hoạt động theo mô hình nào?' : 'How does Sophia AI Factory work?', answer: isVi ? 'Khách hàng kết nối khóa API BYOK (OpenRouter, v.v.) qua Setup Wizard và thanh toán chi phí API trực tiếp cho nhà cung cấp. Gói BASIC (gồm Pilot 14 ngày 1.990.000 VND / 500 MCU) hỗ trợ kịch bản AI, kế hoạch chiến dịch và tài sản affiliate; dựng video cloud có từ gói Growth (PREMIUM) trở lên.' : 'Customers connect their own BYOK API keys (OpenRouter, etc.) via Setup Wizard and pay AI provider usage directly to their providers. BASIC (including the 14-day Paid Pilot at 1,990,000 VND / 500 MCU) covers AI scripts, campaign planning, and affiliate assets; cloud video rendering is available on Growth (PREMIUM) and above.' },
      { question: isVi ? 'Có những gói cước nào?' : 'What pricing tiers are available?', answer: `BASIC Pilot 14d (1,990,000 VND / $79 · 500 MCU · 0 cloud video renders), BASIC (${basic.priceDisplay}), PREMIUM (${premium.priceDisplay}), ENTERPRISE (${enterprise.priceDisplay}), MASTER (${master.priceDisplay}).` },
    ],
    howToSteps: [
      { stepNumber: 1, name: isVi ? 'Kết nối khóa BYOK tại Setup Wizard' : 'Connect BYOK Keys in Setup Wizard', text: isVi ? 'Nhập khóa API của bạn (mã hóa AES-256-GCM). Nhà cung cấp AI thu phí trực tiếp theo tài khoản của bạn.' : 'Enter your own API keys (encrypted with AES-256-GCM). Your AI providers bill your connected accounts directly.' },
      { stepNumber: 2, name: isVi ? 'Chọn Ngách & Lập Chiến Dịch Affiliate' : 'Select Niche & Plan Affiliate Campaign', text: isVi ? 'Chọn từ 51 ngành nghề để tạo kịch bản AI, kế hoạch chiến dịch và shortlink `/r/code`.' : 'Pick from 51 verticals to generate AI scripts, campaign plans, and `/r/code` affiliate assets.' },
      { stepNumber: 3, name: isVi ? 'Xuất Bản Chủ Động & Nâng Cấp Khi Cần Dựng Video' : 'Publish Manually & Upgrade for Cloud Rendering', text: isVi ? 'Xuất kịch bản và tài sản chiến dịch để đăng lên kênh của bạn; nâng cấp lên Growth (PREMIUM)+ khi cần dựng video cloud.' : 'Export scripts and campaign assets to publish on your channels; upgrade to Growth (PREMIUM)+ when you need cloud video rendering.' },
    ],
    telemetryProof: buildEeatTelemetryProof(),
  };
}
