/**
 * Buyer-Intent Keyword & 3x Title/Thumbnail Packaging Engine (Crypto + SaaS).
 *
 * Replaces vidIQ / TubeBuddy packaging workflows at $0 extra AI cost by generating
 * high-intent buyer keywords ("review", "vs", "fees", "tutorial") and 3 A/B-testable
 * Title + Thumbnail Hook variants before script generation.
 *
 * @module tree/seo/buyer-intent-packaging
 */

export interface BuyerIntentPackagingInput {
  readonly productName: string;
  readonly vertical: 'saas' | 'crypto';
  readonly competitorName?: string;
  readonly locale: 'vi' | 'en';
  readonly year?: number;
}

export interface TitleThumbnailVariant {
  readonly variantId: 'A' | 'B' | 'C';
  readonly angle: 'honest_review' | 'comparison_vs' | 'roi_tutorial';
  readonly title: string;
  readonly thumbnailText: string;
}

export interface BuyerIntentPackagingKit {
  readonly buyerIntentKeywords: readonly string[];
  readonly variants: readonly TitleThumbnailVariant[];
}

export function buildBuyerIntentPackagingKit(
  input: BuyerIntentPackagingInput,
): BuyerIntentPackagingKit {
  const product = input.productName.trim();
  const competitor =
    input.competitorName?.trim() || (input.vertical === 'crypto' ? 'Binance' : 'Alternatives');
  const year = input.year ?? 2026;

  if (input.locale === 'vi') {
    const keywords =
      input.vertical === 'crypto'
        ? [
            `đánh giá ${product} ${year}`,
            `so sánh phí ${product} vs ${competitor}`,
            `hướng dẫn đăng ký ${product} cho người mới`,
            `${product} có uy tín không`,
          ]
        : [
            `review ${product} ${year} có đáng tiền không`,
            `so sánh ${product} vs ${competitor}`,
            `hướng dẫn dùng ${product} từ A-Z`,
            `bảng giá ${product} ${year}`,
          ];

    return {
      buyerIntentKeywords: keywords,
      variants: [
        {
          variantId: 'A',
          angle: 'honest_review',
          title: `Đánh giá thật ${product} ${year}: Có đáng dùng không? (Ưu & Nhược)`,
          thumbnailText: `CÓ ĐÁNG KHÔNG? (${year})`,
        },
        {
          variantId: 'B',
          angle: 'comparison_vs',
          title: `${product} vs ${competitor} (${year}): Cái nào tối ưu chi phí hơn?`,
          thumbnailText: `${product.toUpperCase()} vs ${competitor.toUpperCase()}`,
        },
        {
          variantId: 'C',
          angle: 'roi_tutorial',
          title: `Hướng dẫn ${product} chi tiết trong 5 phút (Cho người mới ${year})`,
          thumbnailText: `HƯỚNG DẪN 5 PHÚT`,
        },
      ],
    };
  }

  const keywords =
    input.vertical === 'crypto'
      ? [
          `${product} review ${year}`,
          `${product} vs ${competitor} fees`,
          `how to use ${product} step by step`,
          `is ${product} safe ${year}`,
        ]
      : [
          `${product} review ${year} worth it`,
          `${product} vs ${competitor} comparison`,
          `${product} pricing and workflow tutorial`,
          `best ${product} setup ${year}`,
        ];

  return {
    buyerIntentKeywords: keywords,
    variants: [
      {
        variantId: 'A',
        angle: 'honest_review',
        title: `${product} Honest Review (${year}): Pros, Cons & Real ROI`,
        thumbnailText: `WORTH IT IN ${year}?`,
      },
      {
        variantId: 'B',
        angle: 'comparison_vs',
        title: `${product} vs ${competitor} (${year}): Which One Actually Wins?`,
        thumbnailText: `${product.toUpperCase()} VS ${competitor.toUpperCase()}`,
      },
      {
        variantId: 'C',
        angle: 'roi_tutorial',
        title: `${product} Step-by-Step Walkthrough (${year} Beginner Guide)`,
        thumbnailText: `5-MIN SETUP GUIDE`,
      },
    ],
  };
}
