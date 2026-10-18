/**
 * /api/support/tickets — Support Ticketing REST API
 *
 * POST — Create a new support ticket (auth required)
 * GET  — List the authenticated user's tickets (optional status filter)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { logger } from '@/seed/utils/logger-utility';
import {
  VALID_STATUSES,
  createTicketSchema,
  fetchUserSupportTickets,
  insertSupportTicketRecord,
  isValidTicketStatus,
} from './ticket-route-helpers';

export const dynamic = 'force-dynamic';

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

    try {
      const ticket = await insertSupportTicketRecord(user.id, parsed.data);
      return NextResponse.json({ ticket }, { status: 201 });
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
    if (statusParam && !isValidTicketStatus(statusParam)) {
      return NextResponse.json(
        { error: 'Invalid status filter', validValues: VALID_STATUSES },
        { status: 400 },
      );
    }

    logger.info('[Support Tickets] List request', {
      userId: user.id,
      status: statusParam,
    });

    try {
      const result = await fetchUserSupportTickets(user.id, statusParam);
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
