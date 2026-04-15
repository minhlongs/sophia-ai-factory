/**
 * Scheduled Campaigns Cron
 *
 * Fires daily and auto-creates campaigns for users who have set up
 * recurring schedules in the `scheduled_campaigns` table.
 *
 * Schedule: Daily 03:00 UTC via Cloudflare Cron Trigger
 * Auth: x-cron-secret header, x-cf-cron: true, or ?token= query param
 *
 * Graceful degradation: returns created:0 if table does not yet exist.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db/client';
import { logger } from '@/lib/utils/logger-utility';

export const dynamic = 'force-dynamic';

function verifyCronAuth(req: NextRequest): boolean {
  if (process.env.NODE_ENV === 'development') return true;

  const secret = process.env.CRON_SECRET;

  // Support both header-based (CF Workers) and query-param-based auth
  const headerSecret = req.headers.get('x-cron-secret');
  if (secret && headerSecret === secret) return true;

  const cfCron = req.headers.get('x-cf-cron');
  if (cfCron === 'true') return true;

  const tokenParam = req.nextUrl.searchParams.get('token');
  if (secret && tokenParam === secret) return true;

  return false;
}

interface ScheduledCampaignRow {
  id: string;
  user_id: string;
  topic: string;
  template_script: string | null;
  interval_days: number | null;
  next_run_date: string;
  is_active: boolean;
}

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  try {
    const db = createServerClient();

    // Find active scheduled campaigns due today or earlier
    const { data: schedules, error: fetchError } = await db
      .from('scheduled_campaigns')
      .select('*')
      .eq('is_active', true)
      .lte('next_run_date', today);

    // Graceful degradation — table may not exist yet
    if (fetchError) {
      const msg = fetchError.message ?? String(fetchError);
      if (
        msg.includes('no such table') ||
        msg.includes('relation') ||
        msg.includes('does not exist')
      ) {
        logger.info('[scheduled-campaigns] Table not yet created — skipping');
        return NextResponse.json({ success: true, created: 0, message: 'Table not yet available' });
      }
      throw fetchError;
    }

    if (!schedules || schedules.length === 0) {
      return NextResponse.json({ success: true, created: 0, message: 'No scheduled campaigns due' });
    }

    let created = 0;
    const failures: string[] = [];

    for (const schedule of schedules as ScheduledCampaignRow[]) {
      try {
        // Create campaign from schedule template
        const { error: insertError } = await db.from('campaigns').insert({
          user_id: schedule.user_id,
          title: `${schedule.topic} — ${today}`,
          script: schedule.template_script ?? '',
          status: 'queued',
          created_at: new Date().toISOString(),
        });

        if (insertError) {
          logger.error(
            `[scheduled-campaigns] Insert failed for schedule ${schedule.id}`,
            new Error(insertError.message)
          );
          failures.push(schedule.id);
          continue;
        }

        // Advance next_run_date by interval
        const nextDate = new Date();
        nextDate.setDate(nextDate.getDate() + (schedule.interval_days ?? 7));

        await db
          .from('scheduled_campaigns')
          .update({
            next_run_date: nextDate.toISOString().split('T')[0],
            last_run_date: today,
          })
          .eq('id', schedule.id);

        created++;
      } catch (e) {
        logger.error(
          `[scheduled-campaigns] Failed for schedule ${schedule.id}`,
          e as Error
        );
        failures.push(schedule.id);
      }
    }

    logger.info(`[scheduled-campaigns] Done: created=${created} failures=${failures.length}`);

    return NextResponse.json({
      success: true,
      created,
      total: schedules.length,
      failures: failures.length > 0 ? failures : undefined,
    });
  } catch (e) {
    logger.error('[scheduled-campaigns] Cron failed', e as Error);
    return NextResponse.json({ error: 'Cron failed' }, { status: 500 });
  }
}
