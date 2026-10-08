/**
 * @file trend-signal-matcher.ts
 * @description Matches real-time trending topics with affiliate product catalogs
 * @layer tree
 */

export interface CatalogProduct {
  id: string;
  title: string;
  niche: string;
  keywords: string[];
  commissionRate: number;
}

export interface TrendMatchResult {
  trendTopic: string;
  bestProductId: string | null;
  similarityScore: number;
  matchAngle: string;
}

/**
 * Calculates keyword overlap similarity between trend topics and affiliate products.
 */
export function matchTrendToAffiliateProduct(
  trendTopic: string,
  catalog: CatalogProduct[],
): TrendMatchResult {
  if (catalog.length === 0) {
    return {
      trendTopic,
      bestProductId: null,
      similarityScore: 0,
      matchAngle: 'General curiosity hook',
    };
  }

  const topicTokens = trendTopic.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
  let bestProduct: CatalogProduct | null = null;
  let highestScore = 0;

  for (const product of catalog) {
    const productKeywords = product.keywords.map((k) => k.toLowerCase());
    const titleTokens = product.title.toLowerCase().split(/\s+/);
    const allTokens = [...productKeywords, ...titleTokens];

    let hits = 0;
    for (const token of topicTokens) {
      if (allTokens.some((target) => target.includes(token) || token.includes(target))) {
        hits += 1;
      }
    }

    const score = topicTokens.length > 0 ? Number((hits / topicTokens.length).toFixed(2)) : 0;
    if (score > highestScore) {
      highestScore = score;
      bestProduct = product;
    }
  }

  const matchAngle = bestProduct
    ? `Why ${trendTopic} proves you urgently need ${bestProduct.title}`
    : 'Viral awareness conversion hook';

  return {
    trendTopic,
    bestProductId: bestProduct ? bestProduct.id : catalog[0].id,
    similarityScore: Math.min(1.0, highestScore || 0.45),
    matchAngle,
  };
}
