import { inngest } from '@/seed/inngest/client';
import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';

interface VariantRow {
  id: string;
  parent_id: string;
  user_id: string;
  variant_key: string;
  impressions: number;
  clicks: number;
  is_selected: number;
}

export const variantAbSelector = inngest.createFunction(
  { id: 'variant-ab-selector' },
  { cron: '0 */12 * * *' },
  async ({ step }) => {
    const pendingVideos = await step.run('find-pending-ab-tests', async () => {
      const _db = await getD1();
      if (!_db) throw new Error('D1 database binding not available');
      const db = _db;
      const result = await db
        .prepare(
          `SELECT DISTINCT parent_id, user_id FROM variant_results
           WHERE is_selected = 0
           AND created_at < datetime('now', '-48 hours')
           AND impressions > 0`,
        )
        .all<{ parent_id: string; user_id: string }>();
      return result.results;
    });

    let selected = 0;
    for (const video of pendingVideos) {
      await step.run(`select-winner-${video.parent_id}`, async () => {
        const _db = await getD1();
        if (!_db) throw new Error('D1 database binding not available');
        const db = _db;
        const variants = await db
          .prepare('SELECT * FROM variant_results WHERE parent_id = ? ORDER BY variant_key')
          .bind(video.parent_id)
          .all<VariantRow>();

        const eligible = variants.results.filter((v) => v.impressions >= 10);
        if (eligible.length === 0) {
          logger.info('[variant-ab-selector] No variant meets minimum 10 impressions, skipping', {
            parentId: video.parent_id,
          });
          return;
        }

        const best = eligible.reduce((a: VariantRow, b: VariantRow) => {
          const aCtr = a.impressions > 0 ? a.clicks / a.impressions : 0;
          const bCtr = b.impressions > 0 ? b.clicks / b.impressions : 0;
          return bCtr > aCtr ? b : a;
        });

        await db
          .prepare('UPDATE variant_results SET is_selected = 1 WHERE id = ?')
          .bind(best.id)
          .run();

        logger.info('[variant-ab-selector] Winner selected', {
          parentId: video.parent_id,
          winnerId: best.id,
          variantKey: best.variant_key,
          ctr: best.impressions > 0 ? best.clicks / best.impressions : 0,
        });

        selected++;
      });
    }

    return { evaluated: pendingVideos.length, selected } as const;
  },
);