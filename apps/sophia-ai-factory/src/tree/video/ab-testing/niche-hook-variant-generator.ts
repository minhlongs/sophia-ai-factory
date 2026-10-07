/**
 * Niche Hook Variant Generator
 *
 * Synthesizes diverse psychological hook angles for A/B testing short videos.
 *
 * Layer: tree/video/ab-testing (Domain Reusable Logic)
 * @module tree/video/ab-testing/niche-hook-variant-generator
 */

import type { NicheVideoCampaignPlan } from '@/tree/video/blueprints/niche-video-service';
import type {
  HookPsychologicalAngle,
  HookVariant,
  HookVariantPackage,
} from './hook-variant-types';

interface HookContentBuilderParams {
  productName: string;
  isEn: boolean;
  isCrypto: boolean;
}

function buildCuriosityHook(params: HookContentBuilderParams): Omit<HookVariant, 'id'> {
  const { productName, isEn, isCrypto } = params;
  return {
    angle: 'curiosity_gap',
    headline: isEn ? 'The Secret Nobody Talks About' : 'Bí mật chưa ai bật mí',
    narration: isEn
      ? `Top 1% ${isCrypto ? 'traders' : 'founders'} are quietly using ${productName} to dominate.`
      : `Top 1% ${isCrypto ? 'trader' : 'doanh chủ'} đang âm thầm dùng ${productName} để dẫn đầu thị trường.`,
    visualPrompt: `Mysterious glowing neon interface displaying ${productName}, cinematic dark studio, 9:16 vertical 4k`,
    overlayText: isEn ? '🤫 99% OF PEOPLE MISS THIS' : '🤫 99% MỌI NGƯỜI BỎ QUA',
    estimatedRetentionScore: 88,
  };
}

function buildLossAversionHook(params: HookContentBuilderParams): Omit<HookVariant, 'id'> {
  const { productName, isEn, isCrypto } = params;
  return {
    angle: 'loss_aversion',
    headline: isEn ? 'Stop Burning Capital' : 'Dừng lãng phí ngân sách',
    narration: isEn
      ? `You are losing money every single day without ${productName}. Here is the exact breakdown.`
      : `Bạn đang bị thất thoát tiền mỗi ngày nếu chưa dùng ${productName}. Đây là lý do chính xác.`,
    visualPrompt: `Dramatic slow-motion burning coins and glowing red error charts, 9:16 vertical high contrast`,
    overlayText: isEn ? '⚠️ STOP LOSING MONEY NOW' : '⚠️ DỪNG LÃNG PHÍ TIỀN NGAY',
    estimatedRetentionScore: 94,
  };
}

function buildShockingStatHook(params: HookContentBuilderParams): Omit<HookVariant, 'id'> {
  const { productName, isEn, isCrypto } = params;
  return {
    angle: 'shocking_stat',
    headline: isEn ? 'Shocking Industry Metric' : 'Thống kê giật mình',
    narration: isEn
      ? `87% of teams struggle with this until they switch to ${productName}.`
      : `87% người dùng gặp bế tắc này cho tới khi họ chuyển sang dùng ${productName}.`,
    visualPrompt: `Fast-paced 3D animated data counter jumping from 10% to 90%, sleek UI backdrop, 9:16 vertical`,
    overlayText: isEn ? '📊 87% STRUGGLE WITH THIS' : '📊 87% GẶP BẾ TẮC NÀY',
    estimatedRetentionScore: 85,
  };
}

function buildInstantBenefitHook(params: HookContentBuilderParams): Omit<HookVariant, 'id'> {
  const { productName, isEn } = params;
  return {
    angle: 'instant_benefit',
    headline: isEn ? 'Automate in 60 Seconds' : 'Tự động hóa trong 60 giây',
    narration: isEn
      ? `Here is how ${productName} cuts your daily workflow down to just 60 seconds.`
      : `Đây là cách ${productName} rút ngắn toàn bộ quy trình của bạn xuống còn đúng 60 giây.`,
    visualPrompt: `Futuristic smartphone screen showing ultra-fast automated task completion with emerald green ticks, 9:16`,
    overlayText: isEn ? '⚡ 60-SECOND REVOLUTION' : '⚡ ĐỘT PHÁ 60 GIÂY',
    estimatedRetentionScore: 91,
  };
}

export function generateHookVariants(
  plan: NicheVideoCampaignPlan,
  locale: 'en' | 'vi' = 'en',
): HookVariantPackage {
  const isCrypto = plan.blueprint.niche === 'crypto_global';
  const isEn = locale === 'en';
  const params: HookContentBuilderParams = {
    productName: plan.productName,
    isEn,
    isCrypto,
  };

  const builders = [
    buildLossAversionHook,
    buildInstantBenefitHook,
    buildCuriosityHook,
    buildShockingStatHook,
  ];

  const variants: HookVariant[] = builders.map((builder, idx) => {
    const raw = builder(params);
    return {
      id: `hkv_${idx + 1}`,
      ...raw,
    };
  });

  // Pick the highest estimated retention score as recommended
  const recommended = variants.reduce((prev, curr) =>
    curr.estimatedRetentionScore > prev.estimatedRetentionScore ? curr : prev,
  );

  return {
    planId: plan.planId,
    productName: plan.productName,
    niche: isCrypto ? 'crypto_global' : 'saas_global',
    variants,
    recommendedVariantId: recommended.id,
    generatedAt: new Date().toISOString(),
  };
}
