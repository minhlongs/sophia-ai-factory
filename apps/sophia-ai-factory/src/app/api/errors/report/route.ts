import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/utils/logger-utility';

interface ClientErrorPayload {
  message?: string;
  stack?: string;
  url?: string;
  userAgent?: string;
  timestamp?: string | number;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as ClientErrorPayload;
    const { message, stack, url, userAgent, timestamp } = body;

    logger.error('[Client Error]', {
      message,
      stack: stack?.slice(0, 500),
      url,
      userAgent: userAgent?.slice(0, 200),
      timestamp,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
