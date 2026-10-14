import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import {
  ExchangeRequestBody,
  RATE_WINDOW_SECONDS,
  RATE_MAX_USER,
  RATE_MAX_IP,
} from './types';
import { validateTtl } from './ttl-validator';
import { countMintAttempts, recordMintAttempt, getClientIp } from './rate-limiter';
import { mintOpenClawToken } from './token-minter';

export async function handleOpenClawExchange(request: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUserFromHeaders(request.headers);
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const secret = process.env.BETTER_AUTH_SECRET || process.env.JWT_SECRET || '';
  if (!secret) {
    logger.error('[openclaw/exchange] BETTER_AUTH_SECRET missing — cannot mint token');
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 500 });
  }

  let body: ExchangeRequestBody | null = null;
  try {
    body = (await request.json()) as ExchangeRequestBody;
  } catch {
    // Non-JSON body handled by validator defaults
  }

  const validation = validateTtl(body, user.role);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: validation.status });
  }

  const ip = getClientIp(request);
  const nowSec = Math.floor(Date.now() / 1000);
  const windowStart = nowSec - RATE_WINDOW_SECONDS;

  const db = await getD1();
  if (!db) {
    logger.error('[openclaw/exchange] D1 unavailable');
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
        { status: 429, headers: { 'Retry-After': String(RATE_WINDOW_SECONDS) } },
      );
    }

    if (ipCount >= RATE_MAX_IP) {
      return NextResponse.json(
        { error: 'rate_limited', detail: 'ip mint limit reached (30/hour)' },
        { status: 429, headers: { 'Retry-After': String(RATE_WINDOW_SECONDS) } },
      );
    }
  } catch (err) {
    logger.error('[openclaw/exchange] rate limit check failed', toError(err));
    return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });
  }

  const responseBody = await mintOpenClawToken(user.id, validation.ttlSeconds, nowSec, secret);

  try {
    await recordMintAttempt(db, responseBody.jti, user.id, ip, nowSec);
  } catch (err) {
    logger.warn('[openclaw/exchange] failed to record mint attempt', toError(err), {
      jti: responseBody.jti,
      userId: user.id,
    });
  }

  return NextResponse.json(responseBody);
}
