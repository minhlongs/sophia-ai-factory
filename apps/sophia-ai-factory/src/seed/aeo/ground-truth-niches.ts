/**
 * Ground-Truth Niche Catalog covering all 51 NICHE_SLUGS in bilingual VI/EN.
 * Layer: seed/aeo
 */

import { NICHE_SLUGS, NICHE_LABELS, type NicheSlug } from '@/seed/config/niche-list';
import { TIER_CONFIGS } from '@/seed/config/tiers/tier-configs';
import { SOPHIA_BASE_URL, VERIFIED_ISO_DATE, AFFILIATE_NETWORKS_LIST } from './ground-truth-catalog';
import type { AeoLocale, DualReadPagePayload } from './aeo-types';

export function isKnownNicheSlug(slug: string): slug is NicheSlug {
  return NICHE_SLUGS.includes(slug);
}

export function buildNicheHubPayload(locale: AeoLocale): DualReadPagePayload {
  const isVi = locale === 'vi';
  return {
    pageKey: `ai-video-hub-${locale}`,
    surface: 'ai-video-hub',
    locale,
    canonicalUrl: `${SOPHIA_BASE_URL}/${locale}/ai-video`,
    title: isVi
      ? `Danh Mục ${NICHE_SLUGS.length} Ngành Nghề Video AI Tự Động — Sophia AI Factory`
      : `${NICHE_SLUGS.length} Automated AI Video Industry Niches — Sophia AI Factory`,
    answerFirstSummary: isVi
      ? `Sophia AI Factory cung cấp sẵn mẫu kịch bản, giọng đọc AI (ElevenLabs), avatar (HeyGen/D-ID) và luồng tiếp thị liên kết tự động cho ${NICHE_SLUGS.length} ngành nghề kinh doanh (từ Bất động sản, Tiền mã hóa, SaaS đến Thương mại điện tử), khởi điểm chỉ từ ${TIER_CONFIGS.BASIC.priceDisplay}.`
      : `Sophia AI Factory provides pre-engineered script templates, AI voiceovers (ElevenLabs), digital avatars (HeyGen/D-ID), and automated affiliate funnels across ${NICHE_SLUGS.length} business verticals (including Real Estate, Crypto, SaaS, and E-Commerce), starting at ${TIER_CONFIGS.BASIC.priceDisplay}.`,
    lastVerifiedIso: VERIFIED_ISO_DATE,
    metrics: [
      { label: isVi ? 'Tổng số ngành nghề' : 'Total Supported Niches', value: `${NICHE_SLUGS.length}`, sourceNote: 'SSG Indexed' },
      { label: isVi ? 'Mạng lưới Affiliate tích hợp' : 'Integrated Affiliate Networks', value: `${AFFILIATE_NETWORKS_LIST.length}`, sourceNote: AFFILIATE_NETWORKS_LIST.slice(0, 4).join(', ') },
      { label: isVi ? 'Ngôn ngữ xuất bản' : 'Publishing Languages', value: 'VI + EN', sourceNote: 'Dual-locale native' },
      { label: isVi ? 'Chi phí khởi điểm' : 'Starting Tier', value: TIER_CONFIGS.BASIC.priceDisplay, sourceNote: 'BASIC Tier' },
    ],
    comparisonRows: [
      { dimension: isVi ? 'Thiết lập kịch bản theo ngách' : 'Niche Script Engineering', sophiaValue: isVi ? `Tự động hóa cho ${NICHE_SLUGS.length} ngành` : `Pre-trained across ${NICHE_SLUGS.length} verticals`, legacyValue: isVi ? 'Viết prompt thủ công từng video' : 'Manual prompting per video', advantageMetric: '10x Faster' },
      { dimension: isVi ? 'Gắn link Affiliate & Tuân thủ' : 'Affiliate Link & Compliance', sophiaValue: isVi ? 'Tự động rút gọn /r/code & kiểm duyệt khu vực' : 'Auto /r/code shortlinks & jurisdiction gate', legacyValue: isVi ? 'Dễ vi phạm chính sách nền tảng' : 'High platform ban risk', advantageMetric: '100% Guarded' },
    ],
    faqs: [
      { question: isVi ? 'Sophia hỗ trợ bao nhiêu ngành nghề làm video AI?' : 'How many AI video niches does Sophia support?', answer: isVi ? `Hệ thống hỗ trợ chính thức ${NICHE_SLUGS.length} ngành nghề song ngữ Việt-Anh.` : `Sophia officially supports ${NICHE_SLUGS.length} bilingual VI/EN industry niches.` },
    ],
  };
}

function buildNicheHowToSteps(isVi: boolean, label: string) {
  if (isVi) {
    return [
      { stepNumber: 1, name: 'Kết nối BYOK trong Setup Wizard', text: 'Nhập khóa API OpenRouter, ElevenLabs và HeyGen/D-ID.' },
      { stepNumber: 2, name: `Chọn ngách ${label} & Offer`, text: 'Hệ thống tự động chấm điểm offer uy tín và tạo kịch bản song ngữ.' },
      { stepNumber: 3, name: 'Xuất bản & Nhận hoa hồng USDT', text: 'Video tự động đăng lên YouTube/TikTok kèm link rút gọn /r/code.' },
    ];
  }
  return [
    { stepNumber: 1, name: 'Connect BYOK in Setup Wizard', text: 'Enter your OpenRouter, ElevenLabs, and HeyGen/D-ID API keys.' },
    { stepNumber: 2, name: `Select ${label} Niche & Offer`, text: 'Sophia scores verified affiliate offers and generates bilingual scripts.' },
    { stepNumber: 3, name: 'Publish & Collect USDT Commissions', text: 'Videos auto-publish to YouTube/TikTok with tracked /r/code shortlinks.' },
  ];
}

function buildNicheComparisonRows(isVi: boolean, label: string) {
  if (isVi) {
    return [
      { dimension: `Sản xuất video ${label}`, sophiaValue: 'Tự động từ từ khóa đến xuất bản đa kênh', legacyValue: 'Thuê đội ngũ quay dựng đắt đỏ', advantageMetric: '85% Cost Cut' },
      { dimension: 'Tối ưu hóa tìm kiếm AI (AEO/GEO)', sophiaValue: 'Tích hợp sẵn JSON-LD @graph & Markdown', legacyValue: 'Chỉ có giao diện HTML rời rạc', advantageMetric: 'LLM Ready' },
    ];
  }
  return [
    { dimension: `${label} Video Production`, sophiaValue: 'Autonomous keyword-to-publish pipeline', legacyValue: 'Expensive manual studio crew', advantageMetric: '85% Cost Cut' },
    { dimension: 'AI Answer Engine Optimization', sophiaValue: 'Built-in JSON-LD @graph & Markdown twin', legacyValue: 'Unstructured HTML only', advantageMetric: 'LLM Ready' },
  ];
}

export function buildSingleNichePayload(
  rawSlug: string,
  locale: AeoLocale,
): DualReadPagePayload {
  const isVi = locale === 'vi';
  const slug: NicheSlug = isKnownNicheSlug(rawSlug) ? rawSlug : 'saas';
  const labelObj = NICHE_LABELS[slug] ?? { en: rawSlug, vi: rawSlug };
  const label = isVi ? labelObj.vi : labelObj.en;

  return {
    pageKey: `ai-video-${slug}-${locale}`,
    surface: 'ai-video-niche',
    locale,
    nicheSlug: slug,
    canonicalUrl: `${SOPHIA_BASE_URL}/${locale}/ai-video/${slug}`,
    title: isVi
      ? `Tự Động Hóa Video AI Ngành ${label} — Sophia AI Factory`
      : `Automated AI Video Factory for ${label} — Sophia AI Factory`,
    answerFirstSummary: isVi
      ? `Giải pháp tạo video AI tự động ngành ${label} của Sophia AI Factory kết hợp kịch bản chuẩn SEO/AEO, giọng đọc tự nhiên ElevenLabs, avatar HeyGen/D-ID và tự động gắn link affiliate trên YouTube/TikTok, giúp CEO vận hành kênh ${label} với chi phí BYOK gốc chỉ từ ${TIER_CONFIGS.BASIC.priceDisplay}.`
      : `Sophia AI Factory's automated AI video solution for ${label} combines AEO-optimized scripting, ElevenLabs voice synthesis, HeyGen/D-ID avatars, and automated affiliate link injection on YouTube and TikTok, enabling non-tech CEOs to scale ${label} channels from ${TIER_CONFIGS.BASIC.priceDisplay}.`,
    lastVerifiedIso: VERIFIED_ISO_DATE,
    metrics: [
      { label: isVi ? 'Ngành nghề mục tiêu' : 'Target Vertical', value: label, sourceNote: `Slug: ${slug}` },
      { label: isVi ? 'Thời gian dựng 1 video' : 'Render Turnaround', value: '2–5 min', sourceNote: 'Cloudflare + Inngest pipeline' },
      { label: isVi ? 'Số kênh tối đa (PREMIUM)' : 'Channels (PREMIUM)', value: `${TIER_CONFIGS.PREMIUM.limits.youtubeChannels}`, sourceNote: TIER_CONFIGS.PREMIUM.priceDisplay },
      { label: isVi ? 'Thanh toán quốc tế' : 'Global Payout Rail', value: 'USDT / PayOS', sourceNote: 'Instant IPN activation' },
    ],
    comparisonRows: buildNicheComparisonRows(isVi, label),
    faqs: [
      { question: isVi ? `Làm sao để bắt đầu tạo video AI ngành ${label}?` : `How do I launch an AI video channel for ${label}?`, answer: isVi ? `Chỉ cần đăng ký gói (${TIER_CONFIGS.BASIC.priceDisplay}–${TIER_CONFIGS.MASTER.priceDisplay}), nhập khóa BYOK tại Setup Wizard và chọn ngách ${label} hoặc ra lệnh qua @Sophia_Bbot.` : `Select a tier (${TIER_CONFIGS.BASIC.priceDisplay}–${TIER_CONFIGS.MASTER.priceDisplay}), enter your BYOK keys in the Setup Wizard, and launch a ${label} mission via dashboard or @Sophia_Bbot.` },
    ],
    howToSteps: buildNicheHowToSteps(isVi, label),
  };
}
