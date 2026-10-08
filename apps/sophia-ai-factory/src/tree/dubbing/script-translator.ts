/**
 * @file script-translator.ts
 * @description Localized pacing estimation and regional affiliate CTA routing
 * @layer tree
 */

import type { SupportedDubLocale } from '@/seed/types/viral-expansion-types';

export interface RegionalCtaConfig {
  locale: SupportedDubLocale;
  networkName: string;
  defaultCtaText: string;
  disclosureTag: string;
}

const REGIONAL_CTA_REGISTRY: Record<SupportedDubLocale, RegionalCtaConfig> = {
  en: {
    locale: 'en',
    networkName: 'Amazon / ClickBank',
    defaultCtaText: 'Tap the link in bio to get the full stack with 30% off.',
    disclosureTag: '#ad #affiliate',
  },
  vi: {
    locale: 'vi',
    networkName: 'Shopee Affiliate / Accesstrade VN',
    defaultCtaText: 'Bấm ngay vào link ở bio để nhận ưu đãi và bộ công cụ tự động hóa.',
    disclosureTag: '#quangcao #affiliate',
  },
  es: {
    locale: 'es',
    networkName: 'Hotmart LATAM',
    defaultCtaText: 'Haz clic en el enlace de la biografía para acceder a la herramienta ahora.',
    disclosureTag: '#publicidad',
  },
  id: {
    locale: 'id',
    networkName: 'TikTok Shop ID / Involve Asia',
    defaultCtaText: 'Klik link di bio sekarang untuk dapatkan diskon eksklusif.',
    disclosureTag: '#iklan',
  },
  ja: {
    locale: 'ja',
    networkName: 'A8.net / Rakuten Affiliate',
    defaultCtaText: 'プロフィールのリンクをタップして今すぐ詳細を確認してください。',
    disclosureTag: '#PR #タイアップ',
  },
};

/**
 * Calculates syllable count and required time-stretching pacing multiplier.
 * Keeps multiplier bounded in [0.90, 1.15] to preserve natural audio quality.
 */
export function estimatePacingMultiplier(
  sourceDurationSec: number,
  targetEstimatedSyllables: number,
  averageSyllablesPerSecond: number = 4.2,
): { targetDurationSec: number; pacingMultiplier: number; isWithinPacingBounds: boolean } {
  const estimatedTargetDuration = targetEstimatedSyllables / averageSyllablesPerSecond;
  const rawRatio = estimatedTargetDuration / Math.max(1, sourceDurationSec);
  const boundedMultiplier = Number(Math.max(0.9, Math.min(1.15, rawRatio)).toFixed(2));
  const isWithin = rawRatio >= 0.85 && rawRatio <= 1.20;

  return {
    targetDurationSec: Number(estimatedTargetDuration.toFixed(1)),
    pacingMultiplier: boundedMultiplier,
    isWithinPacingBounds: isWithin,
  };
}

/**
 * Maps target locale to regional affiliate network and compliant CTA copy.
 */
export function mapRegionalAffiliateCta(
  locale: SupportedDubLocale,
  customCtaPrefix?: string,
): RegionalCtaConfig {
  const base = REGIONAL_CTA_REGISTRY[locale] || REGIONAL_CTA_REGISTRY.en;
  if (!customCtaPrefix) return base;

  return {
    ...base,
    defaultCtaText: `${customCtaPrefix} ${base.defaultCtaText}`,
  };
}
