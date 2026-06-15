/**
 * POST /api/openclaw/exchange
 *
 * Mints a short-lived HMAC token (v2, JTI-bearing) for the OpenClaw plugin.
 *
 * TTL policy:
 *   - Default TTL: 24 hours (`DEFAULT_TTL_SECONDS = 86400`)
 *   - Max TTL without `extended` flag: 24 hours
 *   - Max TTL with `extended: true` AND service-account role: 7 days
 *   - Hard ceiling: 7 days — rejected regardless of role/flags
 *
 * NOTE on extended service-account TTL:
 *   Callers with `role === 'service'` may request up to 7d by passing
 *   `{ extended: true, ttlSeconds: <up to 604800> }`. This role does not
 *   currently exist in the DB schema; when added, no code change is needed
 *   here. Until then, `extended: true` from non-service accounts returns 400.
 *
 * Rate limits (per 1-hour sliding window, D1-backed):
 *   - Per user:  10 mints / hour
 *   - Per IP:    30 mints / hour
 *   Returns 429 with `Retry-After` header on breach.
 *
 * @module app/api/openclaw/exchange
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { generateJti, hmacBase64url } from '@/seed/auth/openclaw-token';
import { getD1Raw } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';

export const dynamic = 'force-dynamic';

const DEFAULT_TTL_SECONDS = 86_400;            // 24 hours
const MAX_TTL_USER_SECONDS = 86_400;           // 24 hours for regular users
const MAX_TTL_SERVICE_SECONDS = 7 * 24 * 3600; // 7 days — service accounts only
const HARD_TTL_CEILING = 7 * 24 * 3600;        // absolute max

const RATE_WINDOW_SECONDS = 3600; // 1 hour
const RATE_MAX_USER = 10;
const RATE_MAX_IP = 30;

interface ExchangeRequestBody {
  ttlSeconds?: number;
  extended?: boolean;
}

interface ExchangeResponse {
  token: string;
  expiresAt: number;
  userId: string;
  jti: string;
}

// ── Rate limiting ─────────────────────────────────────────────────────────────

/**
 * Count recent mint attempts in the sliding window.
 * Uses D1 `openclaw_mint_attempts` table — one row per mint.
 * Old rows (> 1h) are ignored via WHERE clause; periodic cleanup is optional.
 */
async function countMintAttempts(
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

async function recordMintAttempt(
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

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('cf-connecting-ip') ?? 'unknown';
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUserFromHeaders(request.headers);
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const secret = process.env.BETTER_AUTH_SECRET || process.env.JWT_SECRET || '';
  if (!secret) {
    logger.error('[openclaw/exchange] BETTER_AUTH_SECRET missing — cannot mint token');
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 500 });
  }

  // ── Parse and validate request body ────────────────────────────────────────
  let ttlSeconds = DEFAULT_TTL_SECONDS;
  let extended = false;
  try {
    const body = (await request.json()) as ExchangeRequestBody;
    extended = body?.extended === true;

    if (typeof body?.ttlSeconds === 'number' && body.ttlSeconds > 0) {
      const requested = Math.floor(body.ttlSeconds);

      // Hard ceiling regardless of role.
      if (requested > HARD_TTL_CEILING) {
        return NextResponse.json(
          { error: 'ttlSeconds exceeds hard ceiling of 7 days (604800 seconds)' },
          { status: 400 },
        );
      }

      // Extended TTL (>24h) only for service accounts.
      if (requested > MAX_TTL_USER_SECONDS) {
        if (!extended) {
          return NextResponse.json(
            { error: 'ttlSeconds > 86400 requires { extended: true } and service-account role' },
            { status: 400 },
          );
        }
        // Service-account role check.
        // NOTE: `role === 'service'` is not yet in the DB schema.
        // When added, remove this rejection. Until then, reject all extended requests.
        if (user.role !== 'service') {
          return NextResponse.json(
            { error: 'extended TTL requires service-account role' },
            { status: 400 },
          );
        }
        ttlSeconds = Math.min(requested, MAX_TTL_SERVICE_SECONDS);
      } else {
        ttlSeconds = requested;
      }
    }
  } catch {
    // Non-JSON body → use defaults.
  }

  // ── Rate limiting ──────────────────────────────────────────────────────────
  const ip = getClientIp(request);
  const nowSec = Math.floor(Date.now() / 1000);
  const windowStart = nowSec - RATE_WINDOW_SECONDS;
  const retryAfterSec = RATE_WINDOW_SECONDS;

  let db: D1Database;
  try {
    db = await getD1Raw();
  } catch (err) {
    logger.error('[openclaw/exchange] D1 unavailable', toError(err));
    return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });
  }

  try {
    const [userCount, ipCount] = await Promise.all([
      countMintAttempts(db, 'user_id', user.id, windowStart),
      countMintAttempts(db, 'ip', ip, windowStart),
    ]);

    if (userCount >= RATE_MAX_USER) {
      return NextResponse.json(
        { error: 'rate_limited', detail: 'user mint limit reached (10/hour)' },
        { status: 429, headers: { 'Retry-After': String(retryAfterSec) } },
      );
    }

    if (ipCount >= RATE_MAX_IP) {
      return NextResponse.json(
        { error: 'rate_limited', detail: 'ip mint limit reached (30/hour)' },
        { status: 429, headers: { 'Retry-After': String(retryAfterSec) } },
      );
    }
  } catch (err) {
    // Fail closed — if rate limit check itself fails, deny the mint.
    logger.error('[openclaw/exchange] rate limit check failed', toError(err));
    return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });
  }

  // ── Mint token ─────────────────────────────────────────────────────────────
  const jti = generateJti();
  const expiresAt = nowSec + ttlSeconds;
  const payload = `${user.id}.${expiresAt}.${jti}`;
  const sig = await hmacBase64url(payload, secret);
  const token = `${payload}.${sig}`;

  // Record attempt after mint (non-blocking; if this fails the token is still valid
  // but rate-limiting won't account for this mint until next attempt sees the row).
  try {
    await recordMintAttempt(db, jti, user.id, ip, nowSec);
  } catch (err) {
    logger.warn('[openclaw/exchange] failed to record mint attempt', toError(err), { jti, userId: user.id });
    // Intentionally not rejecting — token is minted; retry tracking is best-effort.
  }

  const responseBody: ExchangeResponse = { token, expiresAt, userId: user.id, jti };
  return NextResponse.json(responseBody);
}
