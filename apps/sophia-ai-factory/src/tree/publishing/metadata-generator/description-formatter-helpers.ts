/**
 * APAC CTA Copy and Attribution Pruning Helpers for SEO Description Formatter.
 * @module tree/publishing/metadata-generator/description-formatter-helpers
 */

import type { ApacLanguage } from '@/seed/types/apac-syndication';

export const CTA_COPY_BY_LANGUAGE: Record<
  ApacLanguage,
  { fun: string; tg: string; tagHeader: string }
> = {
  vi: {
    fun: '🚀 Khám phá giải pháp tự động hóa video AI cùng Sophia Factory:',
    tg: '💬 Nhận video mẫu miễn phí & tư vấn tức thì qua Telegram Bot:',
    tagHeader: 'Từ khóa:',
  },
  en: {
    fun: '🚀 Deploy your 24/7 autonomous video agent with Sophia Factory:',
    tg: '💬 Test live interactive video demo on Telegram:',
    tagHeader: 'Tags:',
  },
  ja: {
    fun: '🚀 Sophia AI Factoryで動画制作を24時間完全自動化:',
    tg: '💬 Telegramで今すぐ無料デモ動画を体験:',
    tagHeader: '関連タグ:',
  },
  ko: {
    fun: '🚀 Sophia AI Factory로 24시간 자동화 비디오 파이프라인 구축:',
    tg: '💬 텔레그램 봇으로 실시간 무료 샘플 영상 받아보기:',
    tagHeader: '태그:',
  },
  th: {
    fun: '🚀 สร้างระบบผลิตวิดีโอ AI อัตโนมัติ 24 ชม. กับ Sophia Factory:',
    tg: '💬 ทดลองรับตัวอย่างวิดีโอฟรีผ่าน Telegram Bot ทันที:',
    tagHeader: 'แท็ก:',
  },
};

/**
 * Helper to prune secondary elements (hashtags, referral notes) when the attribution
 * block itself is exceptionally close to or exceeds maxDescriptionLength.
 * GUARANTEE: trackedFunnelUrl and telegramDeepLink are 100% preserved.
 */
export function pruneAttributionBlock(
  parts: string[],
  trackedFunnelUrl: string,
  telegramDeepLink: string,
  maxDescriptionLength: number,
): string {
  const mandatoryBlock = `👉 ${trackedFunnelUrl}\n🤖 ${telegramDeepLink}`;
  if (mandatoryBlock.length >= maxDescriptionLength) {
    return mandatoryBlock;
  }

  const retained = [...parts];
  while (retained.length > 0 && retained.join('\n\n').length > maxDescriptionLength) {
    let nonLinkIdx = -1;
    for (let i = retained.length - 1; i >= 0; i--) {
      if (!retained[i].includes(trackedFunnelUrl) && !retained[i].includes(telegramDeepLink)) {
        nonLinkIdx = i;
        break;
      }
    }
    if (nonLinkIdx >= 0) {
      retained.splice(nonLinkIdx, 1);
    } else {
      break;
    }
  }

  const result = retained.join('\n\n');
  if (
    result.length <= maxDescriptionLength &&
    result.includes(trackedFunnelUrl) &&
    result.includes(telegramDeepLink)
  ) {
    return result;
  }

  return mandatoryBlock;
}
