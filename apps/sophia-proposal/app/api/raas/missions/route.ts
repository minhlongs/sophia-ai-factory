/**
 * GET  /api/raas/missions — list org missions (filter by status, command, pagination)
 * POST /api/raas/missions — submit new mission (validate, reserve MCU, trigger async PEV)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAuthClient, createServerClient } from '@/lib/supabase/client';
import { getOrgId } from '@/lib/org';
import type { CreateMissionRequest, MissionCommand } from '@/types/raas';

export const dynamic = 'force-dynamic';

const VALID_COMMANDS: MissionCommand[] = [
  'proposal:create', 'video:create', 'affiliate:generate', 'affiliate:scrape',
  'content:blog', 'content:social', 'crm:sync', 'analytics:export',
  'gtm:campaign', 'sales:battlecard',
];

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const authClient = createAuthClient(
      request.headers.get('authorization')?.split(' ')[1]
    );
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const serverClient = createServerClient();
    const orgId = await getOrgId(user.id, serverClient);
    if (!orgId) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const params = request.nextUrl.searchParams;
    const status   = params.get('status');
    const command  = params.get('command');
    const page     = Math.max(1, parseInt(params.get('page') ?? '1', 10));
    const pageSize = Math.min(50, parseInt(params.get('page_size') ?? '20', 10));
    const offset   = (page - 1) * pageSize;

    let query = serverClient
      .from('missions')
      .select('*', { count: 'exact' })
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (status) query = query.eq('status', status);
    if (command) query = query.eq('command', command);

    const { data: missions, count, error } = await query;
    if (error) throw error;

    return NextResponse.json({
      missions: missions ?? [],
      total: count ?? 0,
      page,
      page_size: pageSize,
    });
  } catch (err) {
    console.error('GET /api/raas/missions error:', err);
    return NextResponse.json({ error: 'Failed to fetch missions' }, { status: 500 });
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const authClient = createAuthClient(
      request.headers.get('authorization')?.split(' ')[1]
    );
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const serverClient = createServerClient();
    const orgId = await getOrgId(user.id, serverClient);
    if (!orgId) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const body = (await request.json()) as CreateMissionRequest;

    // 1. Validate command
    if (!body.command || !VALID_COMMANDS.includes(body.command)) {
      return NextResponse.json(
        { error: `Invalid command. Valid: ${VALID_COMMANDS.join(', ')}` },
        { status: 400 }
      );
    }
    if (!body.title?.trim()) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 });
    }

    // 2. Look up MCU cost from template
    const { data: template } = await serverClient
      .from('mission_templates')
      .select('mcu_cost')
      .eq('command', body.command)
      .eq('is_active', true)
      .single();

    const mcuCost = template?.mcu_cost ?? 0;

    // 3. Check MCU balance
    const { data: balance } = await serverClient
      .from('org_balances')
      .select('balance')
      .eq('org_id', orgId)
      .single();

    if (!balance || balance.balance < mcuCost) {
      return NextResponse.json(
        { error: 'Insufficient MCU balance', required: mcuCost, current: balance?.balance ?? 0 },
        { status: 402 }
      );
    }

    // 4. Pre-deduct MCU (reserve)
    const { error: deductError } = await serverClient.rpc('debit_mcu_balance', {
      p_org_id: orgId,
      p_amount: mcuCost,
      p_feature: body.command,
    });

    if (deductError) {
      return NextResponse.json({ error: 'Failed to reserve MCU' }, { status: 402 });
    }

    // 5. Create mission record
    const { data: mission, error: insertError } = await serverClient
      .from('missions')
      .insert({
        org_id:       orgId,
        title:        body.title.trim(),
        description:  body.description ?? null,
        command:      body.command,
        params:       body.params ?? {},
        priority:     body.priority ?? 'normal',
        status:       'queued',
        mcu_cost:     mcuCost,
        mcu_reserved: mcuCost,
      })
      .select()
      .single();

    if (insertError || !mission) {
      // Refund on insert failure
      await serverClient.rpc('credit_mcu_balance', {
        p_org_id: orgId,
        p_amount: mcuCost,
        p_subscription_id: `mission:refund:insert_failed`,
      });
      throw insertError ?? new Error('Mission insert failed');
    }

    // 6. Trigger async PEV execution (fire-and-forget)
    const executeUrl = new URL('/api/raas/execute', request.url).toString();
    fetch(executeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': process.env.INTERNAL_API_SECRET ?? '',
      },
      body: JSON.stringify({ mission_id: mission.id }),
    }).catch((e) => console.error('[RaaS] async execute trigger failed:', e));

    return NextResponse.json({ success: true, mission }, { status: 201 });
  } catch (err) {
    console.error('POST /api/raas/missions error:', err);
    return NextResponse.json({ error: 'Failed to submit mission' }, { status: 500 });
  }
}
