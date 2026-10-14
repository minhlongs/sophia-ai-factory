import { createServerClient } from '@/seed/db/client';
import { DistributionPlanRow, DistributionPostRow } from './types';

export async function getDistributionPlan(planId: string): Promise<DistributionPlanRow | null> {
  const db = createServerClient();
  return db
    .prepare('SELECT * FROM distribution_plans WHERE id = ?1 LIMIT 1')
    .bind(planId)
    .first<DistributionPlanRow>();
}

export async function getDistributionPosts(planId: string): Promise<DistributionPostRow[]> {
  const db = createServerClient();
  const result = await db
    .prepare('SELECT * FROM distribution_posts WHERE plan_id = ?1 ORDER BY created_at')
    .bind(planId)
    .all<DistributionPostRow>();
  return result.results;
}

export async function updateDistributionPostStatus(
  postId: string,
  status: DistributionPostRow['status'],
  platformPostId?: string,
  error?: string,
): Promise<void> {
  const db = createServerClient();
  const nowSec = Math.floor(Date.now() / 1000);

  if (platformPostId && error) {
    await db
      .prepare(
        `UPDATE distribution_posts
         SET status = ?1, platform_post_id = ?2, error = ?3, posted_at = ?4
         WHERE id = ?5`,
      )
      .bind(status, platformPostId, error, status === 'published' ? nowSec : null, postId)
      .run();
  } else if (platformPostId) {
    await db
      .prepare(
        `UPDATE distribution_posts
         SET status = ?1, platform_post_id = ?2, posted_at = ?3
         WHERE id = ?4`,
      )
      .bind(status, platformPostId, status === 'published' ? nowSec : null, postId)
      .run();
  } else if (error) {
    await db
      .prepare(
        `UPDATE distribution_posts
         SET status = ?1, error = ?2
         WHERE id = ?3`,
      )
      .bind(status, error, postId)
      .run();
  } else {
    await db
      .prepare(
        `UPDATE distribution_posts
         SET status = ?1
         WHERE id = ?2`,
      )
      .bind(status, postId)
      .run();
  }
}
