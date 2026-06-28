import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/seed/utils/logger-utility';
import { getCurrentUser } from '@/seed/auth/better-auth-session';

const MAX_MESSAGE_LEN = 1024;

// In-memory anon rate limiter (per-IP, 10 req/min)
// Cloudflare Workers resets per isolate; acceptable for edge-based throttle
const anonRateMap = new Map<string, { count: number; resetAt: number }>();

function isAnonRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = anonRateMap.get(ip);
  if (!entry || now > entry.resetAt) {
    anonRateMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  entry.count += 1;
  if (entry.count > 10) return true;
  return false;
}

function sanitize(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  // Strip CRLF to prevent log-injection
  return value.replace(/[\r\n]/g, ' ').slice(0, MAX_MESSAGE_LEN);
}

interface ClientErrorPayload {
  message?: string;
  stack?: string;
  url?: string;
  userAgent?: string;
  timestamp?: string | number;
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      // Anonymous — stricter rate limit per IP
      const ip =
        req.headers.get('cf-connecting-ip') ||
        req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
        'unknown';
      if (isAnonRateLimited(ip)) {
        return NextResponse.json({ ok: false, error: 'Rate limit exceeded' }, { status: 429 });
      }
    }

    const body = (await req.json().catch(() => ({}))) as ClientErrorPayload;

    const message = sanitize(body.message);
    const stack = body.stack ? body.stack.replace(/[\r\n]/g, ' ').slice(0, 500) : undefined;
    const url = sanitize(body.url);
    const userAgent = body.userAgent ? body.userAgent.replace(/[\r\n]/g, ' ').slice(0, 200) : undefined;
    const { timestamp } = body;

    logger.error('[Client Error]', {
      message,
      stack,
      url,
      userAgent,
      timestamp,
      userId: user?.id,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
