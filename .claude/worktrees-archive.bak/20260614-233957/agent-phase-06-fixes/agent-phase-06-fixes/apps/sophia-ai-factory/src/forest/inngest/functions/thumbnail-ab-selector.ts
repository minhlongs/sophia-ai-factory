import { inngest } from '@/forest/inngest/client';
import { getD1Raw } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';

interface ThumbnailVariantRow {
  id: string;
  video_id: string;
  user_id: string;
  variant_index: number;
  impressions: number;
  clicks: number;
  is_selected: number;
}

export const thumbnailAbSelector = inngest.createFunction(
  { id: 'thumbnail-ab-selector' },
  { cron: '0 */12 * * *' },
  async ({ step }) => {
    const pendingVideos = await step.run('find-pending-ab-tests', async () => {
      const db = await getD1Raw();
      const result = await db
        .prepare(
          `SELECT DISTINCT video_id, user_id FROM thumbnail_variants
           WHERE is_selected = 0
           AND created_at < datetime('now', '-48 hours')
           AND impressions > 0`,
        )
        .all<{ video_id: string; user_id: string }>();
      return result.results;
    });

    let selected = 0;
    for (const video of pendingVideos) {
      await step.run(`select-winner-${video.video_id}`, async () => {
        const db = await getD1Raw();
        const variants = await db
          .prepare('SELECT * FROM thumbnail_variants WHERE video_id = ? ORDER BY variant_index')
          .bind(video.video_id)
          .all<ThumbnailVariantRow>();

        const best = variants.results.reduce((a: ThumbnailVariantRow, b: ThumbnailVariantRow) => {
          const aCtr = a.impressions > 0 ? a.clicks / a.impressions : 0;
          const bCtr = b.impressions > 0 ? b.clicks / b.impressions : 0;
          return bCtr > aCtr ? b : a;
        });

        await db
          .prepare('UPDATE thumbnail_variants SET is_selected = 1 WHERE id = ?')
          .bind(best.id)
          .run();

        logger.info('[thumbnail-ab] Winner selected', {
          videoId: video.video_id,
          winnerId: best.id,
          ctr: best.impressions > 0 ? best.clicks / best.impressions : 0,
        });

        selected++;
      });
    }

    return { evaluated: pendingVideos.length, selected };
  },
);
