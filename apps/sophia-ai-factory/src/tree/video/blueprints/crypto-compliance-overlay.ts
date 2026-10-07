/**
 * Crypto Compliance Overlay Engine
 *
 * Implements 15-second mandatory legal end-card and persistent bottom-third risk banner.
 * Generates FFmpeg drawtext compliance filter strings.
 * Layer: tree (domain reusable logic)
 * @module tree/video/blueprints/crypto-compliance-overlay
 */

import { getDisclaimerForJurisdiction } from '@/seed/config/crypto-disclaimer-registry';

export interface CryptoOverlaySpec {
  jurisdiction: string;
  totalDurationSec: number;
  endCardStartSec: number;
  endCardDurationSec: number;
  bottomThirdBanner: {
    text: string;
    fontSize: number;
    fontColor: string;
    backgroundColor: string;
    opacity: number;
    yPositionPercent: number;
  };
  endCard: {
    headline: string;
    bodyDisclaimers: string[];
    contrastRatio: string;
    backgroundColor: string;
    textColor: string;
  };
  audioDuckingDb: number;
}

export function buildCryptoOverlaySpec(
  jurisdiction: string = 'GLOBAL',
  totalDurationSec: number = 60,
  locale: 'en' | 'vi' = 'en',
): CryptoOverlaySpec {
  const disclaimer = getDisclaimerForJurisdiction(jurisdiction);
  const isVi = locale === 'vi';

  const endCardDurationSec = 15;
  const endCardStartSec = Math.max(0, totalDurationSec - endCardDurationSec);

  const bannerText = isVi
    ? 'CẢNH BÁO: Tiền điện tử biến động cao. 70-80% tài khoản nhà đầu tư cá nhân thua lỗ. Không phải lời khuyên tài chính.'
    : 'RISK WARNING: Cryptocurrency carries high risk. 70-80% retail accounts lose money. Not financial advice. #Ad';

  const headline = isVi
    ? 'MINH BẠCH VÀ CẢNH BÁO PHÁP LÝ'
    : 'LEGAL & FINANCIAL DISCLOSURE';

  const disclaimerText = isVi ? disclaimer.full.vi : disclaimer.full.en;
  const shortText = isVi ? disclaimer.short.vi : disclaimer.short.en;

  return {
    jurisdiction,
    totalDurationSec,
    endCardStartSec,
    endCardDurationSec,
    bottomThirdBanner: {
      text: bannerText,
      fontSize: 22,
      fontColor: '#FFFFFF',
      backgroundColor: '#0F172A',
      opacity: 0.88,
      yPositionPercent: 88,
    },
    endCard: {
      headline,
      bodyDisclaimers: [disclaimerText, shortText],
      contrastRatio: '7.8:1 (WCAG AAA compliant)',
      backgroundColor: '#05070E',
      textColor: '#E2E8F0',
    },
    audioDuckingDb: -18,
  };
}

export function generateOverlayFfmpegFilter(spec: CryptoOverlaySpec): string {
  const bannerFilter = `drawtext=text='${spec.bottomThirdBanner.text.replace(/'/g, "\\'")}':fontcolor=white:fontsize=${spec.bottomThirdBanner.fontSize}:box=1:boxcolor=black@0.85:boxborderw=10:x=(w-text_w)/2:y=h*0.88:enable='between(t,0,${spec.endCardStartSec})'`;
  const endCardFilter = `drawtext=text='${spec.endCard.headline}':fontcolor=white:fontsize=36:x=(w-text_w)/2:y=h*0.30:enable='between(t,${spec.endCardStartSec},${spec.totalDurationSec})'`;

  return `${bannerFilter},${endCardFilter}`;
}
