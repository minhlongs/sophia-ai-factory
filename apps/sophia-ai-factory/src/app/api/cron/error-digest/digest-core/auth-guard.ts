import { NextRequest } from 'next/server';

export function verifyCronSecret(request: NextRequest): boolean {
  if (process.env.NODE_ENV === 'development') return true;
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  return request.headers.get('authorization') === `Bearer ${cronSecret}`;
}
