/**
 * /api/campaigns — list, read, and delete campaigns
 *
 * GET  /api/campaigns — list current user's campaigns
 * GET  /api/campaigns?id=... — read one current-user campaign
 * DELETE /api/campaigns?id=... — delete one current-user campaign
 *
 * Auth: requires valid Better Auth session
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { Campaign } from '@/seed/types';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = createServerClient();
    const { searchParams } = new URL(req.url);
    const campaignId = searchParams.get('id');

    // Single campaign by id
    if (campaignId) {
      const { data, error } = await db
        .from('campaigns')
        .select('*')
        .eq('id', campaignId)
        .eq('user_id', user.id)
        .single();

      if (error || !data) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }

      return NextResponse.json({
        campaigns: [data as unknown as Campaign],
      });
    }

    // List user's campaigns
    const { data, error } = await db
      .from('campaigns')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('[api/campaigns] DB error', new Error(error.message));
      return NextResponse.json(
        { error: 'Failed to fetch campaigns' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      campaigns: (data as unknown as Campaign[]) || [],
    });
  } catch (err) {
    logger.error('[api/campaigns] Unexpected error', err instanceof Error ? err : new Error(String(err)));
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const campaignId = searchParams.get('id');

    if (!campaignId) {
      return NextResponse.json({ error: 'Missing campaign id' }, { status: 400 });
    }

    const db = createServerClient();
    const { data: existing, error: lookupError } = await db
      .from('campaigns')
      .select('id')
      .eq('id', campaignId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (lookupError) {
      logger.error('[api/campaigns] Delete lookup error', new Error(lookupError.message));
      return NextResponse.json(
        { error: 'Failed to delete campaign' },
        { status: 500 }
      );
    }

    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const { error } = await db
      .from('campaigns')
      .delete()
      .eq('id', campaignId)
      .eq('user_id', user.id);

    if (error) {
      logger.error('[api/campaigns] Delete error', new Error(error.message));
      return NextResponse.json(
        { error: 'Failed to delete campaign' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error('[api/campaigns] Delete unexpected error', err instanceof Error ? err : new Error(String(err)));
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
