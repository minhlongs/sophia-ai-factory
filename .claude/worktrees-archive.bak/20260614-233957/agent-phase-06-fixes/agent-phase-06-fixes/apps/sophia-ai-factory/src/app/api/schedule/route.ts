/**
 * /api/schedule — campaign schedule CRUD
 *
 * GET    — list current user's scheduled campaigns
 * POST   — create a new schedule
 * PATCH  — update a schedule (toggle active, change interval)
 * DELETE — delete a schedule
 *
 * Auth: requires valid Better Auth session
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1Client } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';

interface ScheduledCampaignRow {
  id: string;
  user_id: string;
  topic: string;
  template_script: string | null;
  interval_days: number | null;
  next_run_date: string;
  is_active: number;
}

export const dynamic = 'force-dynamic';

const scheduleDateSchema = z
  .string()
  .trim()
  .min(1)
  .refine(
    (value) => /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})?)?$/.test(value),
    'Expected YYYY-MM-DD or ISO datetime',
  )
  .transform((value) => value.slice(0, 10))
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, 'Invalid calendar date');

const scheduleCreateSchema = z.object({
  topic: z.string().trim().min(1).max(200),
  template_script: z.string().max(20000).nullable().optional(),
  interval_days: z.number().int().min(1).max(365).optional().default(7),
  next_run_date: scheduleDateSchema,
});

const schedulePatchSchema = z.object({
  id: z.string().trim().min(1).max(128),
  is_active: z.boolean().optional(),
  interval_days: z.number().int().min(1).max(365).optional(),
  next_run_date: scheduleDateSchema.optional(),
  topic: z.string().trim().min(1).max(200).optional(),
}).refine(
  (value) =>
    value.is_active !== undefined ||
    value.interval_days !== undefined ||
    value.next_run_date !== undefined ||
    value.topic !== undefined,
  'No fields to update',
);

// GET — list current user's scheduled campaigns
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = await getD1Client();
    const { data, error } = await db
      .from('scheduled_campaigns')
      .select('*')
      .eq('user_id', user.id)
      .order('next_run_date', { ascending: true });

    if (error) {
      if (error.code === 'TABLE_NOT_FOUND' || error.message?.includes('no such table')) {
        return NextResponse.json({ schedules: [] });
      }
      logger.error('[api/schedule] DB error', new Error(error.message));
      return NextResponse.json({ error: 'Failed to fetch schedules' }, { status: 500 });
    }

    return NextResponse.json({
      schedules: (data as unknown as ScheduledCampaignRow[]) ?? [],
    });
  } catch (err) {
    logger.error('[api/schedule] Unexpected error', err instanceof Error ? err : new Error(String(err)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST — create a new scheduled campaign
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const parsed = scheduleCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid schedule input', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }
    const { topic, template_script, interval_days, next_run_date } = parsed.data;

    const db = await getD1Client();
    const { data, error } = await db
      .from('scheduled_campaigns')
      .insert({
        user_id: user.id,
        topic,
        template_script: template_script ?? null,
        interval_days: interval_days ?? 7,
        next_run_date,
        is_active: 1,
      })
      .returning('*');

    if (error) {
      if (error.code === 'TABLE_NOT_FOUND' || error.message?.includes('no such table')) {
        return NextResponse.json({ error: 'Schedule table not initialized' }, { status: 503 });
      }
      logger.error('[api/schedule] Insert error', new Error(error.message));
      return NextResponse.json({ error: 'Failed to create schedule' }, { status: 500 });
    }

    const row = data?.[0];
    return NextResponse.json({
      success: true,
      schedule: row as unknown as ScheduledCampaignRow,
    });
  } catch (err) {
    logger.error('[api/schedule] POST error', err instanceof Error ? err : new Error(String(err)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH — update a schedule
export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const parsed = schedulePatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid schedule input', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }
    const { id, is_active, interval_days, next_run_date, topic } = parsed.data;

    const updateData: Record<string, unknown> = {};

    if (typeof is_active === 'boolean') updateData.is_active = is_active ? 1 : 0;
    if (typeof interval_days === 'number') updateData.interval_days = interval_days;
    if (typeof next_run_date === 'string') updateData.next_run_date = next_run_date;
    if (typeof topic === 'string') updateData.topic = topic;

    const db = await getD1Client();
    const { data, error } = await db
      .from('scheduled_campaigns')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', user.id)
      .returning('*');

    if (error) {
      if (error.code === 'TABLE_NOT_FOUND') {
        return NextResponse.json({ error: 'Schedule table not initialized' }, { status: 503 });
      }
      logger.error('[api/schedule] Update error', new Error(error.message));
      return NextResponse.json({ error: 'Failed to update schedule' }, { status: 500 });
    }

    const row = data?.[0];
    if (!row) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      schedule: row as unknown as ScheduledCampaignRow,
    });
  } catch (err) {
    logger.error('[api/schedule] PATCH error', err instanceof Error ? err : new Error(String(err)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE — remove a schedule
export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing schedule id' }, { status: 400 });
    }

    const db = await getD1Client();
    const { data: existing, error: lookupError } = await db
      .from('scheduled_campaigns')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (lookupError) {
      if (lookupError.code === 'TABLE_NOT_FOUND') {
        return NextResponse.json({ error: 'Schedule table not initialized' }, { status: 503 });
      }
      logger.error('[api/schedule] Delete lookup error', new Error(lookupError.message));
      return NextResponse.json({ error: 'Failed to delete schedule' }, { status: 500 });
    }

    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const { error } = await db
      .from('scheduled_campaigns')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      if (error.code === 'TABLE_NOT_FOUND') {
        return NextResponse.json({ error: 'Schedule table not initialized' }, { status: 503 });
      }
      logger.error('[api/schedule] Delete error', new Error(error.message));
      return NextResponse.json({ error: 'Failed to delete schedule' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error('[api/schedule] DELETE error', err instanceof Error ? err : new Error(String(err)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
