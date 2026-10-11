import type { QueryResult } from '@/seed/db/d1-query-types';
import type { D1Database } from '@cloudflare/workers-types';

export async function incrementReferralCounter(
  db: D1Database,
  code: string,
): Promise<QueryResult<unknown>> {
  const updateResult = await db
    .prepare('UPDATE referral_codes SET uses = uses + 1 WHERE code = ?')
    .bind(code)
    .run();
  if (!updateResult.meta.rows_written || updateResult.meta.rows_written === 0) {
    return { data: null, error: { message: `Referral code not found: ${code}` } };
  }
  return { data: { success: true }, error: null };
}

export async function incrementLlmCacheHit(
  db: D1Database,
  hash: string,
  orgId: string,
): Promise<QueryResult<unknown>> {
  const updateResult = await db
    .prepare('UPDATE llm_cache SET hit_count = hit_count + 1 WHERE hash = ? AND org_id = ?')
    .bind(hash, orgId)
    .run();
  if (!updateResult.meta.rows_written || updateResult.meta.rows_written === 0) {
    return { data: null, error: { message: 'LLM cache entry not found' } };
  }
  return { data: { success: true }, error: null };
}

export async function incrementRateLimit(
  db: D1Database,
  identifier: string,
  windowSeconds: number,
): Promise<QueryResult<{ current_count: number }[]>> {
  const windowStart = Math.floor(Date.now() / 1000) - windowSeconds;
  const stmt = db.prepare(`
    INSERT INTO rate_limits (identifier, current_count, window_start, window_seconds)
    VALUES (?1, 1, datetime('now'), ?2)
    ON CONFLICT(identifier) DO UPDATE SET
      current_count = CASE
        WHEN CAST(strftime('%s', window_start) AS INTEGER) < ?3 THEN 1
        ELSE current_count + 1
      END,
      window_start = CASE
        WHEN CAST(strftime('%s', window_start) AS INTEGER) < ?3 THEN datetime('now')
        ELSE window_start
      END,
      updated_at = datetime('now')
    RETURNING current_count
  `);
  const row = await stmt
    .bind(identifier, windowSeconds, windowStart)
    .first<{ current_count: number }>();
  return { data: row ? [row] : null, error: null };
}
