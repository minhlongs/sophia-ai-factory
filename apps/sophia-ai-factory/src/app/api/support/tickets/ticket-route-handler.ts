/**
 * Support Tickets Route Handler Logic
 * Layer: app/api/support/tickets
 * @module app/api/support/tickets/ticket-route-handler
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

async function authenticateUser(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized — authentication required' },
      { status: 401 },
    );
  }
  return user;
}

export async function handleCreateTicket(request: NextRequest): Promise<NextResponse> {
  const user = await authenticateUser(request);
  if (user instanceof NextResponse) return user;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
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
    logger.error('[Support Tickets] insert error', err instanceof Error ? err : new Error(String(err)));
    return NextResponse.json({ error: 'Failed to create support ticket' }, { status: 500 });
  }
}

export async function handleListTickets(request: NextRequest): Promise<NextResponse> {
  const user = await authenticateUser(request);
  if (user instanceof NextResponse) return user;

  const statusParam = request.nextUrl.searchParams.get('status');
  if (statusParam && !isValidTicketStatus(statusParam)) {
    return NextResponse.json(
      { error: 'Invalid status filter', validValues: VALID_STATUSES },
      { status: 400 },
    );
  }

  logger.info('[Support Tickets] List request', { userId: user.id, status: statusParam });

  try {
    const result = await fetchUserSupportTickets(user.id, statusParam);
    if (result.error) {
      return NextResponse.json({ error: 'Failed to list support tickets' }, { status: 500 });
    }
    return NextResponse.json({ tickets: result.data ?? [] });
  } catch (err) {
    logger.error('[Support Tickets] query error', err instanceof Error ? err : new Error(String(err)));
    return NextResponse.json({ error: 'Failed to list support tickets' }, { status: 500 });
  }
}