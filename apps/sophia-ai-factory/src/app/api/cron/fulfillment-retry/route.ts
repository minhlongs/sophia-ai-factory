import { NextRequest } from 'next/server';
import { verifyCronAuth } from '@/seed/security/cron-auth';
import { runFulfillmentRetryCron } from './service/index';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const authError = verifyCronAuth(req);
  if (authError) return authError;

  return runFulfillmentRetryCron();
}
