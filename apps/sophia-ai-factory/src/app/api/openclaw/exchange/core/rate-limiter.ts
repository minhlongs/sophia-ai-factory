import { NextRequest } from 'next/server';

export async function countMintAttempts(
  db: D1Database,
  column: 'user_id' | 'ip',
  value: string,
  windowStart: number,
): Promise<number> {
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS cnt FROM openclaw_mint_attempts WHERE ${column} = ?1 AND created_at >= ?2`,
    )
    .bind(value, windowStart)
    .first<{ cnt: number }>();
  return row?.cnt ?? 0;
}

export async function recordMintAttempt(
  db: D1Database,
  jti: string,
  userId: string,
  ip: string,
  nowSec: number,
): Promise<void> {
  await db
    .prepare(
      'INSERT OR IGNORE INTO openclaw_mint_attempts (jti, user_id, ip, created_at) VALUES (?1, ?2, ?3, ?4)',
    )
    .bind(jti, userId, ip, nowSec)
    .run();
}

export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('cf-connecting-ip') ?? 'unknown';
}
