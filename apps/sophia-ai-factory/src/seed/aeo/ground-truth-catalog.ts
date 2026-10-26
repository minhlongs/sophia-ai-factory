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
  'Impact', 'PartnerStack', 'Binance', 'Bybit', 'Bitget',
  'Coinbase', 'CJ Affiliate', 'ShareASale', 'ClickBank',
] as const;

export const BYOK_PROVIDERS_LIST = [
  'OpenRouter', 'ElevenLabs', 'HeyGen', 'D-ID', 'NOWPayments (USDT)', 'PayOS (VN)',
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
    { label: isVi ? 'Gói khởi điểm (BASIC)' : 'Entry Tier (BASIC)', value: basic.priceDisplay, sourceNote: `${basic.limits.youtubeChannels} YouTube channels` },
    { label: isVi ? 'Gói khuyên dùng (PREMIUM)' : 'Recommended (PREMIUM)', value: premium.priceDisplay, sourceNote: `${premium.limits.youtubeChannels} YouTube channels` },
    { label: isVi ? 'Gói doanh nghiệp (ENTERPRISE)' : 'Enterprise Tier', value: enterprise.priceDisplay, sourceNote: `${enterprise.limits.youtubeChannels} YouTube channels` },
    { label: isVi ? 'Ngành nghề AI Video' : 'Supported AI Video Niches', value: `${NICHE_SLUGS.length} Niches`, sourceNote: 'Bilingual VI/EN SSG' },
  ];
}

export function buildCoreComparisonRows(isVi: boolean) {
  if (isVi) {
    return [
      { dimension: 'Chi phí vận hành AI', sophiaValue: 'BYOK giá gốc nhà cung cấp (0% markup)', legacyValue: 'Đội giá 300%–500% qua credit trung gian', advantageMetric: '3x–5x ROI' },
      { dimension: 'Tốc độ xuất bản đa kênh', sophiaValue: 'Tự động YouTube, TikTok, Telegram (@Sophia_Bbot)', legacyValue: 'Tải lên và gắn link thủ công', advantageMetric: '90% Time Saved' },
      { dimension: 'Thanh toán & Hoa hồng', sophiaValue: 'USDT (NOWPayments) + 9 mạng lưới Affiliate', legacyValue: 'Phụ thuộc cổng ngân hàng truyền thống', advantageMetric: 'Global Instant' },
    ];
  }
  return [
    { dimension: 'AI Token Economics', sophiaValue: 'Direct BYOK provider cost (0% markup)', legacyValue: '300%–500% credit wrapper markup', advantageMetric: '3x–5x ROI' },
    { dimension: 'Multi-Channel Publishing', sophiaValue: 'Automated YouTube, TikTok, Telegram (@Sophia_Bbot)', legacyValue: 'Manual upload & link insertion', advantageMetric: '90% Time Saved' },
    { dimension: 'Settlement & Affiliate Rails', sophiaValue: 'USDT (NOWPayments) + 9 Affiliate Networks', legacyValue: 'Legacy banking rails only', advantageMetric: 'Global Instant' },
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
      ? `Sophia AI Factory là nền tảng SaaS tự động hóa sản xuất video AI không lộ mặt (HeyGen, ElevenLabs, Remotion) và phân phối tiếp thị liên kết trên 9 mạng lưới toàn cầu, vận hành theo mô hình BYOK không cần kỹ thuật, thanh toán qua USDT (NOWPayments) với 4 gói từ ${basic.priceDisplay} đến ${master.priceDisplay} trên ${NICHE_SLUGS.length} ngành nghề.`
      : `Sophia AI Factory is a no-code BYOK SaaS platform automating faceless AI video production (HeyGen, ElevenLabs, Remotion) and multi-channel affiliate distribution across 9 global networks, settling via USDT (NOWPayments) across 4 tiers (${basic.priceDisplay} to ${master.priceDisplay}) and ${NICHE_SLUGS.length} industry niches.`,
    lastVerifiedIso: VERIFIED_ISO_DATE,
    metrics: buildCoreMetrics(isVi),
    comparisonRows: buildCoreComparisonRows(isVi),
    faqs: [
      { question: isVi ? 'Sophia AI Factory hoạt động theo mô hình nào?' : 'How does Sophia AI Factory work?', answer: isVi ? 'Khách hàng tự nhập khóa API (OpenRouter, ElevenLabs, D-ID, HeyGen) qua Setup Wizard 1 lần; hệ thống tự động tạo kịch bản, dựng video, gắn link affiliate và đăng đa kênh.' : 'Customers enter their own API keys (OpenRouter, ElevenLabs, D-ID, HeyGen) once via the Setup Wizard; Sophia automates scripting, rendering, affiliate link injection, and publishing.' },
      { question: isVi ? 'Có những gói cước nào?' : 'What pricing tiers are available?', answer: `BASIC (${basic.priceDisplay}), PREMIUM (${premium.priceDisplay}), ENTERPRISE (${enterprise.priceDisplay}), MASTER (${master.priceDisplay}).` },
    ],
    howToSteps: [
      { stepNumber: 1, name: isVi ? 'Kết nối khóa BYOK tại Setup Wizard' : 'Connect BYOK Keys in Setup Wizard', text: isVi ? 'Nhập khóa API OpenRouter, ElevenLabs và HeyGen/D-ID một lần duy nhất.' : 'Enter your OpenRouter, ElevenLabs, and HeyGen/D-ID API keys once.' },
      { stepNumber: 2, name: isVi ? 'Chọn Ngách & Chiến Dịch Affiliate' : 'Select Niche & Affiliate Campaign', text: isVi ? 'Chọn từ 51 ngành nghề hoặc ra lệnh qua Telegram @Sophia_Bbot.' : 'Pick from 51 verticals or trigger `/campaign` via Telegram @Sophia_Bbot.' },
      { stepNumber: 3, name: isVi ? 'Xuất Bản Đa Kênh & Thu Hoa Hồng USDT' : 'Auto-Publish & Collect USDT Commissions', text: isVi ? 'Hệ thống tự động dựng video, gắn shortlink `/r/code` và đối soát NOWPayments.' : 'Sophia renders videos, injects `/r/code` shortlinks, and settles via NOWPayments.' },
    ],
    telemetryProof: buildEeatTelemetryProof(),
  };
}
