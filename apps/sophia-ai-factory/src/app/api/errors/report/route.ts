import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/utils/logger-utility';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, stack, url, userAgent, timestamp } = body;

    // logger.error signature: (message, error?, metadata?, requestId?)
    logger.error('[Client Error]', undefined, {
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
