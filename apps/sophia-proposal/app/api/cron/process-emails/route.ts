/**
 * Cron endpoint — POST /api/cron/process-emails
 *
 * Called by Cloudflare Workers cron trigger every 5 minutes.
 * Processes due scheduled emails from drip sequences.
 * Auth: requires CRON_SECRET header to prevent external calls.
 */

import { NextRequest, NextResponse } from 'next/server';
import { processDueEmails } from '@/lib/email/drip-sequence-scheduler';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const provided = request.headers.get('x-cron-secret');

  // Require secret in production to prevent abuse
  if (cronSecret && provided !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const sent = await processDueEmails();
    return NextResponse.json({ success: true, sent, timestamp: new Date().toISOString() });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 },
    );
  }
}

// Also support GET for Cloudflare cron triggers
export async function GET(request: NextRequest) {
  return POST(request);
}
