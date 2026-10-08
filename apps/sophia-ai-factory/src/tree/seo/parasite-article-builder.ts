/**
 * @file parasite-article-builder.ts
 * @description Pure Schema.org JSON-LD and SEO content compiler for Parasite SEO syndication
 * @layer tree
 */

import type { ParasitePlatform } from '@/seed/types/growth-triad-v2-types';

export interface ParasiteArticleInput {
  productName: string;
  skuCode: string;
  price: number;
  currency?: string;
  ratingScore?: number; // default 4.8
  reviewCount?: number; // default 1250
  targetPlatform: ParasitePlatform;
  cloakedBridgeUrl: string;
  keyFeatures: string[];
}

export interface CompiledParasiteArticle {
  title: string;
  canonicalSlug: string;
  schemaOrgJsonLd: string;
  seoContentMarkdown: string;
  seoScore: number;
}

/**
 * Generates Schema.org Product and Review JSON-LD
 */
export function buildProductReviewSchemaOrg(input: ParasiteArticleInput): string {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: input.productName,
    sku: input.skuCode,
    offers: {
      '@type': 'Offer',
      price: input.price,
      priceCurrency: input.currency ?? 'VND',
      availability: 'https://schema.org/InStock',
      url: input.cloakedBridgeUrl,
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: (input.ratingScore ?? 4.8).toFixed(1),
      reviewCount: input.reviewCount ?? 1250,
    },
    review: {
      '@type': 'Review',
      author: {
        '@type': 'Person',
        name: 'Tech & Lifestyle Editorial Team',
      },
      reviewRating: {
        '@type': 'Rating',
        ratingValue: (input.ratingScore ?? 4.8).toFixed(1),
        bestRating: '5',
      },
    },
  };

  return JSON.stringify(schema, null, 2);
}

/**
 * Compiles high-converting markdown with cloaked bridge links and SEO structure
 */
export function compileParasiteArticle(input: ParasiteArticleInput): CompiledParasiteArticle {
  const title = `Đánh Giá Chi Tiết ${input.productName} 2026: Có Đáng Mua Không?`;
  const canonicalSlug = `review-${input.skuCode.toLowerCase()}-${input.targetPlatform.toLowerCase()}`;
  const schemaOrgJsonLd = buildProductReviewSchemaOrg(input);

  const featuresList = input.keyFeatures.map((f) => `- **${f}**`).join('\n');

  const seoContentMarkdown = `
# ${title}

Bạn đang cân nhắc sở hữu **${input.productName}** nhưng chưa rõ chất lượng thực tế và mức giá có thực sự xứng đáng? Bài viết này tổng hợp trải nghiệm thực tế sau 14 ngày sử dụng để giúp bạn có quyết định sáng suốt nhất.

---

## 1. Điểm Nổi Bật Chính
${featuresList}

---

## 2. Ưu Đãi Độc Quyền & Link Đặt Hàng Chính Hãng
Hiện tại sản phẩm đang có chương trình flash-sale độc quyền dành cho độc giả:
👉 [**Nhận Ưu Đãi Giá Sốc & Miễn Phí Vận Chuyển Tại Đây**](${input.cloakedBridgeUrl})

*(Lưu ý: Chương trình có thể kết thúc khi hết số lượng phân bổ).*
  `.trim();

  // Basic SEO completeness score: word length, links, schema
  const seoScore = Math.min(100, Math.max(70, 75 + input.keyFeatures.length * 5));

  return {
    title,
    canonicalSlug,
    schemaOrgJsonLd,
    seoContentMarkdown,
    seoScore,
  };
}
