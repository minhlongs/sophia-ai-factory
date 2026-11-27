import { NextRequest } from 'next/server';
import { verifyCronAuth } from '@/seed/security/cron-auth';

export function verifyCronSecret(request: NextRequest): boolean {
  return verifyCronAuth(request) === null;
}
