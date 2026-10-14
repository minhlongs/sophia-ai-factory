/**
 * Winner selection and thumbnail updating for A/B experiment lifecycles
 *
 * @module forest/ab/thumbnail/winner-selector
 */

import { getD1 } from '@/seed/db/client';

export async function selectWinningThumbnail(
  videoId: string,
  winner: 'a' | 'b',
  variantThumbUrl?: string,
): Promise<void> {
  if (!variantThumbUrl) {
    return;
  }

  const db = await getD1();
  if (!db) {
    throw new Error('D1 database binding not available');
  }

  await db
    .prepare(
      `UPDATE videos
       SET thumbnail_url = ?,
           updated_at = datetime('now')
       WHERE id = ?`,
    )
    .bind(variantThumbUrl, videoId)
    .run();
}
