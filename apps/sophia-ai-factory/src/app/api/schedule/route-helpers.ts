import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { verifyCsrfToken } from '@/seed/security/csrf';

export function mapScheduleErrorStatus(code?: string): number {
  if (code === 'NOT_FOUND') return 404;
  if (code === 'TABLE_NOT_FOUND') return 503;
  return 500;
}

export async function requireCsrfUser(
  req: NextRequest,
): Promise<{ userId: string } | { response: NextResponse }> {
  if (!verifyCsrfToken(req)) {
    return {
      response: NextResponse.json({ error: 'CSRF token missing or invalid' }, { status: 403 }),
    };
  }
  const user = await getCurrentUser();
  if (!user) {
    return {
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }
  return { userId: user.id };
}

export async function parseJsonBody(
  req: NextRequest,
): Promise<{ ok: true; body: unknown } | { ok: false; response: NextResponse }> {
  try {
    const body = await req.json();
    return { ok: true, body };
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }),
    };
  }
}
