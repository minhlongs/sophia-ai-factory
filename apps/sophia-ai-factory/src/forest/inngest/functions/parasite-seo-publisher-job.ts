/**
 * @file parasite-seo-publisher-job.ts
 * @description Inngest background job for Parasite SEO article publishing & platform syndication
 * @layer forest
 */

import { inngest } from '@/seed/inngest/client';
import { createServerClient } from '@/seed/db/client';

export const parasiteSeoPublisherJob = inngest.createFunction(
  {
    id: 'parasite-seo-publisher-job',
    name: 'Parasite SEO: High-DA Platform Syndication',
    concurrency: { limit: 5 },
  },
  { event: 'seo.parasite.syndicated' },
  async ({ event, step }) => {
    const { articleId, targetPlatform, canonicalSlug } = event.data;

    // Step 1: Simulate platform publishing API call
    const publishResult = await step.run('publish-to-platform', async () => {
      const platformDomain =
        targetPlatform === 'MEDIUM'
          ? 'medium.com/@sophia_reviews'
          : targetPlatform === 'SUBSTACK'
          ? 'sophiaai.substack.com/p'
          : 'linkedin.com/pulse';

      return {
        publishedUrl: `https://${platformDomain}/${canonicalSlug}`,
        syndicatedAt: Date.now(),
      };
    });

    // Step 2: Update D1 article status to PUBLISHED
    await step.run('update-article-published-status', async () => {
      const db = createServerClient();
      await db.execute(
        `UPDATE parasite_seo_articles
         SET status = 'PUBLISHED',
             published_external_url = ?,
             updated_at = ?
         WHERE id = ?`,
        [publishResult.publishedUrl, Date.now(), articleId],
      );
    });

    return {
      articleId,
      targetPlatform,
      publishedUrl: publishResult.publishedUrl,
    };
  },
);
