import { getD1 } from '@/seed/db/client';
import type { LandingPage } from '@/seed/types/landing-page-types';
import { getBySlug } from './read-ops';

/** Delete a landing page by slug. Returns true if deleted, false if not found. */
export async function remove(slug: string): Promise<boolean> {
  const _db = await getD1();
  if (!_db) throw new Error('D1 binding not available');
  const db = _db;

  const result = await db
    .prepare(`DELETE FROM landing_pages WHERE id = ?1`)
    .bind(slug)
    .run();

  return (result.meta?.changes ?? 0) > 0;
}

/** Toggle is_published for a landing page. Returns the updated page. */
export async function togglePublish(slug: string): Promise<LandingPage | null> {
  const _db = await getD1();
  if (!_db) throw new Error('D1 binding not available');
  const db = _db;

  await db
    .prepare(
      `UPDATE landing_pages
       SET is_published = CASE WHEN is_published = 1 THEN 0 ELSE 1 END,
           updated_at = datetime('now')
       WHERE id = ?1`,
    )
    .bind(slug)
    .run();

  return getBySlug(slug);
}
