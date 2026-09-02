/**
 * /api/support/tickets — Support Ticketing REST API
 *
 * POST — Create a new support ticket (auth required)
 * GET  — List the authenticated user's tickets (optional status filter)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';

export const dynamic = 'force-dynamic';

// ── Zod validation ───────────────────────────────────────────────────────────

const VALID_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;
const VALID_STATUSES = ['open', 'in_progress', 'resolved', 'closed'] as const;

const createTicketSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(10).max(5000),
  priority: z.enum(VALID_PRIORITIES).default('normal'),
});

// ── Route handlers ───────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized — authentication required' },
        { status: 401 },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 },
      );
    }

    const parsed = createTicketSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid ticket data', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    logger.info('[Support Tickets] Create request', {
      userId: user.id,
      priority: parsed.data.priority,
    });

    const db = createServerClient();
    const ticketId = crypto.randomUUID();

    try {
      await db.from('support_tickets').insert({
        id: ticketId,
        user_id: user.id,
        source: 'web',
        title: parsed.data.title ?? null,
        message: parsed.data.description,
        status: 'open',
        priority: parsed.data.priority,
        created_at: new Date().toISOString(),
      });
    } catch (err) {
      logger.error(
        '[Support Tickets] insert error',
        err instanceof Error ? err : new Error(String(err)),
      );
      return NextResponse.json(
        { error: 'Failed to create support ticket' },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        ticket: {
          id: ticketId,
          title: parsed.data.title ?? null,
          message: parsed.data.description,
          status: 'open',
          priority: parsed.data.priority,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    logger.error(
      '[Support Tickets] POST error',
      err instanceof Error ? err : new Error(String(err)),
    );
    return NextResponse.json(
      { error: 'Failed to process support ticket' },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized — authentication required' },
        { status: 401 },
      );
    }

    const statusParam = request.nextUrl.searchParams.get('status');
    if (statusParam && !VALID_STATUSES.includes(statusParam as typeof VALID_STATUSES[number])) {
      return NextResponse.json(
        { error: 'Invalid status filter', validValues: VALID_STATUSES },
        { status: 400 },
      );
    }

    logger.info('[Support Tickets] List request', {
      userId: user.id,
      status: statusParam,
    });

    const db = createServerClient();

    try {
      let query = db.from('support_tickets').select('*').eq('user_id', user.id);
      if (statusParam) {
        query = query.eq('status', statusParam);
      }
      const result = await query;

      if (result.error) {
        return NextResponse.json(
          { error: 'Failed to list support tickets' },
          { status: 500 },
        );
      }

      return NextResponse.json({ tickets: result.data ?? [] });
    } catch (err) {
      logger.error(
        '[Support Tickets] query error',
        err instanceof Error ? err : new Error(String(err)),
      );
      return NextResponse.json(
        { error: 'Failed to list support tickets' },
        { status: 500 },
      );
    }
  } catch (err) {
    logger.error(
      '[Support Tickets] GET error',
      err instanceof Error ? err : new Error(String(err)),
    );
    return NextResponse.json(
      { error: 'Failed to list support tickets' },
      { status: 500 },
    );
  }
}
