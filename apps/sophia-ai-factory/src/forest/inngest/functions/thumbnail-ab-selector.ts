import { inngest } from '@/seed/inngest/client';
import { getD1 } from '@/seed/db/client';
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
      const _db = await getD1();
      if (!_db) throw new Error('D1 database binding not available');
      const db = _db;
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
        const _db = await getD1();
        if (!_db) throw new Error('D1 database binding not available');
        const db = _db;
        const variants = await db
          .prepare('SELECT * FROM thumbnail_variants WHERE video_id = ? ORDER BY variant_index')
          .bind(video.video_id)
          .all<ThumbnailVariantRow>();

        // Require minimum 10 impressions per variant before statistical consideration
        const eligible = variants.results.filter((v) => v.impressions >= 10);
        if (eligible.length === 0) {
          logger.info('[thumbnail-ab] No variant meets minimum 10 impressions, skipping', {
            videoId: video.video_id,
          });
          return;
        }

        const best = eligible.reduce((a: ThumbnailVariantRow, b: ThumbnailVariantRow) => {
          const aCtr = a.impressions > 0 ? a.clicks / a.impressions : 0;
          const bCtr = b.impressions > 0 ? b.clicks / b.impressions : 0;
          return bCtr > aCtr ? b : a;
        });

        await _db
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
