/**
 * Persistence and Inngest dispatch helper for Parasite SEO Article syndication.
 * @module land/growth/actions/triad/parasite-article-dispatcher
 */

import { createServerClient } from '@/seed/db/client';
import { inngest } from '@/seed/inngest/client';
import {
  ParasiteSeoArticleSchema,
  type ParasiteSeoArticle,
} from '@/seed/types/growth-triad-v2-types';
import { compileParasiteArticle } from '@/tree/seo/parasite-article-builder';

export async function createAndDispatchParasiteArticle(
  userId: string,
  input: {
    skuCode: string;
    productName: string;
    price: number;
    targetPlatform: 'MEDIUM' | 'SUBSTACK' | 'LINKEDIN_PULSE' | 'WORDPRESS_NETWORK';
    cloakedBridgeUrl: string;
    keyFeatures: string[];
  },
): Promise<ParasiteSeoArticle> {
  const compiled = compileParasiteArticle(input);
  const articleId = `pseo-${crypto.randomUUID().slice(0, 12)}`;
  const now = Math.floor(Date.now() / 1000);

  const articleRecord = ParasiteSeoArticleSchema.parse({
    id: articleId,
    userId,
    skuCode: input.skuCode,
    title: compiled.title,
    targetPlatform: input.targetPlatform,
    canonicalSlug: compiled.canonicalSlug,
    cloakedBridgeUrl: input.cloakedBridgeUrl,
    targetKeywords: input.keyFeatures,
    schemaOrgJsonLd: compiled.schemaOrgJsonLd,
    seoContentMarkdown: compiled.seoContentMarkdown,
    seoScore: compiled.seoScore,
    status: 'PUBLISHED',
    publishedExternalUrl: `https://${input.targetPlatform.toLowerCase()}.com/p/${compiled.canonicalSlug}`,
    organicImpressions: 0,
    organicClicks: 0,
    createdAt: now,
    updatedAt: now,
  });

  const db = createServerClient();
  await db.execute(
    `INSERT INTO parasite_seo_articles (
      id, user_id, sku_code, title, target_platform, canonical_slug,
      cloaked_bridge_url, target_keywords, schema_org_json_ld,
      seo_content_markdown, seo_score, status, published_external_url,
      organic_impressions, organic_clicks, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      articleRecord.id, articleRecord.userId, articleRecord.skuCode, articleRecord.title,
      articleRecord.targetPlatform, articleRecord.canonicalSlug, articleRecord.cloakedBridgeUrl,
      JSON.stringify(articleRecord.targetKeywords), articleRecord.schemaOrgJsonLd,
      articleRecord.seoContentMarkdown, articleRecord.seoScore, articleRecord.status,
      articleRecord.publishedExternalUrl ?? null, articleRecord.organicImpressions,
      articleRecord.organicClicks, articleRecord.createdAt, articleRecord.updatedAt,
    ],
  );

  await inngest.send({
    name: 'seo.parasite.syndicated',
    data: {
      articleId: articleRecord.id,
      userId,
      skuCode: articleRecord.skuCode,
      targetPlatform: articleRecord.targetPlatform,
      canonicalSlug: articleRecord.canonicalSlug,
      cloakedBridgeUrl: articleRecord.cloakedBridgeUrl,
    },
  });

  return articleRecord;
}
